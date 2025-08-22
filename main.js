// main.js (Proses Utama Electron) - DIPERBETULKAN

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { Parser } = require("node-sql-parser");
const parser = new Parser();

// Tentukan laluan ke pangkalan data
const dbPath = path.join(app.getPath("userData"), "FiziSysMaker.db");
const dbExists = fs.existsSync(dbPath);
const db = new Database(dbPath);

// Logik First-Run
if (!dbExists) {
  console.log("Pangkalan data tidak ditemui, mencipta skema baharu...");
  try {
    const schemaSql = fs.readFileSync(
      path.join(__dirname, "schema.sql"),
      "utf8"
    );
    db.exec(schemaSql);
    console.log("Skema berjaya dicipta.");
  } catch (error) {
    console.error("Gagal mencipta skema pangkalan data:", error);
  }
}

// =================================================================
// ▼▼▼ SEMUA IPC HANDLER DIKUMPULKAN DI SINI UNTUK KONSISTENSI ▼▼▼
// =================================================================

// Handler untuk mendapatkan skema penuh
ipcMain.handle("project:get-full-schema", async (event, projectId) => {
  try {
    const project = db
      .prepare("SELECT * FROM projects WHERE project_id = ?")
      .get(projectId);
    if (!project)
      throw new Error(`Projek dengan ID ${projectId} tidak ditemui.`);

    const tables = db
      .prepare("SELECT * FROM tables WHERE project_id = ? ORDER BY table_name")
      .all(projectId);
    const tableIds = tables.map((t) => t.table_id);

    if (tableIds.length === 0) {
      return { database: { name: project.app_title, table: {} } };
    }

    const placeholder = tableIds.map(() => "?").join(",");
    const fields = db
      .prepare(`SELECT * FROM fields WHERE table_id IN (${placeholder})`)
      .all(...tableIds);

    const structuredTables = {};
    tables.forEach((table) => {
      structuredTables[table.table_name] = { ...table, fields: {} };
    });

    fields.forEach((field) => {
      const parentTable = tables.find((t) => t.table_id === field.table_id);
      if (parentTable) {
        structuredTables[parentTable.table_name].fields[field.field_name] = {
          ...field,
        };
      }
    });

    let relationships = [];
    if (tableIds.length > 0) {
      const placeholder = tableIds.map(() => "?").join(",");
      relationships = db
        .prepare(
          `SELECT r.*, p.table_name as parent_table_name, c.table_name as child_table_name
           FROM parent_child_relationships r
           JOIN tables p ON r.parent_table_id = p.table_id
           JOIN tables c ON r.child_table_id = c.table_id
           WHERE r.parent_table_id IN (${placeholder})`
        )
        .all(...tableIds);
    }

    // ▼▼▼ TAMBAH BLOK KOD INI ▼▼▼
    const groups = db
      .prepare("SELECT * FROM menu_groups WHERE project_id = ? ORDER BY group_order, group_name")
      .all(projectId);
      
    const groupIds = groups.map(g => g.menu_group_id);
    let items = [];
    if (groupIds.length > 0) {
        const placeholder = groupIds.map(() => '?').join(',');
        items = db
            .prepare(`
                SELECT mgi.*, t.table_name 
                FROM menu_group_items mgi
                JOIN tables t ON mgi.table_id = t.table_id
                WHERE mgi.menu_group_id IN (${placeholder})
                ORDER BY mgi.item_order
            `)
            .all(...groupIds);
    }

    // Gabungkan data items ke dalam data groups
    const structuredMenuGroups = groups.map(group => {
        return {
            ...group,
            items: items.filter(item => item.menu_group_id === group.menu_group_id)
        };
    });

    return {
      database: {
        name: project.app_title,
        table: structuredTables,
        relationships: relationships,
        menu_groups: structuredMenuGroups // Tambah data menu di sini
      },
    };
	
    return { database: { name: project.app_title, table: structuredTables } };
  } catch (error) {
    console.error("Gagal mengambil skema penuh:", error);
    return null;
  }
});

// Handler untuk pengurusan projek
ipcMain.handle("project:get-active", async () => {
  return db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
});

ipcMain.handle("project:create", async (event, projectName) => {
  try {
    db.prepare("UPDATE projects SET is_active = 0").run();
    const info = db
      .prepare("INSERT INTO projects (app_title, is_active) VALUES (?, 1)")
      .run(projectName);
    return db
      .prepare("SELECT * FROM projects WHERE project_id = ?")
      .get(info.lastInsertRowid);
  } catch (error) {
    console.error("Gagal mencipta projek:", error);
    return null;
  }
});

ipcMain.handle("project:delete-schema", async (event, projectId) => {
  try {
    const deleteSchema = db.transaction(() => {
      db.prepare(
        "DELETE FROM fields WHERE table_id IN (SELECT table_id FROM tables WHERE project_id = ?)"
      ).run(projectId);
      db.prepare("DELETE FROM tables WHERE project_id = ?").run(projectId);
    });
    deleteSchema();
    return { success: true, message: "Skema lama berjaya dipadam." };
  } catch (error) {
    console.error("Gagal memadam skema:", error);
    return { success: false, message: `Ralat: ${error.message}` };
  }
});

// Handler untuk pengurusan jadual
ipcMain.handle("tables:get-by-project", async (event, projectId) => {
  try {
    return db
      .prepare("SELECT * FROM tables WHERE project_id = ? ORDER BY table_name")
      .all(projectId);
  } catch (error) {
    console.error("Gagal mendapatkan senarai jadual:", error);
    return [];
  }
});

ipcMain.handle("tables:check-exists", async (event, projectId) => {
  return db
    .prepare("SELECT COUNT(*) as count FROM tables WHERE project_id = ?")
    .get(projectId);
});

// Handler untuk import SQL
// main.js

function importSchema(sql, projectId) {
    let tablesCreated = 0;
    let relationshipsCreated = 0;
    const tableMap = {};
    const foreignKeysToProcess = [];

    const cleanedSql = sql.replace(
        /\s+ENGINE=\w+\s*DEFAULT\s*CHARSET=\w+(\s*COLLATE=\w+)?(\s*COMMENT='.*?')?;/gi,
        ";"
    );

    const extractDefaultValue = (defaultNode) => {
        // ... (fungsi ini tidak berubah) ...
        if (!defaultNode || !defaultNode.value) return null;
        const valueNode = defaultNode.value;
        switch (valueNode.type) {
            case "null":
                return "NULL";
            case "single_quote_string":
            case "number":
                return String(valueNode.value);
            case "function":
                if (
                    valueNode.name &&
                    valueNode.name.name &&
                    Array.isArray(valueNode.name.name) &&
                    valueNode.name.name.length > 0
                ) {
                    return valueNode.name.name[0].value;
                }
                break;
        }
        return null;
    };

    const transaction = db.transaction((ast) => {
        for (const statement of ast) {
            if (statement.type === "create" && statement.keyword === "table") {
                const tableName = statement.table[0].table;
                const tableInfo = db
                    .prepare(
                        "INSERT INTO tables (project_id, table_name, table_view_title) VALUES (?, ?, ?)"
                    )
                    .run(projectId, tableName, tableName);
                const tableId = tableInfo.lastInsertRowid;
                tablesCreated++;
                tableMap[tableName] = tableId;

                const tableLevelConstraints = [];
                for (const col of statement.create_definitions) {
                    if (col.resource === "column") {
                        let fieldData = {
                            table_id: tableId,
                            field_name: col.column.column,
                            data_type: col.definition.dataType,
                            length: col.definition.length || null,
                            required: 0,
                            auto_increment: 0,
                            unsigned: 0,
                            zero_fill: 0,
                            primary_key: 0,
                            unique: 0,
                            text_area: 0, // Tambah nilai lalai
                            rich_html: 0, // Tambah nilai lalai
							read_only: 0,
                            default_value: null,
                        };
                        const dataType = fieldData.data_type.toUpperCase();

                        if (dataType === 'TEXT') {
                            fieldData.text_area = 1;
                        } else if (dataType === 'MEDIUMTEXT' || dataType === 'LONGTEXT') {
                            fieldData.rich_html = 1;
                        }
                        if (col.auto_increment) fieldData.auto_increment = 1;

                        // Medan hanya 'required' jika ia NOT NULL dan BUKAN auto-increment
                        if ((col.nullable && col.nullable.type === "not null") && !col.auto_increment) {
                            fieldData.required = 1;
                        }
						
                        if (col.unsigned) fieldData.unsigned = 1;
                        if (col.zerofill) fieldData.zero_fill = 1;
                        if (col.default_val) {
                            fieldData.default_value = extractDefaultValue(col.default_val);
                        }
                        if (col.constraints) {
                            for (const constraint of col.constraints) {
                                const definition = constraint.definition || constraint;
                                switch (definition.constraint_type.toLowerCase()) {
                                    case "primary key":
                                        fieldData.primary_key = 1;
                                        fieldData.read_only = 1; // Set read_only jika primary key
                                        break;
                                    case "unique key":
                                        fieldData.unique = 1;
                                        break;
                                    case "not null":
                                        fieldData.required = 1;
                                        break;
                                    case "auto_increment":
                                        fieldData.auto_increment = 1;
                                        break;
                                    case "default":
                                        if (!fieldData.default_value) {
                                            fieldData.default_value = extractDefaultValue(definition);
                                        }
                                        break;
                                }
                            }
                        }
                        db.prepare(
                            `INSERT INTO fields (table_id, field_name, data_type, length, required, auto_increment, unsigned, zero_fill, primary_key, "unique", text_area, rich_html, read_only, default_value, caption) VALUES (@table_id, @field_name, @data_type, @length, @required, @auto_increment, @unsigned, @zero_fill, @primary_key, @unique, @text_area, @rich_html, @read_only, @default_value, @field_name)`
                        ).run(fieldData);
                    } else if (col.resource === "constraint") {
                        tableLevelConstraints.push(col);
                    }
                }

                for (const constraint of tableLevelConstraints) {
                    if (constraint.constraint_type) {
                        const constraintType = constraint.constraint_type.toLowerCase();

                        if (constraintType === "primary key") {
                            if (constraint.definition && Array.isArray(constraint.definition)) {
                                for (const col of constraint.definition) {
                                    db.prepare(
                                        `UPDATE fields SET primary_key = 1, read_only = 1 WHERE table_id = ? AND field_name = ?`
                                    ).run(tableId, col.column);
                                }
                            }
                        } else if (constraintType === "unique key") {
                             if (constraint.definition && Array.isArray(constraint.definition)) {
                                for (const col of constraint.definition) {
                                    db.prepare(
                                        `UPDATE fields SET "unique" = 1 WHERE table_id = ? AND field_name = ?`
                                    ).run(tableId, col.column);
                                }
                            }
                        }
                        
                        else if (
                            constraintType === "foreign key" &&
                            constraint.reference_definition &&
                            constraint.definition && constraint.definition.length > 0 &&
                            // Gunakan 'definition' bukannya 'columns'
                            constraint.reference_definition.definition && constraint.reference_definition.definition.length > 0
                        ) {
                            const parentTableName = constraint.reference_definition.table[0].table;
                            const fkChildField = constraint.definition[0].column;
                            // Ekstrak dari 'definition' bukannya 'columns'
                            const parentField = constraint.reference_definition.definition[0].column;

                            foreignKeysToProcess.push({
                                childTableName: tableName,
                                parentTableName: parentTableName,
                                fkChildField: fkChildField,
                                parentField: parentField,
                                tabTitle: tableName
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (l) => l.toUpperCase()),
                            });
                        }
                    }
                }
            }
        }

        for (const fk of foreignKeysToProcess) {
            const childTableId = tableMap[fk.childTableName];
            const parentTableId = tableMap[fk.parentTableName];
            if (childTableId && parentTableId) {
                db.prepare(
                    `INSERT INTO parent_child_relationships 
                     (parent_table_id, child_table_id, fk_child_field, parent_field, tab_title) 
                     VALUES (?, ?, ?, ?, ?)`
                ).run(parentTableId, childTableId, fk.fkChildField, fk.parentField, fk.tabTitle);
                relationshipsCreated++;
            }
        }
    });

    try {
        const ast = parser.astify(cleanedSql, { database: "MySQL" });
        transaction(ast);
        return {
            success: true,
            message: `${tablesCreated} jadual dan ${relationshipsCreated} hubungan berjaya diimport!`,
        };
    } catch (error) {
        console.error("Gagal mengimport SQL:", error);
        return { success: false, message: `Ralat: ${error.message}` };
    }
}

ipcMain.handle("sql:import-file", async (event, projectId) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "SQL Files", extensions: ["sql"] }],
  });
  if (!canceled && filePaths.length > 0) {
    const sqlContent = fs.readFileSync(filePaths[0], "utf8");
    return importSchema(sqlContent, projectId);
  }
  return { success: false, message: "Tiada fail dipilih." };
});

ipcMain.handle("sql:import-text", (event, { sql, projectId }) => {
  return importSchema(sql, projectId);
});

// Handler utiliti
ipcMain.handle("open-url", (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle("settings:get-all", async () => {
  try {
    const settingsArray = db.prepare("SELECT * FROM fizisys_settings").all();
    // Tukar array of objects kepada satu object key-value untuk akses mudah
    // Cth: { check_updates: '1', autosave_interval: '15', ... }
    const settingsObject = settingsArray.reduce((acc, setting) => {
      acc[setting.setting_name] = setting.setting_value;
      return acc;
    }, {});
    return settingsObject;
  } catch (error) {
    console.error("Gagal mendapatkan tetapan FiziSysMaker:", error);
    return null;
  }
});
// =================================================================
// ▼▼▼ PENGURUSAN TETINGKAP APLIKASI ▼▼▼
// =================================================================

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.loadFile("src/index.html");
  // Buka DevTools secara automatik untuk memudahkan penyahpepijatan
  // win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
