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

// main.js

// Handler untuk mencipta jadual baharu
ipcMain.handle('table:create', async (event, projectId) => {
    try {
        // Cari nama unik
        const tables = db.prepare("SELECT table_name FROM tables WHERE project_id = ? AND table_name LIKE 'newTable%'").all(projectId);
        let n = 1;
        const existingNumbers = tables.map(t => parseInt(t.table_name.split('_')[1] || 0));
        while (existingNumbers.includes(n)) {
            n++;
        }
        const newName = `newTable_${n}`;

        // Masukkan jadual baharu
        const info = db.prepare(
            'INSERT INTO tables (project_id, table_name, table_view_title) VALUES (?, ?, ?)'
        ).run(projectId, newName, newName);

        // Kembalikan data jadual yang baru dicipta
        return db.prepare('SELECT * FROM tables WHERE table_id = ?').get(info.lastInsertRowid);

    } catch (error) {
        console.error("Gagal mencipta jadual baharu:", error);
        return null;
    }
});

// Handler untuk mendapatkan skema penuh
ipcMain.handle("project:get-full-schema", async (event, projectId) => {
  try {
    const project = db
      .prepare("SELECT * FROM projects WHERE project_id = ?")
      .get(projectId);
    if (!project)
      throw new Error(`Projek dengan ID ${projectId} tidak ditemui.`);

    const tables = db
      .prepare("SELECT * FROM tables WHERE project_id = ? ORDER BY table_id")
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

// Handler baharu untuk mendapatkan semua projek
ipcMain.handle('projects:get-all', async () => {
    try {
        return db.prepare('SELECT project_id, app_title, is_active FROM projects ORDER BY app_title').all();
    } catch (error) {
        console.error("Gagal mendapatkan senarai projek:", error);
        return [];
    }
});

// Handler baharu untuk menetapkan projek aktif
ipcMain.handle('project:set-active', async (event, projectId) => {
    try {
        const setActiveTransaction = db.transaction(() => {
            db.prepare('UPDATE projects SET is_active = 0').run(); // Set semua sebagai tidak aktif
            db.prepare('UPDATE projects SET is_active = 1 WHERE project_id = ?').run(projectId); // Aktifkan yang dipilih
        });
        setActiveTransaction();
        return db.prepare('SELECT * FROM projects WHERE project_id = ?').get(projectId);
    } catch (error) {
        console.error(`Gagal menetapkan projek aktif (ID: ${projectId}):`, error);
        return null;
    }
});

// Handler baharu untuk mengemas kini tetapan projek
ipcMain.handle('project:update', async (event, data) => {
    try {
        const { project_id, ...fieldsToUpdate } = data;
        if (!project_id) {
            throw new Error("Project ID tidak dibekalkan.");
        }

        const allowedColumns = [
            'app_title', 'date_order', 'separator', 'char_encoding', 'language_select',
            'timezone_select', 'use_24hr_format', 'enforce_mysql_encoding', 'theme_select',
            'use_3d_effects', 'rtl', 'compact', 'menu_orientation', 'menu_at_homepage',
            'tables_per_row', 'extra_wide', 'panel_height', 'hide_login', 'allow_sql_tool',
            'allow_server_status', 'admins_group_access', 'allow_table_view_sql',
            'copy_children_async', 'allow_pwa_install', 'url'
        ];

        const setClause = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => `${key} = ?`)
            .join(', ');

        if (!setClause) {
            return { success: true, message: 'Tiada medan yang sah untuk dikemas kini.' };
        }

        const values = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => fieldsToUpdate[key]);

        const stmt = db.prepare(`UPDATE projects SET ${setClause} WHERE project_id = ?`);
        stmt.run(...values, project_id);

        return { success: true };
    } catch (error) {
        console.error("Gagal mengemas kini projek:", error);
        return { success: false, message: error.message };
    }
});

// main.js

// Handler baharu untuk mengemas kini tetapan jadual
ipcMain.handle('table:update', async (event, data) => {
    try {
        const { table_id, ...fieldsToUpdate } = data;
        if (!table_id) {
            throw new Error("Table ID tidak dibekalkan.");
        }

        // Senarai lajur yang dibenarkan untuk dikemas kini dalam jadual 'tables'
        const allowedColumns = [
            'table_view_title', 'table_description', 'show_quick_search', 'records_per_page',
            'default_sort_by', 'sort_descending', 'allow_sorting', 'allow_filters', 'allow_csv_export',
            'allow_print_view', 'allow_user_save_filters', 'hide_homepage_link', 'allow_mass_delete',
            'filter_before_view', 'hide_nav_menu_link', 'show_record_count', 'tv_template',
            'hide_field_captions', 'use_first_field_as_title', 'table_view_classes_input',
            'detail_view_classes_input', 'detail_view_title', 'record_owner', 'default_focus',
            'redirect_after_insert', 'enable_detail_view', 'delete_with_children', 'dv_allow_print_view',
            'dv_separate_page', 'dv_hide_save_as_copy', 'dv_sticky_buttons', 'dv_allow_add_from_homepage'
        ];

        const setClause = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => `${key} = ?`)
            .join(', ');

        if (!setClause) {
            return { success: true, message: 'Tiada medan yang sah untuk dikemas kini.' };
        }

        const values = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => fieldsToUpdate[key]);

        const stmt = db.prepare(`UPDATE tables SET ${setClause} WHERE table_id = ?`);
        stmt.run(...values, table_id);

        return { success: true };
    } catch (error) {
        console.error("Gagal mengemas kini jadual:", error);
        return { success: false, message: error.message };
    }
});

// Handler baharu untuk mengemas kini tetapan medan
ipcMain.handle('field:update', async (event, data) => {
    try {
        const { field_id, ...fieldsToUpdate } = data;
        if (!field_id) {
            throw new Error("Field ID tidak dibekalkan.");
        }

        // Senarai lajur yang dibenarkan untuk dikemas kini dalam jadual 'fields'
        const allowedColumns = [
            'caption', 'description', 'data_type', 'length', 'precision', 'max_chars_in_tv', 'alignment',
            'default_value', 'read_only', 'primary_key', 'zero_fill', 'required', 'rich_html',
            'auto_increment', 'unique', 'show_sum', 'text_area', 'unsigned', 'no_filter', 'binary',
            'check_box', 'hide_in_tv', 'hide_in_dv', 'enable_column_width', 'column_width',
            'media_type', 'media_link_behavior', 'media_link_display_as', 'media_link_other_field',
            'allow_image_uploads', 'max_file_size', 'delete_image_server', 'dont_rename_image',
            'tv_thumb_width', 'tv_thumb_height', 'tv_enable_zooming', 'tv_show_full_size',
            'dv_thumb_width', 'dv_thumb_height', 'dv_enable_zooming', 'dv_show_full_size',
            'allow_file_uploads', 'file_types', 'file_max_size', 'delete_file_server',
            'dont_rename_file', 'file_behavior', 'file_display_as', 'file_other_field',
            'display_gmap', 'gmap_type', 'gmap_tv_width', 'gmap_tv_height', 'gmap_dv_height',
            'accept_video_url', 'youtube_tv_width', 'youtube_tv_height', 'youtube_dv_width',
            'youtube_dv_height', 'lookup_parent_table', 'lookup_caption_1', 'lookup_separator',
            'lookup_caption_2', 'lookup_display_as', 'lookup_inherit_permissions',
            'lookup_link_behavior', 'options_list_values', 'options_display', 'format_as',
            'calculated_enable', 'calculated_query', 'lookup_custom_query'
        ];

        const setClause = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => `"${key}" = ?`) // Guna petikan berganda untuk kata kunci 'unique'
            .join(', ');

        if (!setClause) {
            return { success: true, message: 'Tiada medan yang sah untuk dikemas kini.' };
        }

        const values = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => fieldsToUpdate[key]);

        const stmt = db.prepare(`UPDATE fields SET ${setClause} WHERE field_id = ?`);
        stmt.run(...values, field_id);

        return { success: true };
    } catch (error) {
        console.error("Gagal mengemas kini medan:", error);
        return { success: false, message: error.message };
    }
});

// Handler baharu untuk menyimpan semua tetapan FiziSysMaker
ipcMain.handle('settings:save-all', async (event, settingsData) => {
    try {
        const updateStmt = db.prepare('UPDATE fizisys_settings SET setting_value = ? WHERE setting_name = ?');
        
        const saveTransaction = db.transaction(() => {
            for (const [key, value] of Object.entries(settingsData)) {
                updateStmt.run(value, key);
            }
        });

        saveTransaction();
        return { success: true, message: 'Settings saved successfully.' };
    } catch (error) {
        console.error("Gagal menyimpan tetapan FiziSysMaker:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('menu:save-structure', async (event, { projectId, menuData }) => {
    if (!projectId) {
        return { success: false, message: 'Project ID tidak dibekalkan.' };
    }
    try {
        const deleteItemsStmt = db.prepare('DELETE FROM menu_group_items WHERE menu_group_id IN (SELECT menu_group_id FROM menu_groups WHERE project_id = ?)');
        const deleteGroupsStmt = db.prepare('DELETE FROM menu_groups WHERE project_id = ?');
        const insertGroupStmt = db.prepare('INSERT INTO menu_groups (project_id, group_name, group_order) VALUES (?, ?, ?)');
        const insertItemStmt = db.prepare('INSERT INTO menu_group_items (menu_group_id, table_id, item_order) VALUES (?, (SELECT table_id FROM tables WHERE table_name = ? AND project_id = ?), ?)');

        const transaction = db.transaction(() => {
            // Padam semua data menu lama untuk projek ini
            deleteItemsStmt.run(projectId);
            deleteGroupsStmt.run(projectId);

            // Masukkan semula data baharu
            menuData.forEach((group, groupIndex) => {
                const info = insertGroupStmt.run(projectId, group.group_name, groupIndex);
                const newGroupId = info.lastInsertRowid;
                
                group.items.forEach((item, itemIndex) => {
                    insertItemStmt.run(newGroupId, item.table_name, projectId, itemIndex);
                });
            });
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error("Gagal menyimpan struktur menu:", error);
        return { success: false, message: error.message };
    }
});

// main.js

ipcMain.handle('menu:update-order', async (event, { projectId, orderData }) => {
    try {
        const updateGroup = db.prepare('UPDATE menu_groups SET group_order = ? WHERE menu_group_id = ? AND project_id = ?');
        const updateItem = db.prepare('UPDATE menu_group_items SET item_order = ?, menu_group_id = ? WHERE item_id = ?');

        const transaction = db.transaction(() => {
            orderData.forEach((group, groupIndex) => {
                updateGroup.run(groupIndex, group.groupId, projectId);
                if (group.items) {
                    group.items.forEach((item, itemIndex) => {
                        updateItem.run(itemIndex, group.groupId, item.itemId);
                    });
                }
            });
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error("Gagal menyimpan susunan menu:", error);
        return { success: false, message: error.message };
    }
});

// main.js

// Handler baharu untuk mengemas kini tetapan hubungan
ipcMain.handle('relationship:update', async (event, data) => {
    try {
        const { relationship_id, ...fieldsToUpdate } = data;
        if (!relationship_id) {
            throw new Error("Relationship ID tidak dibekalkan.");
        }

        const allowedColumns = [
            'show_tab', 'show_icon', 'autoclose_modal', 'tab_title', 'copy_records',
            'show_link_above', 'show_count_in_tv', 'allow_add_from_tv'
        ];

        const setClause = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => `${key} = ?`)
            .join(', ');

        if (!setClause) {
            return { success: true, message: 'Tiada medan yang sah untuk dikemas kini.' };
        }

        const values = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => fieldsToUpdate[key]);

        const stmt = db.prepare(`UPDATE parent_child_relationships SET ${setClause} WHERE relationship_id = ?`);
        stmt.run(...values, relationship_id);

        return { success: true };
    } catch (error) {
        console.error("Gagal mengemas kini hubungan:", error);
        return { success: false, message: error.message };
    }
});

// main.js

// Handler baharu untuk mencipta/mengemas kini hubungan (Upsert)
ipcMain.handle('relationship:upsert', async (event, data) => {
    try {
        const { parentTableName, childTableName, fk_child_field } = data;

        const transaction = db.transaction(() => {
            // Dapatkan ID yang diperlukan
            const childTable = db.prepare('SELECT table_id FROM tables WHERE table_name = ?').get(childTableName);
            if (!childTable) throw new Error(`Jadual anak tidak ditemui: ${childTableName}`);
            
            // Padam hubungan lama untuk medan ini (jika ada)
            db.prepare('DELETE FROM parent_child_relationships WHERE child_table_id = ? AND fk_child_field = ?')
              .run(childTable.table_id, fk_child_field);

            // Jika pengguna memilih parent table (bukan pilihan kosong)
            if (parentTableName) {
                const parentTable = db.prepare('SELECT table_id FROM tables WHERE table_name = ?').get(parentTableName);
                if (!parentTable) throw new Error(`Jadual induk tidak ditemui: ${parentTableName}`);
                
                // Cari primary key jadual induk
                const parentPkField = db.prepare(`
                    SELECT f.field_name 
                    FROM fields f 
                    JOIN tables t ON f.table_id = t.table_id 
                    WHERE t.table_name = ? AND f.primary_key = 1
                `).get(parentTableName);
                if (!parentPkField) throw new Error(`Primary key tidak ditemui untuk jadual: ${parentTableName}`);
                
                // Masukkan hubungan baharu
                db.prepare(`
                    INSERT INTO parent_child_relationships 
                    (parent_table_id, child_table_id, fk_child_field, parent_field, tab_title) 
                    VALUES (?, ?, ?, ?, ?)
                `).run(parentTable.table_id, childTable.table_id, fk_child_field, parentPkField.field_name, childTableName);
            }
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error("Gagal mencipta/mengemas kini hubungan:", error);
        return { success: false, message: error.message };
    }
});
