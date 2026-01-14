// main.js (Proses Utama Electron) - DIPERBETULKAN

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { Parser } = require("node-sql-parser");
const parser = new Parser();
const { spawn } = require('child_process');
const pluralize = require('pluralize');

// Tentukan laluan ke pangkalan data
const dbPath = path.join(app.getPath("userData"), "FiziSysMaker.db");
const dbExists = fs.existsSync(dbPath);
const db = new Database(dbPath);

// OPTIMASI: Tetapkan mod WAL dan busy_timeout untuk mengurangkan ralat 'database is locked'
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000'); // Tunggu sehingga 5 saat

// Logik First-Run
if (!dbExists) {
  //console.log("Pangkalan data tidak ditemui, mencipta skema baharu...");
  try {
    const schemaSql = fs.readFileSync(
      path.join(__dirname, '../resources/schema.sql'),
      "utf8"
    );
    db.exec(schemaSql);
    //console.log("Skema berjaya dicipta.");
  } catch (error) {
    console.error("Gagal mencipta skema pangkalan data:", error);
  }
}

//app.whenReady().then(() => {
//  // 2. TAMBAH BARIS INI sebelum mencipta tetingkap
//  Menu.setApplicationMenu(null);
//  
//  createWindow();
//});
// =================================================================
// ▼▼▼ SEMUA IPC HANDLER DIKUMPULKAN DI SINI UNTUK KONSISTENSI ▼▼▼
// =================================================================

ipcMain.handle('database:batch-update', async (event, queue) => {
    if (!queue) return { success: false, message: 'Queue is empty.' };

    const transaction = db.transaction(() => {
        // Kemas kini Projek
        if (queue.project && Object.keys(queue.project).length > 0) {
            const activeProject = db.prepare("SELECT project_id FROM projects WHERE is_active = 1").get();
            if (activeProject) {
                const { ...fieldsToUpdate } = queue.project;
                const setClause = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
                const values = Object.values(fieldsToUpdate);
                if (setClause) {
                    db.prepare(`UPDATE projects SET ${setClause} WHERE project_id = ?`).run(...values, activeProject.project_id);
                }
            }
        }

        // Kemas kini Jadual (DIPERBAIKI DENGAN LOGIK KEMAS KINI MENU)
if (queue.tables && Object.keys(queue.tables).length > 0) {
    for (const id in queue.tables) {
        const fieldsToUpdate = queue.tables[id];
        const newTableName = fieldsToUpdate.table_name;
        let oldTableName = null;

        // Semak jika nama jadual sedang dikemas kini
        if (newTableName) {
            const tableInfo = db.prepare('SELECT table_name FROM tables WHERE table_id = ?').get(id);
            if (tableInfo) {
                oldTableName = tableInfo.table_name;
            }
        }

        // Bina dan laksanakan kemas kini untuk jadual 'tables'
        const setClause = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
        const values = Object.values(fieldsToUpdate);
        if (setClause) {
            db.prepare(`UPDATE tables SET ${setClause} WHERE table_id = ?`).run(...values, id);
        }

        // ▼▼▼ KAWASAN INI TELAH DIPERBAIKI ▼▼▼
        // Jika nama jadual telah ditukar, kemas kini juga 'menu_items'
        if (oldTableName && newTableName && oldTableName !== newTableName) {
            const newUrl = `${newTableName} Resource`;

            // KEMAS KINI DIPERBAIKI: Kemas kini label dan URL berdasarkan table_id,
            // tanpa mengira apa nilai lama mereka. Ini memastikan konsistensi.
            db.prepare(
                'UPDATE menu_items SET item_label = ?, item_url = ? WHERE table_id = ?'
            ).run(newTableName, newUrl, id);
        }
        // ▲▲▲ TAMAT KAWASAN PEMBAIKAN ▲▲▲
    }
}
        // Kemas kini Medan
        if (queue.fields && Object.keys(queue.fields).length > 0) {
            for (const id in queue.fields) {
                const { ...fieldsToUpdate } = queue.fields[id];
                const setClause = Object.keys(fieldsToUpdate).map(key => `"${key}" = ?`).join(', ');
                const values = Object.values(fieldsToUpdate);
                 if (setClause) {
                    db.prepare(`UPDATE fields SET ${setClause} WHERE field_id = ?`).run(...values, id);
                }
            }
        }
        
        // Kemas kini Hubungan Parent/Child
        if (queue.relationships && Object.keys(queue.relationships).length > 0) {
             for (const id in queue.relationships) {
                const { ...fieldsToUpdate } = queue.relationships[id];
                const setClause = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
                const values = Object.values(fieldsToUpdate);
                 if (setClause) {
                    db.prepare(`UPDATE parent_child_relationships SET ${setClause} WHERE relationship_id = ?`).run(...values, id);
                }
            }
        }
        
        // Cipta/Kemas kini Hubungan (Upsert)
        if (queue.upserts && queue.upserts.length > 0) {
            const findStmt = db.prepare('SELECT relationship_id FROM parent_child_relationships WHERE fk_child_field = ? AND child_table_id = (SELECT table_id FROM tables WHERE table_name = ?)');
            const updateStmt = db.prepare('UPDATE parent_child_relationships SET parent_table_id = (SELECT table_id FROM tables WHERE table_name = ?) WHERE relationship_id = ?');
            const insertStmt = db.prepare('INSERT INTO parent_child_relationships (parent_table_id, child_table_id, fk_child_field, parent_field) VALUES ((SELECT table_id FROM tables WHERE table_name = ?), (SELECT table_id FROM tables WHERE table_name = ?), ?, (SELECT field_name FROM fields WHERE primary_key = 1 AND table_id = (SELECT table_id FROM tables WHERE table_name = ?)))');
            
            for(const rel of queue.upserts) {
                const existing = findStmt.get(rel.fk_child_field, rel.childTableName);
                if (existing) {
                    updateStmt.run(rel.parentTableName, existing.relationship_id);
                } else {
                    insertStmt.run(rel.parentTableName, rel.childTableName, rel.fk_child_field, rel.parentTableName);
                }
            }
        }

        // Padam Hubungan
        if (queue.relationshipDeletes && queue.relationshipDeletes.length > 0) {
            const deleteStmt = db.prepare(`
                DELETE FROM parent_child_relationships 
                WHERE fk_child_field = :fk_child_field 
                  AND child_table_id = (SELECT table_id FROM tables WHERE table_name = :childTableName)
            `);
            for (const rel of queue.relationshipDeletes) {
                deleteStmt.run(rel);
            }
        }
    });

    try {
        transaction();
        return { success: true };
    } catch (error) {
        console.error("Ralat semasa kemas kini berkelompok:", error);
        return { success: false, message: error.message };
    }
});

// PASTE THIS REPLACEMENT CODE IN: main.js

ipcMain.handle('menu:save-custom-item', async (event, { item_id, project_id, label, url, menu_group_id, table_id, custom_view_id, show_record_count }) => {
    try {
        if (!project_id) {
            throw new Error("Project ID is required.");
        }

        if (item_id && label === 'DELETE' && url === 'DELETE') {
            // Logic to delete an item
            db.prepare(
                `DELETE FROM menu_items WHERE item_id = ? AND project_id = ?`
            ).run(item_id, project_id);
        } else if (item_id) {
            // Logic to update an existing item
            db.prepare(
                `UPDATE menu_items 
                 SET item_label = ?, item_url = ?, menu_group_id = ?, table_id = ?, custom_view_id = ?, show_record_count = ? 
                 WHERE item_id = ? AND project_id = ?`
            ).run(label, url || null, menu_group_id || null, table_id || null, custom_view_id || null, show_record_count ? 1 : 0, item_id, project_id);

        } else {
            // Logic to insert a new item
            if (!label) {
                throw new Error("Label is required for a new menu item.");
            }

            // ... (kod sedia ada untuk mendapatkan nextOrder tidak berubah) ...
            let nextOrder;
            if (menu_group_id) {
                const maxOrderResult = db.prepare('SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id = ?').get(project_id, menu_group_id);
                nextOrder = (maxOrderResult?.max_order ?? -1) + 1;
            } else {
                const maxOrderResult = db.prepare('SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL').get(project_id);
                nextOrder = (maxOrderResult?.max_order ?? -1) + 1;
            }

            db.prepare(
                `INSERT INTO menu_items (project_id, table_id, custom_view_id, item_label, item_url, item_order, menu_group_id, show_record_count) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(project_id, table_id || null, custom_view_id || null, label, url || null, nextOrder, menu_group_id || null, show_record_count ? 1 : 0);
        }
        return { success: true };
    } catch (error) {
        console.error("Gagal menyimpan item menu:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('menu:update-individual-order', async (event, orderedItems) => {
    if (!Array.isArray(orderedItems)) {
        return { success: false, message: 'Invalid data format.' };
    }
    try {
        const updateStmt = db.prepare('UPDATE menu_items SET item_order = ? WHERE item_id = ?');
        const transaction = db.transaction(() => {
            for (const item of orderedItems) {
                updateStmt.run(item.order, item.item_id);
            }
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error("Gagal mengemas kini susunan menu individu:", error);
        return { success: false, message: error.message };
    }
});

// ADD THIS ENTIRE NEW HANDLER ANYWHERE IN: src/main.js

ipcMain.handle('menu:delete-group', async (event, { groupId }) => {
    if (!groupId) {
        return { success: false, message: "Group ID is required." };
    }
    try {
        const transaction = db.transaction(() => {
            // Padam semua item yang tergolong dalam kumpulan ini
            db.prepare('DELETE FROM menu_items WHERE menu_group_id = ?').run(groupId);
            // Padam kumpulan itu sendiri
            db.prepare('DELETE FROM menu_groups WHERE menu_group_id = ?').run(groupId);
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error("Gagal memadam kumpulan menu:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('menu:create-group', async (event, { projectId, groupName }) => {
    if (!projectId) {
        return { success: false, message: "Project ID is required." };
    }
    try {
        const maxOrderResult = db.prepare(
            'SELECT MAX(COALESCE(group_order, 0)) as max_order FROM menu_groups WHERE project_id = ?'
        ).get(projectId);
        
        const nextOrder = (maxOrderResult?.max_order ?? -1) + 1;

        const info = db.prepare(
            'INSERT INTO menu_groups (project_id, group_name, group_order) VALUES (?, ?, ?)'
        ).run(projectId, groupName, nextOrder);
        
        const newGroup = db.prepare('SELECT * FROM menu_groups WHERE menu_group_id = ?').get(info.lastInsertRowid);
        
        return { success: true, group: newGroup };
    } catch (error) {
        console.error("Gagal mencipta kumpulan menu:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('sql:parse-calculation-query', (event, sql) => {
    // ▼▼▼ TAMBAH DUA BARIS INI UNTUK DIAGNOSIS ▼▼▼
    console.log("--- SQL received by backend parser ---");
    //console.log(sql);
    // ▲▲▲ TAMAT TAMBAHAN ▲▲▲

    if (!sql) {
        return { success: false, error: 'Empty query string.' };
    }
    try {
        const ast = parser.astify(sql, { database: 'MySQL' });
        // Hantar pokok sintaks (AST) kembali ke frontend
        return { success: true, data: ast };
    } catch (error) {
        // Hantar mesej ralat jika penterjemahan gagal
        console.warn('SQL parsing failed:', error.message);
        return { success: false, error: error.message };
    }
});

// FIND AND REPLACE this entire function in your src/main.js file

async function getFullProjectSchema(projectId) {
  try {
    const project = db
      .prepare("SELECT * FROM projects WHERE project_id = ?")
      .get(projectId);
    if (!project)
      throw new Error(`Projek dengan ID ${projectId} tidak ditemui.`);

    const tables = db
      .prepare("SELECT * FROM tables WHERE project_id = ? ORDER BY table_order, table_id")
      .all(projectId);
    const tableIds = tables.map((t) => t.table_id);

    if (tableIds.length === 0) {
        return {
            project,
            database: { name: project.app_title, table: {}, relationships: [], unified_menu: [] },
        };
    }

    const placeholder = tableIds.map(() => "?").join(",");
    const fields = db.prepare(`SELECT * FROM fields WHERE table_id IN (${placeholder}) ORDER BY field_order, field_id`).all(...tableIds);
    const constraints = db.prepare(`SELECT * FROM table_constraints WHERE table_id IN (${placeholder})`).all(...tableIds);
    
    let customViews = db.prepare(`SELECT * FROM custom_views WHERE table_id IN (${placeholder}) ORDER BY view_order`).all(...tableIds);
    const viewIds = customViews.map(v => v.custom_view_id);
    let customViewFields = [];
    if (viewIds.length > 0) {
        const viewPlaceholder = viewIds.map(() => "?").join(",");
        customViewFields = db.prepare(`SELECT * FROM custom_view_fields WHERE custom_view_id IN (${viewPlaceholder}) ORDER BY display_order`).all(...viewIds);
    }

    const structuredTables = {};
    tables.forEach((table) => {
      const viewsForTable = customViews.filter(v => v.table_id === table.table_id);
      viewsForTable.forEach(view => {
          view.fields = customViewFields.filter(f => f.custom_view_id === view.custom_view_id);
      });

      structuredTables[table.table_name] = { 
          ...table, 
          fields: {}, 
          custom_views: viewsForTable,
          constraints: constraints.filter(c => c.table_id === table.table_id)
      };
    });

    fields.forEach((field) => {
      const parentTable = tables.find((t) => t.table_id === field.table_id);
      if (parentTable) {
        structuredTables[parentTable.table_name].fields[field.field_name] = field;
      }
    });

    let relationships = db
        .prepare(
          `SELECT r.*, p.table_name as parent_table_name, c.table_name as child_table_name
           FROM parent_child_relationships r
           JOIN tables p ON r.parent_table_id = p.table_id
           JOIN tables c ON r.child_table_id = c.table_id
           WHERE r.parent_table_id IN (${placeholder}) OR r.child_table_id IN (${placeholder})`
        )
        .all(...tableIds, ...tableIds);
    
    // ▼▼▼ MULA LOGIK PEMBETULAN ▼▼▼
    const allItems = db.prepare(`
        SELECT mi.*, t.table_name 
        FROM menu_items mi 
        LEFT JOIN tables t ON mi.table_id = t.table_id 
        WHERE mi.project_id = ? 
        ORDER BY mi.item_order
    `).all(projectId);
    
    const groups = db.prepare("SELECT * FROM menu_groups WHERE project_id = ? ORDER BY group_order").all(projectId);
    const unifiedMenu = [];

    // Proses kumpulan dan sediakan 'map' untuk item di dalamnya
    const groupMap = new Map();
    groups.forEach(group => {
        const groupItems = allItems
            .filter(item => item.menu_group_id === group.menu_group_id)
            .map(item => {
                let itemType = 'custom_item';
                if (item.table_id) itemType = 'table_item';
                else if (item.custom_view_id) itemType = 'custom_view_item';
                return { type: itemType, ...item };
            });

        const groupObject = { 
            type: 'group', 
            id: group.menu_group_id, 
            order: group.group_order, 
            name: group.group_name, 
            items: groupItems
        };
        unifiedMenu.push(groupObject);
        groupMap.set(group.group_order, groupObject);
    });
    
    // Proses item peringkat atasan
    allItems.forEach(item => {
        if (item.menu_group_id === null) {
            let itemType = 'custom_item';
            if (item.table_id) itemType = 'table_item';
            else if (item.custom_view_id) itemType = 'custom_view_item';
            
            unifiedMenu.push({ 
                type: itemType,
                order: item.item_order, // Gunakan item_order untuk susunan
                ...item 
            });
        }
    });

    // Akhir sekali, susun semula keseluruhan senarai berdasarkan 'order'
    unifiedMenu.sort((a, b) => a.order - b.order);
    // ▲▲▲ TAMAT LOGIK PEMBETULAN ▲▲▲

    return {
      project: project,
      database: {
        name: project.app_title,
        table: structuredTables,
        relationships: relationships,
        unified_menu: unifiedMenu,
      },
    };
  } catch (error) {
    console.error("Gagal mengambil skema penuh:", error);
    return null;
  }
}

ipcMain.handle('table:update-order', async (event, orderData) => {
    try {
        const updateStmt = db.prepare('UPDATE tables SET table_order = ? WHERE table_id = ?');
        
        const transaction = db.transaction(() => {
            for (const item of orderData) {
                updateStmt.run(item.order, item.table_id);
            }
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error("Gagal mengemas kini susunan jadual:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('field:update-order', async (event, orderData) => {
    try {
        const updateStmt = db.prepare('UPDATE fields SET field_order = ? WHERE field_id = ?');
        
        const transaction = db.transaction(() => {
            for (const item of orderData) {
                updateStmt.run(item.order, item.field_id);
            }
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error("Gagal mengemas kini susunan medan:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('field:delete', async (event, { fieldId, tableName, fieldName }) => {
    try {
        const transaction = db.transaction(() => {
            // Dapatkan ID jadual anak
            const childTable = db.prepare('SELECT table_id FROM tables WHERE table_name = ?').get(tableName);
            if (!childTable) return;

            // 1. Padam hubungan di mana medan ini adalah kunci asing (foreign key)
            db.prepare('DELETE FROM parent_child_relationships WHERE child_table_id = ? AND fk_child_field = ?')
              .run(childTable.table_id, fieldName);

            // 2. Kosongkan rujukan 'lookup_caption' yang menggunakan medan ini
            db.prepare("UPDATE fields SET lookup_caption_1 = '' WHERE lookup_caption_1 = ?")
              .run(fieldName);
            db.prepare("UPDATE fields SET lookup_caption_2 = '' WHERE lookup_caption_2 = ?")
              .run(fieldName);

            // 3. Akhir sekali, padam medan itu sendiri
            db.prepare('DELETE FROM fields WHERE field_id = ?').run(fieldId);
        });

        transaction();
        return { success: true };
    } catch (error){
        console.error("Gagal memadam medan:", error);
        return { success: false, message: error.message };
    }
});

// Handler untuk mencipta medan baharu
ipcMain.handle('field:create', async (event, tableId) => {
    try {
        const settings = db.prepare("SELECT setting_name, setting_value FROM fizisys_settings WHERE setting_name IN ('field_default_type', 'field_default_length')").all();
        const defaultSettings = settings.reduce((acc, setting) => {
            acc[setting.setting_name] = setting.setting_value;
            return acc;
        }, {});
        
        const defaultType = defaultSettings.field_default_type || 'VARCHAR';
        const defaultLength = defaultSettings.field_default_length || 255;
		
        let newName;
        let isUnique = false;
        const checkStmt = db.prepare('SELECT field_id FROM fields WHERE table_id = ? AND field_name = ?');
        
        while (!isUnique) {
            const randomChars = Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * 26))).join('');
            newName = `field_${randomChars}`;
            const existingField = checkStmt.get(tableId, newName);
            if (!existingField) {
                isUnique = true;
            }
        }
        
        const transaction = db.transaction(() => {
            const createdAtField = db.prepare(
                "SELECT field_order FROM fields WHERE table_id = ? AND field_name = 'created_at'"
            ).get(tableId);

            let targetOrder;

            if (createdAtField) {
                targetOrder = createdAtField.field_order;
                db.prepare(
                    "UPDATE fields SET field_order = field_order + 1 WHERE table_id = ? AND field_order >= ?"
                ).run(tableId, targetOrder);
            } else {
                const maxOrderResult = db.prepare('SELECT MAX(field_order) as max_order FROM fields WHERE table_id = ?').get(tableId);
                targetOrder = (maxOrderResult && maxOrderResult.max_order !== null ? maxOrderResult.max_order : -1) + 1;
            }
            
            let isRangeFilterDefault = 0;
            const dateTypes = ['DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR'];
            if(dateTypes.includes(defaultType.toUpperCase())) {
                isRangeFilterDefault = 1;
            }

            // ▼▼▼ UBAH SUAI 'INSERT' DI SINI ▼▼▼
            const info = db.prepare(
                `INSERT INTO fields (
                    table_id, field_name, caption, data_type, length, field_order, 
                    enable_global_filter, enable_individual_filter, enable_range_filter, allow_sorting
                 ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, 1)`
            ).run(tableId, newName, newName, defaultType, defaultLength, targetOrder, isRangeFilterDefault);
            // ▲▲▲ TAMAT UBAH SUAI ▲▲▲

            return info.lastInsertRowid;
        });

        const newFieldId = transaction();
        return db.prepare('SELECT * FROM fields WHERE field_id = ?').get(newFieldId);

    } catch (error) {
        console.error("Gagal mencipta medan baharu:", error);
        return null;
    }
});

// Handler untuk memadam jadual
ipcMain.handle('table:delete', async (event, { projectId, tableNamesToDelete }) => {
    try {
        if (!projectId || !tableNamesToDelete || tableNamesToDelete.length === 0) {
            throw new Error("ID Projek atau nama jadual tidak dibekalkan.");
        }

        const transaction = db.transaction(() => {
            const getTableId = db.prepare('SELECT table_id FROM tables WHERE project_id = ? AND table_name = ?');
            
            // ▼▼▼ MULA PERUBAHAN ▼▼▼
            const deleteMenuItem = db.prepare('DELETE FROM menu_items WHERE table_id = ?');
            // ▲▲▲ TAMAT PERUBAHAN ▲▲▲
            
            const deleteTable = db.prepare('DELETE FROM tables WHERE table_id = ?');

            for (const tableName of tableNamesToDelete) {
                const table = getTableId.get(projectId, tableName);
                if (table) {
                    // ▼▼▼ MULA LOGIK BAHARU ▼▼▼
                    // 1. Padam item menu terlebih dahulu
                    deleteMenuItem.run(table.table_id);
                    // 2. Kemudian, padam jadual (akan mengaktifkan ON DELETE CASCADE untuk medan, dll.)
                    deleteTable.run(table.table_id);
                    // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲
                }
            }
        });

        transaction();
        return { success: true };

    } catch (error) {
        console.error("Gagal memadam jadual:", error);
        return { success: false, message: error.message };
    }
});

// Handler untuk mencipta jadual baharu
ipcMain.handle('table:create', async (event, projectId) => {
    try {
        let newName;
        let isUnique = false;
        const checkStmt = db.prepare('SELECT table_id FROM tables WHERE project_id = ? AND table_name = ?');

        while (!isUnique) {
            const randomChars = Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * 26))).join('');
            newName = `table_${randomChars}`;
            const existingTable = checkStmt.get(projectId, newName);
            if (!existingTable) {
                isUnique = true;
            }
        }

        const maxOrderResult = db.prepare('SELECT MAX(table_order) as max_order FROM tables WHERE project_id = ?').get(projectId);
        const nextOrder = (maxOrderResult ? (maxOrderResult.max_order || 0) : 0) + 1;

        const transaction = db.transaction(() => {
            const info = db.prepare(
                'INSERT INTO tables (project_id, table_name, table_view_title, table_order) VALUES (?, ?, ?, ?)'
            ).run(projectId, newName, newName, nextOrder);
            const tableId = info.lastInsertRowid;

            // ▼▼▼ PERUBAHAN DI SINI ▼▼▼
            // Tambah `hide_in_tv` pada senarai lajur
            const insertFieldStmt = db.prepare(`
                INSERT INTO fields (table_id, field_name, caption, data_type, length, primary_key, auto_increment, unsigned, read_only, field_order, hide_in_tv)
                VALUES (@table_id, @field_name, @caption, @data_type, @length, @primary_key, @auto_increment, @unsigned, @read_only, @field_order, @hide_in_tv)
            `);

            // 1a. Cipta medan 'id' dan tetapkan hide_in_tv = 1
            insertFieldStmt.run({
                table_id: tableId, field_name: 'id', caption: 'ID', data_type: 'INT',
                length: 11, primary_key: 1, auto_increment: 1, unsigned: 1, read_only: 1, field_order: 0, hide_in_tv: 1
            });

            const timestamps = [
                { name: 'created_at', caption: 'Created At', order: 1 },
                { name: 'updated_at', caption: 'Updated At', order: 2 },
                { name: 'deleted_at', caption: 'Deleted At', order: 3 }
            ];

            // 1b. Cipta medan cap masa dan tetapkan hide_in_tv = 1
            for (const ts of timestamps) {
                insertFieldStmt.run({
                    table_id: tableId, field_name: ts.name, caption: ts.caption, data_type: 'DATETIME',
                    length: null, primary_key: 0, auto_increment: 0, unsigned: 0, read_only: 0, field_order: ts.order, hide_in_tv: 1
                });
            }
            // ▲▲▲ TAMAT PERUBAHAN ▲▲▲
            
            const maxMenuOrderResult = db.prepare(
                'SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL'
            ).get(projectId);
            const nextMenuOrder = (maxMenuOrderResult && maxMenuOrderResult.max_order !== null ? maxMenuOrderResult.max_order : -1) + 1;
            
            const itemUrl = `${newName} Resource`;
            db.prepare(
                'INSERT INTO menu_items (project_id, table_id, item_label, item_url, item_order, menu_group_id) VALUES (?, ?, ?, ?, ?, NULL)'
            ).run(projectId, tableId, newName, itemUrl, nextMenuOrder);
            
            return tableId;
        });

        const newTableId = transaction();
        return db.prepare('SELECT * FROM tables WHERE table_id = ?').get(newTableId);

    } catch (error) {
        console.error("Gagal mencipta jadual baharu:", error);
        return null;
    }
});

ipcMain.handle("project:get-full-schema", async (event, projectId) => {
    // Panggilan ini kini akan menggunakan fungsi yang lebih berkuasa di atas
    return getFullProjectSchema(projectId);
});

// FIND AND REPLACE this entire handler in your src/main.js file

ipcMain.handle('menu:save-unified-structure', async (event, { projectId, menuStructure }) => {
    if (!projectId || !Array.isArray(menuStructure)) {
        return { success: false, message: "Data tidak sah." };
    }
    
    const transaction = db.transaction(() => {
        const updateGroupStmt = db.prepare('UPDATE menu_groups SET group_name = ?, group_order = ? WHERE menu_group_id = ?');
        const updateItemStmt = db.prepare('UPDATE menu_items SET item_order = ?, menu_group_id = ? WHERE item_id = ?');

        // Set semua item sebagai peringkat atasan dahulu untuk mengendalikan item yang dialihkan keluar dari kumpulan.
        db.prepare('UPDATE menu_items SET menu_group_id = NULL WHERE project_id = ?').run(projectId);
        
        // ▼▼▼ MULA LOGIK PEMBETULAN ▼▼▼
        // Gunakan satu indeks tunggal (topIndex) untuk KEDUA-DUA jadual.
        menuStructure.forEach((topLevelItem, topIndex) => {
            if (topLevelItem.type === 'group') {
                // Gunakan 'topIndex' untuk group_order
                updateGroupStmt.run(topLevelItem.name, topIndex, topLevelItem.id);

                // Kemas kini item di dalam kumpulan (susunan dalaman)
                topLevelItem.items.forEach((childItem, childIndex) => {
                    updateItemStmt.run(childIndex, topLevelItem.id, childItem.id);
                });
            } else { // type 'table_item' atau 'custom_item'
                // Gunakan 'topIndex' untuk item_order
                updateItemStmt.run(topIndex, null, topLevelItem.id);
            }
        });
        // ▲▲▲ TAMAT LOGIK PEMBETULAN ▲▲▲
    });

    try {
        transaction();
        return { success: true };
    } catch (error) {
        console.error("Gagal menyimpan struktur menu bersepadu:", error);
        return { success: false, message: error.message };
    }
});

// Handler untuk pengurusan projek
ipcMain.handle("project:get-active", async () => {
  return db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
});

ipcMain.handle("project:create", async (event, projectName) => {
  try {
    const createProjectTransaction = db.transaction(() => {
        // 1. Set semua projek lain sebagai tidak aktif
        db.prepare("UPDATE projects SET is_active = 0").run();

        // 2. Cipta rekod projek baharu
        const projectInfo = db.prepare("INSERT INTO projects (app_title, is_active) VALUES (?, 1)").run(projectName);
        const projectId = projectInfo.lastInsertRowid;

        // ▼▼▼ MULA LOGIK BAHARU: Cipta jadual 'users' secara automatik ▼▼▼

        // 3. Cipta rekod untuk jadual 'users'
        const tableInfo = db.prepare(
            'INSERT INTO tables (project_id, table_name, table_view_title, table_order) VALUES (?, ?, ?, ?)'
        ).run(projectId, 'users', 'Users', 0);
        const tableId = tableInfo.lastInsertRowid;

        // 4. Cipta item menu untuk jadual 'users'
        const menuUrl = 'users Resource';
        db.prepare(
            'INSERT INTO menu_items (project_id, table_id, item_label, item_url, item_order) VALUES (?, ?, ?, ?, ?)'
        ).run(projectId, tableId, 'Users', menuUrl, 0);

        // 5. Definisikan dan cipta semua medan untuk jadual 'users'
        const fieldsToCreate = [
            { name: 'id', caption: 'ID', type: 'BIGINT', length: 20, unsigned: 1, pk: 1, auto_increment: 1, read_only: 1, order: 0 },
            { name: 'name', caption: 'Name', type: 'VARCHAR', length: 255, required: 1, order: 1 },
            { name: 'email', caption: 'Email', type: 'VARCHAR', length: 255, required: 1, unique: 1, order: 2 },
            { name: 'email_verified_at', caption: 'Email Verified At', type: 'TIMESTAMP', required: 0, order: 3 },
            { name: 'password', caption: 'Password', type: 'VARCHAR', length: 255, required: 1, order: 4 },
            { name: 'remember_token', caption: 'Remember Token', type: 'VARCHAR', length: 100, required: 0, order: 5 },
            { name: 'created_at', caption: 'Created At', type: 'TIMESTAMP', required: 0, order: 6 },
            { name: 'updated_at', caption: 'Updated At', type: 'TIMESTAMP', required: 0, order: 7 },
            { name: 'deleted_at', caption: 'Deleted At', type: 'TIMESTAMP', required: 0, order: 8 }
        ];

        const insertFieldStmt = db.prepare(`
            INSERT INTO fields (
                table_id, field_name, caption, data_type, length, "unique",
                required, primary_key, auto_increment, unsigned, read_only, field_order
            ) VALUES (
                @table_id, @field_name, @caption, @data_type, @length, @unique,
                @required, @primary_key, @auto_increment, @unsigned, @read_only, @field_order
            )
        `);

        for (const field of fieldsToCreate) {
            insertFieldStmt.run({
                table_id: tableId,
                field_name: field.name,
                caption: field.caption,
                data_type: field.type,
                length: field.length || null,
                unique: field.unique || 0,
                required: field.required || 0,
                primary_key: field.pk || 0,
                auto_increment: field.auto_increment || 0,
                unsigned: field.unsigned || 0,
                read_only: field.read_only || 0,
                field_order: field.order
            });
        }
        // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲

        return projectId;
    });

    const newProjectId = createProjectTransaction();
    return db.prepare("SELECT * FROM projects WHERE project_id = ?").get(newProjectId);

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

/**
 * Mengendalikan semakan pra-import: memberi amaran kepada pengguna dan memadam jadual lama jika perlu.
 * @param {BrowserWindow} win - Tetingkap utama aplikasi untuk melampirkan dialog.
 * @param {number} projectId - ID projek semasa.
 * @param {string} sqlContent - Kandungan penuh skrip SQL yang akan diimport.
 * @returns {Promise<boolean>} - Mengembalikan 'true' jika import boleh diteruskan, 'false' jika dibatalkan.
 */
// FIND AND REPLACE this entire function in your src/main.js file

async function handleImportPreflight(win, projectId, sqlContent) {
  const existingTables = db.prepare('SELECT table_name FROM tables WHERE project_id = ?').all(projectId);

  if (existingTables.length === 0) {
    return true; // No tables, proceed without warning.
  }

  const sqlDefinesUsers = /CREATE\s+TABLE\s+[`'"]?users[`'"]?/i.test(sqlContent);
  let detailMessage = "This project already has tables. Importing a new schema will delete existing data.\n\n";
  const tablesToDelete = [];

  if (sqlDefinesUsers) {
    detailMessage += "The imported SQL defines a 'users' table. ALL existing tables, including the current 'users' table, will be DELETED. Continue?";
    tablesToDelete.push(...existingTables.map(t => t.table_name));
  } else {
    detailMessage += "The existing 'users' table will be preserved. All OTHER tables will be DELETED. Continue?";
    tablesToDelete.push(...existingTables.filter(t => t.table_name !== 'users').map(t => t.table_name));
  }

  if (tablesToDelete.length === 0) {
      return true;
  }

  // ▼▼▼ MULA PERUBAHAN: Gantikan dialog natif dengan sistem modal custom ▼▼▼
  const userConfirmed = await new Promise(resolve => {
      ipcMain.once('custom-dialog-response', (event, response) => {
          resolve(response); // response will be true for OK, false for Cancel
      });
      win.webContents.send('show-custom-dialog', {
          type: 'warning',
          buttons: ['OK', 'Cancel'],
          title: 'Confirm Import',
          message: 'Warning: Overwrite Existing Schema?',
          detail: detailMessage,
      });
  });

  if (!userConfirmed) { // User clicked 'Cancel' or closed the modal
    return false;
  }
  // ▲▲▲ TAMAT PERUBAHAN ▲▲▲

  // Proceed with deletion
  try {
    const deleteTransaction = db.transaction(() => {
      const getTableId = db.prepare('SELECT table_id FROM tables WHERE project_id = ? AND table_name = ?');
      const deleteMenuItem = db.prepare('DELETE FROM menu_items WHERE table_id = ?');
      const deleteTable = db.prepare('DELETE FROM tables WHERE table_id = ?');

      for (const tableName of tablesToDelete) {
        const table = getTableId.get(projectId, tableName);
        if (table) {
          deleteMenuItem.run(table.table_id);
          deleteTable.run(table.table_id);
        }
      }
    });
    deleteTransaction();
    return true;
  } catch (error) {
    console.error("Gagal memadam skema lama:", error);
    // Since we can't use the native dialog easily here, we'll rely on console logs for this specific error
    return false;
  }
}

// FIND AND REPLACE this entire function in your src/main.js file

// FIND AND REPLACE this entire function in your src/main.js file

function importSchema(sql, projectId, dialect) {
    const dialectMap = {
        'MySQL': 'mysql', 'PostgreSQL': 'postgresql', 'TSQL': 'mysql', 'SQLite': 'sqlite'
    };
    const parserDialect = dialectMap[dialect] || 'mysql';

    let tablesCreated = 0;
    let relationshipsCreated = 0;
    const tableMap = {};
    const standardizationLog = {};

    let processedSql = sql;
    if (dialect === 'TSQL') {
        processedSql = processedSql.replace(/^GO\s*$/gim, '').replace(/IDENTITY\s*\(\d+\s*,\s*\d+\)/gi, 'AUTO_INCREMENT').replace(/\((MAX)\)/gi, '').replace(/\b(NVARCHAR|VARCHAR|TEXT)\s*(?!\()/gi, 'TEXT ').replace(/GETDATE\(\)/gi, 'CURRENT_TIMESTAMP').replace(/\bN(VARCHAR|CHAR|TEXT)\b/gi, '$1').replace(/\bDATETIME2\b/gi, 'DATETIME');
    }
    if (dialect === 'SQLite') {
        processedSql = processedSql.replace(/^PRAGMA.*?;/gim, '');
    }
    if (dialect === 'MySQL') {
        processedSql = processedSql.replace(/\s+ENGINE=\w+\s*DEFAULT\s*CHARSET=\w+(\s*COLLATE=\w+)?(\s*COMMENT='.*?')?;/gi, ";");
    }
    
    const getFieldNameFromAST = (columnRef) => {
        if (!columnRef || !columnRef.column) return 'parse_error';
        if (typeof columnRef.column === 'string') return columnRef.column;
        if (typeof columnRef.column === 'object' && columnRef.column.expr && columnRef.column.expr.value) { return columnRef.column.expr.value; }
        return String(columnRef.column);
    };
    
    const extractDefaultValue = (defaultNode) => {
        if (!defaultNode || !defaultNode.value) return null;
        const valueNode = defaultNode.value;
        if (valueNode.type === "null") return "NULL";
        if (["single_quote_string", "number"].includes(valueNode.type)) return String(valueNode.value);
        if (valueNode.type === "function" && Array.isArray(valueNode.name?.name)) return valueNode.name.name.map(part => part.value).join('.');
        return null;
    };
    
    const toTitleCase = (str) => {
        if (!str) return '';
        return str
            // Ganti snake_case (cth: bas_sekolah) dan kebab-case (cth: bas-sekolah) dengan ruang
            .replace(/[_-]/g, ' ')
            // Masukkan ruang untuk camelCase (cth: basSekolah -> bas Sekolah)
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            // Jadikan semua huruf pertama bagi setiap perkataan huruf besar
            .replace(/\b\w/g, char => char.toUpperCase());
    };
    
    const getConstraintName = (rule) => {
        let name = rule.index || rule.constraint;
        if (name && typeof name === 'object') {
            name = name.value;
        }
        return (name || '').trim() || null;
    };

    // ▼▼▼ PETA PENTERJEMAHAN JENIS DATA (DATA TYPE NORMALIZATION MAP) ▼▼▼
    const dataTypeNormalizationMap = {
        'INTEGER': 'INT',
        'SERIAL': 'INT',
        'BIGSERIAL': 'BIGINT',
        'CHARACTER VARYING': 'VARCHAR',
        'BOOLEAN': 'TINYINT',
        'BOOL': 'TINYINT',
        'REAL': 'DOUBLE',
        'NUMERIC': 'DECIMAL',
        'MONEY': 'DECIMAL',
        'SMALLMONEY': 'DECIMAL',
        'BIT': 'TINYINT',
        'INT2': 'SMALLINT',
        'INT4': 'INT',
        'INT8': 'BIGINT',
        'FLOAT4': 'FLOAT',
        'FLOAT8': 'DOUBLE',
    };
    // ▲▲▲ TAMAT PETA PENTERJEMAHAN ▲▲▲
	
    let tableOrder = 0;

    const transaction = db.transaction((ast) => {
        const insertConstraintStmt = db.prepare('INSERT INTO table_constraints (table_id, constraint_name, constraint_type, columns) VALUES (?, ?, ?, ?)');
        const getMaxMenuOrderStmt = db.prepare('SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL');
        const insertMenuItemStmt = db.prepare('INSERT INTO menu_items (project_id, table_id, item_label, item_url, item_order, menu_group_id) VALUES (?, ?, ?, ?, ?, NULL)');
        // Dalam fungsi importSchema
        const insertFieldStmt = db.prepare(`INSERT INTO fields (table_id, field_name, data_type, length, precision, required, auto_increment, unsigned, zero_fill, primary_key, "unique", not_null, is_indexed, read_only, default_value, caption, field_order) VALUES (@table_id, @field_name, @data_type, @length, @precision, @required, @auto_increment, @unsigned, @zero_fill, @primary_key, @unique, @not_null, @is_indexed, @read_only, @default_value, @caption, @field_order)`);

        
        const foreignKeysToProcess = [];

        for (const statement of ast) {
            if (statement.type !== "create" || statement.keyword !== "table") continue;
            
            const tableName = statement.table[0].table.trim();
            const tableViewTitle = toTitleCase(tableName);
            
            const tableInfo = db.prepare("INSERT INTO tables (project_id, table_name, table_view_title, table_order) VALUES (?, ?, ?, ?)").run(projectId, tableName, tableViewTitle, tableOrder++);
            const tableId = tableInfo.lastInsertRowid;
            tablesCreated++;
            tableMap[tableName] = tableId;

            const maxMenuOrderResult = getMaxMenuOrderStmt.get(projectId);
            const nextMenuOrder = (maxMenuOrderResult?.max_order ?? -1) + 1;
            insertMenuItemStmt.run(projectId, tableId, tableViewTitle, `${tableName} Resource`, nextMenuOrder);

            const definitions = statement.create_definitions || [];
            const fieldDataMap = new Map();
            const tableLevelRules = [];

            definitions.forEach((definition, index) => {
                if (definition.resource === 'column') {
                    const fieldName = getFieldNameFromAST(definition.column).trim();
                    const caption = toTitleCase(fieldName);
                    
                    // ▼▼▼ MULA LOGIK PENORMALAN JENIS DATA ▼▼▼
                    let rawDataType = (definition.definition.dataType || '').trim().toUpperCase();
                    const isSerial = ['SERIAL', 'BIGSERIAL'].includes(rawDataType);
                    let normalizedDataType = dataTypeNormalizationMap[rawDataType] || rawDataType;
                    
                    if (Array.isArray(definition.definition.suffix) && definition.definition.suffix.length > 0) {
                        const suffixStr = definition.definition.suffix.join(' ').toUpperCase();
                        if (suffixStr === 'UNSIGNED') {
                            normalizedDataType += ' ' + suffixStr;
                        }
                    }
                    if (!normalizedDataType) normalizedDataType = 'TEXT';
                    // ▲▲▲ TAMAT LOGIK PENORMALAN ▲▲▲
                    
                    const fieldData = {
                        table_id: tableId,
                        field_name: fieldName,
                        caption: caption,
                        field_order: index,
                        data_type: normalizedDataType,
                        length: definition.definition.length || null,
                        precision: definition.definition.scale || null,
                        required: 0, auto_increment: 0, unsigned: 0, zero_fill: 0, primary_key: 0, "unique": 0,
                        not_null: 0, // <--- TAMBAH INI
                        is_indexed: 0, read_only: 0, default_value: null,
                    };
                    
                    if (definition.auto_increment || definition.autoincrement || isSerial) fieldData.auto_increment = 1;
                    const isNotNull = 
                        (definition.nullable?.type && definition.nullable.type.toLowerCase() === "not null") || 
                        (definition.nullable?.value && definition.nullable.value.toLowerCase() === "not null") ||
                        (Array.isArray(definition.nullable) && definition.nullable.includes("not null"));

                    if (isNotNull) {
                        fieldData.not_null = 1;
                        // Jika bukan auto_increment, kita anggap ia required (wajib diisi dalam borang)
                        if (!fieldData.auto_increment) fieldData.required = 1;
                    }
                    if (definition.unsigned) fieldData.unsigned = 1;
                    if (definition.zerofill) fieldData.zero_fill = 1;
                    if (definition.default_val) {
                        let defaultValue = extractDefaultValue(definition.default_val);
                        if(typeof defaultValue === 'string') {
                            fieldData.default_value = defaultValue.trim();
                        }
                    }
                    if (definition.primary_key === 'primary key') { fieldData.primary_key = 1; fieldData.read_only = 1; }
                    if (definition.unique === 'unique') fieldData.unique = 1;
                    
                    (definition.constraints || []).forEach(constraint => {
                        const type = constraint.definition.constraint_type.toLowerCase();
                        if (type === "primary key") { fieldData.primary_key = 1; fieldData.read_only = 1; }
                        if (type === "unique key" || type === "unique") { fieldData.unique = 1; }
                        if (type === "not null") { 
                                fieldData.required = 1; 
                                fieldData.not_null = 1; // <--- Tambah ini
                            }
                    });
                    
                    // Tetapkan hide_in_tv = 1 secara lalai untuk medan tertentu
                    const protectedFields = ['created_at', 'updated_at', 'deleted_at'];
                    if (fieldData.primary_key === 1 || protectedFields.includes(fieldName)) {
                        fieldData.hide_in_tv = 1;
                    }
                    if (normalizedDataType === 'TEXT' || normalizedDataType === 'LONGTEXT') {
                        fieldData.tv_wrap_text = 1;
                    }   
                    fieldDataMap.set(fieldName, fieldData);
                } else {
                    tableLevelRules.push(definition);
                }
            });

            // ... (baki kod di bawah ini tidak berubah) ...
            
            tableLevelRules.forEach(rule => {
                const ruleType = rule.constraint_type?.toLowerCase() || rule.keyword;
                const columns = (rule.definition || []).map(c => getFieldNameFromAST(c).trim());
                if (columns.length === 0) return;
                const constraintName = getConstraintName(rule);
                if (ruleType === "primary key") {
                    columns.forEach(fieldName => { if (fieldDataMap.has(fieldName)) { fieldDataMap.get(fieldName).primary_key = 1; fieldDataMap.get(fieldName).read_only = 1; } });
                } else if (ruleType === "unique key" || ruleType === "unique") {
                    if (columns.length === 1 && fieldDataMap.has(columns[0])) { fieldDataMap.get(columns[0]).unique = 1; } 
                    else if (columns.length > 1) { insertConstraintStmt.run(tableId, constraintName, 'UNIQUE', JSON.stringify(columns)); }
                } else if (ruleType === "index" || ruleType === "key") {
                    if (columns.length === 1 && fieldDataMap.has(columns[0])) { fieldDataMap.get(columns[0]).is_indexed = 1; } 
                    else if (columns.length > 1) { insertConstraintStmt.run(tableId, constraintName, 'INDEX', JSON.stringify(columns)); }
                } else if (ruleType === "foreign key") {
                    const ref = rule.reference_definition;
                    if (ref) { 
                        // Ekstrak ON DELETE dan ON UPDATE dari AST
                        let onDelete = 'NO ACTION';
                        let onUpdate = 'NO ACTION';

                if (ref.on_action) {
                            ref.on_action.forEach(action => {
                                const type = action.type.toLowerCase();
                                
                                // PEMBETULAN: Semak jenis data 'value' sebelum guna .toUpperCase()
                                let valStr = 'NO ACTION';
                                if (typeof action.value === 'string') {
                                    valStr = action.value;
                                } else if (action.value && typeof action.value === 'object' && action.value.value) {
                                    // Kadang-kadang parser bungkus dalam objek { type: 'origin', value: 'CASCADE' }
                                    valStr = action.value.value;
                                }

                                const value = valStr.toUpperCase();

                                if (type === 'on delete') onDelete = value;
                                if (type === 'on update') onUpdate = value;
                            });
                        }

                        foreignKeysToProcess.push({ 
                            childTableName: tableName, 
                            parentTableName: ref.table[0].table, 
                            fkChildField: columns[0], 
                            parentField: getFieldNameFromAST(ref.definition[0]),
                            onDelete: onDelete, // Simpan data ini
                            onUpdate: onUpdate  // Simpan data ini
                        }); 
                    }
                }
            });
            
            for (const fieldData of fieldDataMap.values()) {
                insertFieldStmt.run(fieldData);
            }
        }
        
        const updateFieldIndexStmt = db.prepare(`UPDATE fields SET is_indexed = 1 WHERE table_id = ? AND field_name = ?`);
        const updateFieldUniqueStmt = db.prepare(`UPDATE fields SET "unique" = 1, is_indexed = 1 WHERE table_id = ? AND field_name = ?`);
        for (const statement of ast) {
            if (statement.type !== 'create' || statement.keyword !== 'index') continue;
            const tableName = (statement.table?.table || statement.on[0]?.table).trim();
            if (!tableName) continue;
            const tableId = tableMap[tableName];
            if (!tableId) {
                console.warn(`Skipping index creation for table "${tableName}" because it was not found.`);
                continue;
            }
            const columns = (statement.index_columns || statement.definition).map(c => getFieldNameFromAST(c).trim());
            const isUnique = statement.unique === 'unique';
            const constraintName = getConstraintName(statement);
            if (columns.length === 1) {
                const fieldName = columns[0];
                if (isUnique) {
                    updateFieldUniqueStmt.run(tableId, fieldName);
                } else {
                    updateFieldIndexStmt.run(tableId, fieldName);
                }
            } else if (columns.length > 1) {
                insertConstraintStmt.run(tableId, constraintName, isUnique ? 'UNIQUE' : 'INDEX', JSON.stringify(columns));
            }
        }
        
        const checkPKStmt = db.prepare('SELECT 1 FROM fields WHERE table_id = ? AND primary_key = 1 LIMIT 1');
        const checkFieldExistsStmt = db.prepare('SELECT 1 FROM fields WHERE table_id = ? AND field_name = ? LIMIT 1');
        const insertStandardFieldStmt = db.prepare(`INSERT INTO fields (table_id, field_name, caption, data_type, length, primary_key, auto_increment, unsigned, read_only, is_indexed, field_order) VALUES (@table_id, @field_name, @caption, @data_type, @length, @primary_key, @auto_increment, @unsigned, @read_only, @is_indexed, @field_order)`);
        for (const tableName in tableMap) {
            const tableId = tableMap[tableName];
            if (!checkPKStmt.get(tableId)) {
                if (!checkFieldExistsStmt.get(tableId, 'id')) {
                    insertStandardFieldStmt.run({ table_id: tableId, field_name: 'id', caption: 'ID', data_type: 'INT', length: 11, primary_key: 1, auto_increment: 1, unsigned: 1, read_only: 1, is_indexed: 0, field_order: -1 });
                    if (!standardizationLog[tableName]) standardizationLog[tableName] = [];
                    standardizationLog[tableName].push('id');
                }
            }
            const requiredTimestamps = ['created_at', 'updated_at', 'deleted_at'];
            const allFields = db.prepare('SELECT field_name FROM fields WHERE table_id = ?').all(tableId);
            const existingFieldNames = new Set(allFields.map(f => f.field_name));
            let lastOrder = allFields.length;
            for (const fieldName of requiredTimestamps) {
                if (!existingFieldNames.has(fieldName)) {
                    insertStandardFieldStmt.run({ table_id: tableId, field_name: fieldName, caption: toTitleCase(fieldName), data_type: 'DATETIME', length: null, primary_key: 0, auto_increment: 0, unsigned: 0, read_only: 0, is_indexed: 0, field_order: lastOrder++ });
                    if (!standardizationLog[tableName]) standardizationLog[tableName] = [];
                    standardizationLog[tableName].push(fieldName);
                }
            }
        }
        
        for (const fk of foreignKeysToProcess) {
            const childTableId = tableMap[fk.childTableName];
            const parentTableId = tableMap[fk.parentTableName];
            if (childTableId && parentTableId) {
                const childField = db.prepare('SELECT "unique" FROM fields WHERE table_id = ? AND field_name = ?').get(childTableId, fk.fkChildField);
                const isUnique = childField ? childField.unique === 1 : false;
                const relationshipType = isUnique ? 'one-to-one' : 'one-to-many';
                const tabTitle = toTitleCase(fk.childTableName);
                db.prepare(`INSERT INTO parent_child_relationships (parent_table_id, child_table_id, fk_child_field, parent_field, tab_title, relationship_type, on_delete, on_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(parentTableId, childTableId, fk.fkChildField, fk.parentField, tabTitle, relationshipType, fk.onDelete, fk.onUpdate);
                relationshipsCreated++;
                let captionField = '';
                const parentFields = db.prepare('SELECT field_name, primary_key, data_type FROM fields WHERE table_id = ? ORDER BY field_order').all(parentTableId);
                const nonNumericTypes = ['VARCHAR', 'CHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'DATE', 'DATETIME', 'TIMESTAMP'];
                const nonNumericField = parentFields.find(f => nonNumericTypes.includes(f.data_type ? f.data_type.toUpperCase() : ''));
                if (nonNumericField) {
                    captionField = nonNumericField.field_name;
                } else {
                    const pkIndex = parentFields.findIndex(f => f.primary_key === 1);
                    if (pkIndex > -1 && pkIndex + 1 < parentFields.length) {
                        captionField = parentFields[pkIndex + 1].field_name;
                    }
                }
                if (captionField) {
                    db.prepare(`UPDATE fields SET lookup_parent_table = ?, lookup_caption_1 = ? WHERE table_id = ? AND field_name = ?`).run(fk.parentTableName, captionField, childTableId, fk.fkChildField);
                }
            }
        }
    });

    try {
        const ast = parser.astify(processedSql, { database: parserDialect });
        transaction(ast);
        let finalMessage = `Successfully imported ${tablesCreated} tables and ${relationshipsCreated} relationships!`;
        if (Object.keys(standardizationLog).length > 0) {
            finalMessage += "\n\nAdditionally, the following fields were automatically added for standardization purposes required by FiziSysMaker:" + 
                            Object.entries(standardizationLog).map(([tbl, flds]) => `\n- ${tbl}: ${flds.join(', ')}`).join('');
        }
        return { success: true, message: finalMessage };
    } catch (error) {
        console.error("SQL PARSING FAILED! The script may contain syntax incompatible with the parser for the selected dialect.");
        console.error("Full parser error:", error);
        return { success: false, message: `SQL Parsing Error: ${error.message}. Please check the console for more details.` };
    }
}

ipcMain.handle("sql:import-file", async (event, { projectId, dialect }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "SQL Files", extensions: ["sql"] }],
  });

  if (canceled || filePaths.length === 0) {
    return { success: false, message: "Import cancelled by user." };
  }

  const sqlContent = fs.readFileSync(filePaths[0], "utf8");
  
  // Logik pra-penerbangan baharu
  const canProceed = await handleImportPreflight(win, projectId, sqlContent);
  if (!canProceed) {
      return { success: false, message: "Import cancelled by user." };
  }

  win?.webContents.send('show-overlay');
  return importSchema(sqlContent, projectId, dialect);
});

ipcMain.handle("sql:import-text", async (event, { sql, projectId, dialect }) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  // Logik pra-penerbangan baharu
  const canProceed = await handleImportPreflight(win, projectId, sql);
  if (!canProceed) {
      return { success: false, message: "Import cancelled by user." };
  }
  
  win?.webContents.send('show-overlay');
  return importSchema(sql, projectId, dialect);
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
  const path = require('path');	
  const win = new BrowserWindow({
    width: 1200, // Lebar ini masih berguna sebagai saiz sandaran
    height: 800, // Tinggi ini masih berguna sebagai saiz sandaran
    show: false, // UBAH: Mulakan tetingkap secara tersembunyi
	resizable: false, //Kunci saiz tetingkap
    webPreferences: {
      preload: path.join(__dirname, './preload.js'),
    },
  });
  
  // TAMBAH: Panggil fungsi maximize() pada objek tetingkap
  win.maximize();
  
  win.loadFile(path.join(__dirname, './index.html'));

  // TAMBAH: Tunjukkan tetingkap hanya apabila ia sedia untuk dipaparkan
  win.on('ready-to-show', () => {
    win.show();
  });
  
   // Buka DevTools secara automatik untuk memudahkan penyahpepijatan
   win.webContents.openDevTools();
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
            'copy_children_async', 'allow_pwa_install', 'url','stack_base', 'stack_database',
			'stack_theme', 'module_auth_email_2fa', 'module_auth_email_captcha', 'module_auth_ldap',
            'module_auth_google_sso', 'module_authorization', 'module_log_audit', 'data_delete_type',
            'module_fake_data' // ADD THIS ITEM
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

// Handler baharu untuk mengemas kini tetapan jadual
ipcMain.handle('table:update', async (event, data) => {
    try {
        const { table_id, ...fieldsToUpdate } = data;
        if (!table_id) {
            throw new Error("Table ID tidak dibekalkan.");
        }

        // ▼▼▼ MULA PERUBAHAN ▼▼▼
        const transaction = db.transaction(() => {
            let oldTableName = null;

            // Jika nama jadual hendak ditukar, lakukan validasi dan sediakan untuk kemas kini menu
            if (fieldsToUpdate.hasOwnProperty('table_name')) {
                const newTableName = fieldsToUpdate.table_name;
                
                // Dapatkan nama jadual lama SEBELUM ia dikemas kini
                const tableInfo = db.prepare('SELECT table_name, project_id FROM tables WHERE table_id = ?').get(table_id);
                if (!tableInfo) {
                    throw new Error(`Jadual dengan ID ${table_id} tidak ditemui.`);
                }
                oldTableName = tableInfo.table_name;

                let isNameValid = true;
                if (!newTableName || newTableName.trim() === '') isNameValid = false;
                else if (!/^[a-zA-Z_]+$/.test(newTableName)) isNameValid = false;
                else {
                    const existingTable = db.prepare(
                        'SELECT table_id FROM tables WHERE project_id = ? AND table_name = ? AND table_id != ?'
                    ).get(tableInfo.project_id, newTableName, table_id);
                    if (existingTable) isNameValid = false;
                }

                if (!isNameValid) {
                    delete fieldsToUpdate.table_name;
                }
            }

            // Bina klausa SET untuk jadual 'tables'
            const allowedColumns = [
                'table_name', 'table_view_title', 'table_description', 'show_quick_search', 'records_per_page',
                'default_sort_by', 'sort_descending', 'allow_sorting', 'allow_filters', 'allow_csv_export', 'allow_csv_import','allow_print_view', 'allow_user_save_filters', 'allow_mass_delete', 'tv_template', 'hide_field_captions', 'use_first_field_as_title', 'table_view_classes_input',
                'detail_view_classes_input', 'detail_view_title', 'record_owner', 'default_focus',
                'redirect_after_insert', 'enable_detail_view', 'delete_with_children', 'dv_allow_print_view',
                'dv_separate_page', 'dv_hide_save_as_copy', 'dv_sticky_buttons', 'dv_allow_add_from_homepage'
            ];
            const setClause = Object.keys(fieldsToUpdate) 
                .filter(key => allowedColumns.includes(key))
                .map(key => `${key} = ?`)
                .join(', ');

            if (setClause) {
                const values = Object.keys(fieldsToUpdate)
                    .filter(key => allowedColumns.includes(key))
                    .map(key => fieldsToUpdate[key]);
                // 1. Kemas kini jadual 'tables'
                db.prepare(`UPDATE tables SET ${setClause} WHERE table_id = ?`).run(...values, table_id);
            }

            // 2. Jika nama jadual ditukar, kemas kini juga 'menu_items'
            if (oldTableName && fieldsToUpdate.table_name) {
                const newTableName = fieldsToUpdate.table_name;
                const newUrl = `${newTableName} Resource`;
                const oldUrl = `${oldTableName} Resource`;

                // Kemas kini label HANYA jika ia sepadan dengan nama jadual lama
                db.prepare(
                    'UPDATE menu_items SET item_label = ? WHERE table_id = ? AND item_label = ?'
                ).run(newTableName, table_id, oldTableName);
                
                // Kemas kini URL HANYA jika ia sepadan dengan format 'Resource' yang lama
                db.prepare(
                    'UPDATE menu_items SET item_url = ? WHERE table_id = ? AND item_url = ?'
                ).run(newUrl, table_id, oldUrl);
            }
        });

        transaction();
        return { success: true };
        // ▲▲▲ TAMAT PERUBAHAN ▲▲▲

    } catch (error) {
        console.error("Gagal mengemas kini jadual:", error);
        return { success: false, message: error.message };
    }
});

// Handler baharu untuk mengemas kini tetapan medan
ipcMain.handle('field:update', async (event, data) => {
    try {
		//console.log('Data diterima dari frontend:', data);
        const { field_id, ...fieldsToUpdate } = data;
        if (!field_id) {
            throw new Error("Field ID tidak dibekalkan.");
        }

        if (fieldsToUpdate.hasOwnProperty('field_name')) {
            const newFieldName = fieldsToUpdate.field_name;
            let isNameValid = true;

            // 1. Semak jika null atau kosong
            if (!newFieldName || newFieldName.trim() === '') {
                isNameValid = false;
            }
            // 2. Semak jika mengandungi aksara tidak sah
            else if (!/^[a-zA-Z_]+$/.test(newFieldName)) {
                isNameValid = false;
            }
            // 3. Semak jika nama sudah wujud (untuk medan lain dalam jadual yang sama)
            else {
                const tableInfo = db.prepare('SELECT table_id FROM fields WHERE field_id = ?').get(field_id);
                const existingField = db.prepare(
                    'SELECT field_id FROM fields WHERE table_id = ? AND field_name = ? AND field_id != ?'
                ).get(tableInfo.table_id, newFieldName, field_id);
                if (existingField) {
                    isNameValid = false;
                }
            }
            
            // Jika tidak sah, buang 'field_name' dari senarai kemas kini
            if (!isNameValid) {
                delete fieldsToUpdate.field_name;
            }
        }
		
        // Senarai lajur yang dibenarkan untuk dikemas kini dalam jadual 'fields'
        const allowedColumns = [
		    'field_name',
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
            'calculated_enable', 'calculated_query', 'lookup_custom_query', 'algorithm_logic', 'hook_functions'
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
        const deleteItemsStmt = db.prepare('DELETE FROM menu_items WHERE menu_group_id IN (SELECT menu_group_id FROM menu_groups WHERE project_id = ?)');
        const deleteGroupsStmt = db.prepare('DELETE FROM menu_groups WHERE project_id = ?');
        const insertGroupStmt = db.prepare('INSERT INTO menu_groups (project_id, group_name, group_order) VALUES (?, ?, ?)');
        const insertItemStmt = db.prepare('INSERT INTO menu_items (menu_group_id, table_id, item_order) VALUES (?, (SELECT table_id FROM tables WHERE table_name = ? AND project_id = ?), ?)');

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
        const updateItem = db.prepare('UPDATE menu_items SET item_order = ?, menu_group_id = ? WHERE item_id = ?');

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
		// LOG #1: Tunjuk data penuh yang diterima dari frontend
        //console.log('--- RELATIONSHIP UPDATE: Data Diterima ---', data);
		
        const { relationship_id, ...fieldsToUpdate } = data;
        if (!relationship_id) {
            throw new Error("Relationship ID tidak dibekalkan.");
        }
		
        // LOG #2: Tunjuk relationship_id dan data yang akan diupdate
        //console.log(`--- RELATIONSHIP UPDATE: ID Sasaran: ${relationship_id} ---`, fieldsToUpdate);

        const allowedColumns = [
                    'show_tab', 'show_icon', 'autoclose_modal', 'tab_title', 'copy_records',
                    'show_link_above', 'show_count_in_tv', 'allow_add_from_tv',
                    'on_delete', 'on_update' // <--- TAMBAH DUA MEDAN INI
                ];

        const setClause = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => `${key} = ?`)
            .join(', ');

        if (!setClause) {
            //console.log('--- RELATIONSHIP UPDATE: Tiada medan sah untuk dikemas kini. Operasi dihentikan.');
            return { success: true, message: 'Tiada medan yang sah untuk dikemas kini.' };
        }

        // LOG #3: Tunjuk klausa SET SQL yang dibina
        //console.log('--- RELATIONSHIP UPDATE: Klausa SET yang dibina ---', setClause);
		
        const values = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => fieldsToUpdate[key]);

        // LOG #4: Tunjuk nilai-nilai yang akan digunakan dalam query
        //console.log('--- RELATIONSHIP UPDATE: Nilai yang akan dimasukkan ---', values);

        const stmt = db.prepare(`UPDATE parent_child_relationships SET ${setClause} WHERE relationship_id = ?`);
        stmt.run(...values, relationship_id);

        // LOG #5: Pengesahan selepas operasi run()
        //console.log(`--- RELATIONSHIP UPDATE: Operasi UPDATE untuk relationship_id ${relationship_id} telah dilaksanakan.`);

        return { success: true };
    } catch (error) {
        console.error("Gagal mengemas kini hubungan:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('custom-view:save', async (event, data) => {
    // Guna destructuring untuk dapatkan semua data termasuk yang baharu
    const { custom_view_id, table_id, view_name, menu_icon, filter_rules, fields, owner_only, owner_field } = data;
    if (!table_id || !view_name) {
        return { success: false, message: 'Table ID and View Name are required.' };
    }

    const transaction = db.transaction(() => {
        let viewId = custom_view_id;
        let isNewView = false;

        if (viewId) { // Update existing view
            db.prepare(
                `UPDATE custom_views SET view_name = ?, menu_icon = ?, filter_rules = ?, owner_only = ?, owner_field = ? WHERE custom_view_id = ?`
            ).run(view_name, menu_icon, filter_rules, owner_only, owner_field, viewId);
        } else { // Insert new view
            isNewView = true;
            const maxOrderResult = db.prepare('SELECT MAX(view_order) as max_order FROM custom_views WHERE table_id = ?').get(table_id);
            const nextOrder = (maxOrderResult?.max_order ?? -1) + 1;
            const info = db.prepare(
                `INSERT INTO custom_views (table_id, view_name, menu_icon, filter_rules, owner_only, owner_field, view_order) VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(table_id, view_name, menu_icon, filter_rules, owner_only, owner_field, nextOrder);
            viewId = info.lastInsertRowid;
        }

        db.prepare('DELETE FROM custom_view_fields WHERE custom_view_id = ?').run(viewId);
        const insertFieldStmt = db.prepare(
            `INSERT INTO custom_view_fields (custom_view_id, field_source_table, field_source_name, field_label, is_readonly, display_order) 
             VALUES (?, ?, ?, ?, ?, ?)`
        );

        if (fields && Array.isArray(fields)) {
            fields.forEach((field, index) => {
                insertFieldStmt.run(viewId, field.sourceTable, field.sourceName, field.label, field.isReadonly ? 1 : 0, index);
            });
        }
        
        // ▼▼▼ MULA LOGIK BAHARU: Cipta item menu jika ia adalah view baharu ▼▼▼
        if (isNewView) {
            const tableInfo = db.prepare('SELECT table_name, project_id FROM tables WHERE table_id = ?').get(table_id);
            if (tableInfo) {
                const maxMenuOrderResult = db.prepare(
                    'SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL'
                ).get(tableInfo.project_id);
                const nextMenuOrder = (maxMenuOrderResult?.max_order ?? -1) + 1;
                
                const menuLabel = view_name; // Seperti yang diminta
                const menuUrl = `${tableInfo.table_name} Custom View`;

                db.prepare(
                    `INSERT INTO menu_items (project_id, custom_view_id, item_label, item_url, item_order) VALUES (?, ?, ?, ?, ?)`
                ).run(tableInfo.project_id, viewId, menuLabel, menuUrl, nextMenuOrder);
            }
        }
        // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲
        
        return viewId;
    });

    try {
        const savedViewId = transaction();
        const savedView = db.prepare('SELECT * FROM custom_views WHERE custom_view_id = ?').get(savedViewId);
        return { success: true, view: savedView };
    } catch (error) {
        console.error("Failed to save custom view:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('custom-view:delete', async (event, viewId) => {
    if (!viewId) {
        return { success: false, message: 'Custom View ID is required.' };
    }
    try {
        const transaction = db.transaction(() => {
            // Padam item menu yang berkaitan dahulu
            db.prepare('DELETE FROM menu_items WHERE custom_view_id = ?').run(viewId);
            // Kemudian padam custom view (akan memadam custom_view_fields melalui CASCADE)
            db.prepare('DELETE FROM custom_views WHERE custom_view_id = ?').run(viewId);
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error("Failed to delete custom view:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('project:get-initial-status', async (event, projectId) => {
  try {
    const tables = db.prepare('SELECT table_name FROM tables WHERE project_id = ?').all(projectId);

    // Tunjukkan tutorial jika tiada jadual, ATAU jika hanya ada 1 jadual dan namanya 'users'
    if (tables.length === 0 || (tables.length === 1 && tables[0].table_name === 'users')) {
      return { showTutorial: true };
    }

    return { showTutorial: false };
  } catch (error) {
    console.error("Gagal mendapatkan status awal projek:", error);
    return { showTutorial: false };
  }
});

// =================================================================
// Generator functions will be put here
// =================================================================
/**
 * Mencipta dan mengembalikan laluan ke folder 'generated' yang selamat.
 * Folder ini berada di dalam direktori data pengguna, jadi ia sentiasa boleh ditulis.
 * @returns {string} Laluan penuh ke folder 'generated'.
 */
function getGeneratedFolderPath() {
  // Laluan ini akan berbeza untuk setiap pengguna dan OS, cth:
  // Windows: C:\Users\NamaAnda\AppData\Roaming\fizisysmaker
  const userDataPath = app.getPath('userData');
  
  const generatedPath = path.join(userDataPath, 'generated');

  // Pastikan folder ini wujud. Jika tidak, ciptakannya.
  if (!fs.existsSync(generatedPath)) {
    fs.mkdirSync(generatedPath, { recursive: true });
  }

  return generatedPath;
}

/**
 * Menukar rentetan snake_case atau kebab-case kepada PascalCase.
 * Contoh: 'pelajar_sekolah' -> 'PelajarSekolah'
 */
function toPascalCase(str) {
    if (!str) return '';
    return str.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

/**
 * Menukar rentetan snake_case kepada camelCase.
 * Contoh: 'pelajar_sekolah' -> 'pelajarSekolah'
 */
function toCamelCase(str) {
    if (!str) return '';
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Menukar rentetan snake_case kepada Plural PascalCase menggunakan logik Bahasa Inggeris yang betul.
 * Contoh: 'activity_log' -> 'ActivityLogs'
 */
function toPluralPascalCase(str) {
    if (!str) return '';
    // Gunakan 'pluralize' pada rentetan asal sebelum menukar kes
    return toPascalCase(pluralize.plural(str));
}

/**
 * Menukar rentetan snake_case kepada Plural camelCase menggunakan logik Bahasa Inggeris yang betul.
 * Contoh: 'activity_log' -> 'activityLogs'
 */
function toPluralCamelCase(str) {
    if (!str) return '';
    // Gunakan 'pluralize' pada rentetan asal sebelum menukar kes
    return toCamelCase(pluralize.plural(str));
}

function toSingularPascalCase(str) {
    if (!str) return '';
    // Gunakan 'pluralize.singular' pada rentetan asal sebelum menukar kes
    return toPascalCase(pluralize.singular(str));
}

function toSingularCamelCase(str) {
    if (!str) return '';
    // Gunakan 'pluralize.singular' pada rentetan asal sebelum menukar kes
    return toCamelCase(pluralize.singular(str));
}

/**
 * Menukar rentetan kepada flatcase (lowercase tanpa sempang atau garis bawah).
 * Contoh: 'pelajar_sekolah' -> 'pelajarsekolah'
 */
function toFlatCase(str) {
    if (!str) return '';
    return str.replace(/[-_]/g, '').toLowerCase();
}

function toTitleCase(str) {
    if (!str) return '';
    return str.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

// FIND AND REPLACE THIS ENTIRE HELPER FUNCTION IN: main.js

function convertDateFormatToPhp(formatString) {
    if (!formatString) return 'd/m/Y'; // Lalai yang selamat

    // Normalkan tahun dalam rentetan input supaya padanan tidak bergantung pada tahun semasa
    const normalizedFormat = formatString.replace(/\d{4}/, '9999');

    switch (normalizedFormat) {
        // Format Tarikh
        case '31/12/9999': return 'd/m/Y';
        case '12/31/9999': return 'm/d/Y';
        case '9999-12-31': return 'Y-m-d';
        case '31 December 9999': return 'd F Y';
        case '31 Dec 9999': return 'd M Y';
        case 'December 31, 9999': return 'F d, Y';
        case 'Dec 31, 9999': return 'M d, Y';

        // Format Masa
        case '11:59 PM': return 'h:i A';
        case '11:59:59 PM': return 'h:i:s A';
        case '23:59': return 'H:i';
        case '23:59:59': return 'H:i:s';

        // Jika tiada padanan, kembalikan format lalai yang komprehensif
        default: return 'd/m/Y H:i:s';
    }
}

/**
 * Menjana fail Model Laravel Filament berdasarkan skema pangkalan data.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
// FIND AND REPLACE THIS ENTIRE FUNCTION IN: main.js

async function generateFilamentModels(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;
        const templatePath = path.join(__dirname, 'templates/php/filament/app/Models/Model.template');
        if (!fs.existsSync(templatePath)) throw new Error(`Template file not found at: ${templatePath}`);
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        const modelsPath = path.join(basePath, 'app', 'Models');
        fs.mkdirSync(modelsPath, { recursive: true });

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            const tableData = tables[tableName];
            let modelContent = templateContent;
            
            // ... (logik sedia ada untuk traits, classname, fillable, casts tidak berubah) ...
            if (projectSettings.module_fake_data === 1) modelContent = modelContent.replace('<<IMPORT_FACTORY>>', 'use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;').replace('<<TRAIT_FACTORY>>', 'use HasFactory;');
            if (projectSettings.data_delete_type === 'soft') modelContent = modelContent.replace('<<IMPORT_SOFTDELETE>>', 'use Illuminate\\Database\\Eloquent\\SoftDeletes;').replace('<<TRAIT_SOFTDELETE>>', 'use SoftDeletes;');
            if (projectSettings.module_log_audit === 1) {
                const importAudit = `use OwenIt\\Auditing\\Contracts\\Auditable;\nuse OwenIt\\Auditing\\Auditable as AuditableTrait;`;
                modelContent = modelContent.replace('<<IMPORT_AUDIT>>', importAudit).replace('<<CLASS_IMPLEMENTS_AUDIT>>', 'implements Auditable').replace('<<TRAIT_AUDIT>>', 'use AuditableTrait;');
            }
            const className = toSingularPascalCase(tableName);
            modelContent = modelContent.replace(/<<CLASS_NAME>>/g, className);
            modelContent = modelContent.replace('<<TABLE_NAME>>', tableName);
            const primaryKeyField = Object.values(tableData.fields).find(f => f.primary_key === 1);
            modelContent = modelContent.replace('<<PRIMARY_KEY>>', primaryKeyField ? primaryKeyField.field_name : 'id');
            const excludedFields = ['created_at', 'updated_at', 'deleted_at', primaryKeyField?.field_name];
            const fillableFields = Object.values(tableData.fields).filter(field => !excludedFields.includes(field.field_name) && field.read_only !== 1).map(field => `\n        '${field.field_name}'`).join(',');
            modelContent = modelContent.replace('<<ARRAY_EDITABLE_BYUSER_FIELDS>>', fillableFields ? `${fillableFields}\n    ` : '');
            
            const castableFields = Object.values(tableData.fields).filter(field => 
                field.data_type === 'JSON' || 
                (field.data_type === 'BOOLEAN' && field.display_type === 'check_box')
            );
            
            if (castableFields.length > 0) {
                const castLines = castableFields.map(field => {
                    let castType = '';
                    if (field.data_type === 'JSON') {
                        castType = 'array';
                    } else if (field.data_type === 'BOOLEAN' && field.display_type === 'check_box') {
                        castType = 'boolean';
                    }
                    return `\n        '${field.field_name}' => '${castType}',`;
                }).join('');

                const castsProperty = `\n    protected \$casts = [${castLines}\n    ];`;
                modelContent = modelContent.replace('<<MODEL_CASTS>>', castsProperty);
            }

            // ▼▼▼ BLOK HUBUNGAN YANG DIUBAH SUAI ▼▼▼
            let relationshipFunctions = [];

            // Hubungan ke JADUAL LAIN (PARENT)
            relationships.filter(r => r.parent_table_name === tableName).forEach(rel => {
                const childClassName = toSingularPascalCase(rel.child_table_name);
                const foreignKey = rel.fk_child_field;
                const localKey = rel.parent_field;
                let functionName;

                if (rel.parent_table_name === rel.child_table_name) {
                    // KES KHAS: Hubungan kepada diri sendiri (Induk ke Anak)
                    functionName = 'children'; // Guna nama 'children'
                } else {
                    // Kes biasa
                    functionName = toPluralCamelCase(rel.child_table_name);
                }

                if (rel.relationship_type === 'one-to-one') {
                    if (rel.parent_table_name === rel.child_table_name) functionName = 'child'; // Singular untuk one-to-one
                    else functionName = toSingularCamelCase(rel.child_table_name);
                    
                    relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return \$this->hasOne(${childClassName}::class, '${foreignKey}', '${localKey}');\n    }`);
                } else {
                    relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return \$this->hasMany(${childClassName}::class, '${foreignKey}', '${localKey}');\n    }`);
                }
            });

            // Hubungan ke JADUAL LAIN (CHILD)
            relationships.filter(r => r.child_table_name === tableName).forEach(rel => {
                const parentClassName = toSingularPascalCase(rel.parent_table_name);
                const foreignKey = rel.fk_child_field;
                const ownerKey = rel.parent_field;
                let functionName;

                if (rel.parent_table_name === rel.child_table_name) {
                    // KES KHAS: Hubungan kepada diri sendiri (Anak ke Induk)
                    functionName = 'parent'; // Guna nama 'parent'
                } else {
                    // Kes biasa
                    functionName = toSingularCamelCase(rel.parent_table_name);
                }
                
                relationshipFunctions.push(`\n    public function ${functionName}()\n    {\n        return \$this->belongsTo(${parentClassName}::class, '${foreignKey}', '${ownerKey}');\n    }`);
            });
            // ▲▲▲ TAMAT BLOK UBAH SUAI ▲▲▲

            modelContent = modelContent.replace('<<RELATIONSHIP_FUNCTIONS>>', relationshipFunctions.join(''));
            
            // ... (logik accessor & helper methods dikekalkan) ...
            let accessorFunctions = [];
            const uniqueAccessors = new Set();
            const childRelations = relationships.filter(r => r.parent_table_name === tableName);
            for (const rel of childRelations) {
                const childTable = tables[rel.child_table_name];
                if (!childTable) continue;
                const fkField = childTable.fields[rel.fk_child_field];
                if (!fkField) continue;
                if (fkField.lookup_caption_1 && fkField.lookup_caption_2) {
                    const firstField = fkField.lookup_caption_1;
                    const secondField = fkField.lookup_caption_2;
                    const separator = fkField.lookup_separator || ' ';
                    const accessorKey = `${firstField}|${secondField}`;
                    if (uniqueAccessors.has(accessorKey)) continue;
                    uniqueAccessors.add(accessorKey);
                    const lookupCaption = toPascalCase(firstField) + toPascalCase(secondField);
                    const accessorCode = `\n    public function get${lookupCaption}Attribute(): string\n    {\n        return "{\$this->${firstField}}${separator}({\$this->${secondField}})";\n    }`;
                    accessorFunctions.push(accessorCode);
                }
            }
            modelContent = modelContent.replace('<<COMBINE_FIELDS_VALUE>>', accessorFunctions.join('\n'));
            let helperMethods = [];
            const hasYoutubeField = Object.values(tableData.fields).some(field => field.media_type === 'youtube');
            if (hasYoutubeField) {
                const youtubeHelper = `\n    public function getCleanYoutubeUrl(string \$fieldName): string\n    {\n        \$url = \$this->{\$fieldName};\n        if (blank(\$url)) {\n            return '';\n        }\n\n        preg_match('/(?:v=|\\/v\\/|watch\\?v=|youtu\\.be\\/|embed\\/)([a-zA-Z0-9_-]{11})/', \$url, \$matches);\n\n        if (isset(\$matches[1])) {\n            return 'https://www.youtube.com/embed/' . \$matches[1];\n        }\n\n        return \$url;\n    }\n`;
                helperMethods.push(youtubeHelper);
            }
            modelContent = modelContent.replace('<<HELPER_METHODS>>', helperMethods.join('\n'));

            modelContent = modelContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            modelContent = modelContent.replace(/<<.*?>>/g, '');

            const outputFilePath = path.join(modelsPath, `${className}.php`);
            fs.writeFileSync(outputFilePath, modelContent);
            console.log(`Model generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Models generated successfully.' };
    } catch (error) {
        console.error('Failed to generate Filament Models:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Menjana fail Model User.php Laravel Filament secara spesifik.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentUserModel(fullSchema, basePath) {
    try {
        const projectSettings = fullSchema.project;
        const relationships = fullSchema.database.relationships;
        const userData = fullSchema.database.table.users;

        // Hentikan jika skema jadual 'users' tidak wujud
        if (!userData) {
            console.warn("Skema untuk jadual 'users' tidak ditemui. Melangkau penjanaan User.php.");
            return { success: true, message: 'User model skipped as users table was not found.' };
        }

        // Tentukan laluan templat dan pastikan ia wujud
        const templatePath = path.join(__dirname, 'templates/php/filament/app/Models/User.template');
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found at: ${templatePath}`);
        }
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        let userModelContent = templateContent;

        // 1. & 2. Handle Soft Deletes
        if (projectSettings.data_delete_type === 'soft') {
            userModelContent = userModelContent.replace('<<IMPORT_SOFTDELETE>>', 'use Illuminate\\Database\\Eloquent\\SoftDeletes;');
            userModelContent = userModelContent.replace('<<TRAIT_SOFTDELETE>>', ', SoftDeletes');
        }

        // 3, 4, & 5. Handle Auditing
        if (projectSettings.module_log_audit === 1) {
            const importAudit = `use OwenIt\\Auditing\\Contracts\\Auditable;\nuse OwenIt\\Auditing\\Auditable as AuditableTrait;`;
            userModelContent = userModelContent.replace('<<IMPORT_AUDIT>>', importAudit);
            userModelContent = userModelContent.replace('<<CLASS_IMPLEMENTS_AUDIT>>', 'implements Auditable');
            userModelContent = userModelContent.replace('<<TRAIT_AUDIT>>', ', AuditableTrait');
        }

        // Handle Authorization (Spatie/Permission/Shield)
        if (projectSettings.module_authorization === 1) {
            userModelContent = userModelContent.replace('<<IMPORT_SHIELD>>', 'use Spatie\\Permission\\Traits\\HasRoles;');
            userModelContent = userModelContent.replace('<<TRAIT_SHIELD>>', ', HasRoles');
        }

        // 10. Ganti Fungsi Hubungan (Eloquent Relationships)
        let relationshipFunctions = [];
        const tableName = 'users';

        // Mencari hubungan di mana 'users' adalah PARENT (hasOne / hasMany)
        relationships.filter(r => r.parent_table_name === tableName).forEach(rel => {
            const childClassName = toSingularPascalCase(rel.child_table_name);
            const foreignKey = rel.fk_child_field;
            const localKey = rel.parent_field;

            if (rel.relationship_type === 'one-to-one') {
                const functionName = toSingularCamelCase(rel.child_table_name); // Singular
                relationshipFunctions.push(`
    public function ${functionName}()
    {
        return $this->hasOne(${childClassName}::class, '${foreignKey}', '${localKey}');
    }
`);
            } else {
                const functionName = toPluralCamelCase(rel.child_table_name); // Plural
                relationshipFunctions.push(`
    public function ${functionName}()
    {
        return $this->hasMany(${childClassName}::class, '${foreignKey}', '${localKey}');
    }
`);
            }
        });

        // Mencari hubungan di mana 'users' adalah CHILD (belongsTo)
        relationships.filter(r => r.child_table_name === tableName).forEach(rel => {
            const parentClassName = toSingularPascalCase(rel.parent_table_name);
            const functionName = toSingularCamelCase(rel.parent_table_name); // Singular
            relationshipFunctions.push(`
    public function ${functionName}()
    {
        return $this->belongsTo(${parentClassName}::class, '${rel.fk_child_field}', '${rel.parent_field}');
    }
`);
        });

        userModelContent = userModelContent.replace('<<RELATIONSHIP_FUNCTIONS>>', relationshipFunctions.join(''));
// Bersihkan placeholder yang tidak digunakan dan baris kosong yang terhasil
        userModelContent = userModelContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, ''); // Buang placeholder pada baris sendiri
        userModelContent = userModelContent.replace(/<<.*?>>/g, ''); // Buang placeholder dalam baris (inline)

        // 11. Jana fail output
        const outputFilePath = path.join(basePath, 'app', 'Models', 'User.php');
        fs.writeFileSync(outputFilePath, userModelContent);
        console.log(`User Model generated: ${outputFilePath}`);
        
        return { success: true, message: 'User Model generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament User Model:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Menjana fail Resource Laravel Filament untuk setiap jadual.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
// FIND AND REPLACE THIS ENTIRE FUNCTION IN: main.js

async function generateFilamentResources(fullSchema, basePath) {
    try {
        const projectSettings = fullSchema.project;
        const tables = fullSchema.database.table;
        const relationships = fullSchema.database.relationships;
        const unifiedMenu = fullSchema.database.unified_menu;

        const templatePath = path.join(__dirname, 'templates/php/filament/app/Filament/Resources/Resource.template');
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found at: ${templatePath}`);
        }
        const templateContent = fs.readFileSync(templatePath, 'utf8');

        for (const tableName in tables) {
            if (tableName === 'users') {
                continue; 
            }

            const tableData = tables[tableName];
            let resourceContent = templateContent;

            let menuItem = null;
            let menuGroup = null;
            for (const topLevelItem of unifiedMenu) {
                if (topLevelItem.type === 'group') {
                    const foundItem = topLevelItem.items.find(item => item.table_id === tableData.table_id);
                    if (foundItem) {
                        menuItem = foundItem;
                        menuGroup = topLevelItem;
                        break;
                    }
                } else if (topLevelItem.table_id === tableData.table_id) {
                    menuItem = topLevelItem;
                    break;
                }
            }

            const modelName = toSingularPascalCase(tableName);
            const modelNamePlural = toPluralPascalCase(tableName);
            resourceContent = resourceContent.replace(/<<MODEL_NAME>>/g, modelName);
            resourceContent = resourceContent.replace(/<<MODEL_NAME_PLURAL>>/g, modelNamePlural);
            
            const childrenWithCount = relationships.filter(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
            if (childrenWithCount.length > 0) {
                resourceContent = resourceContent.replace('<<IMPORT_SHOW_COUNT_IN_TV>>', 'use Illuminate\\Database\\Eloquent\\Builder;');
                const childPluralCamelNames = childrenWithCount.map(r => `'${toPluralCamelCase(r.child_table_name)}'`).join(', ');
                const withCountFunction = `
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->withCount([${childPluralCamelNames}]);
    }`;
                resourceContent = resourceContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', withCountFunction);
            }

            if (tableData.allow_print_view === 1) {
                resourceContent = resourceContent.replace('<<IMPORT_PRINTACTION>>', 'use Filament\\Actions\\Action;\nuse App\\Filament\\Actions\\PrintAction;');
                const printAction = `Action::make('print')
                    ->label('Print')
                    ->icon('heroicon-o-printer')
                    ->color('gray')
                    ->url(fn (): string => request()->fullUrlWithQuery(['print' => 1]))
                    ->openUrlInNewTab(),`;
                resourceContent = resourceContent.replace('<<PRINT_ACTION>>', printAction);
            }

            if (tableData.allow_csv_export === 1) {
                const importExport = `use App\\Filament\\Exports\\${modelName}Exporter;\nuse Filament\\Actions\\ExportAction;`;
                const exportAction = `ExportAction::make()->exporter(${modelName}Exporter::class),`;
                resourceContent = resourceContent.replace('<<IMPORT_EXPORTDATA>>', importExport);
                resourceContent = resourceContent.replace('<<EXPORT_ACTION>>', exportAction);
            }

            if (tableData.allow_csv_import === 1) {
                const importImport = `use App\\Filament\\Imports\\${modelName}Importer;\nuse Filament\\Actions\\ImportAction;`;
                const importAction = `ImportAction::make()->importer(${modelName}Importer::class),`;
                resourceContent = resourceContent.replace('<<IMPORT_IMPORTDATA>>', importImport);
                resourceContent = resourceContent.replace('<<IMPORT_ACTION>>', importAction);
            }
            
            // ▼▼▼ PERUBAHAN UTAMA DI SINI ▼▼▼
            // Kini ia hanya akan mengambil hubungan 'one-to-many' untuk Relation Manager
            const childrenForRelationManager = relationships.filter(r => 
                r.parent_table_name === tableName && 
                r.show_tab === 1 &&
                r.relationship_type !== 'one-to-one' // <-- SYARAT BAHARU DITAMBAH
            );

            if (childrenForRelationManager.length > 0) {
                const importManagers = childrenForRelationManager.map(r => `use App\\Filament\\Resources\\${modelNamePlural}\\RelationManagers\\${toSingularPascalCase(r.child_table_name)}RelationManager;`).join('\n');
                const relationManagers = childrenForRelationManager.map(r => `            ${toSingularPascalCase(r.child_table_name)}RelationManager::class,`).join('\n');
                resourceContent = resourceContent.replace('<<IMPORT_RELATIONMANAGERS>>', importManagers);
                resourceContent = resourceContent.replace('<<RELATION_RELATIONMANAGERS>>', relationManagers);
            }
            // ▲▲▲ TAMAT PERUBAHAN ▲▲▲

            if (menuItem) {
                if (menuGroup) { 
                    const groupFunction = `
    public static function getNavigationGroup(): string
    {
        return '${menuGroup.name}';
    }`;
                    const sortFunction = `
    public static function getNavigationSort(): int
    {
        return ${menuItem.item_order};
    }`;
                    resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONGROUP>>', groupFunction);
                    resourceContent = resourceContent.replace('<<FUNCTION_GETNAVIGATIONSORT>>', sortFunction);
                } else { 
                    const sortProperty = `protected static ?int $navigationSort = ${menuItem.item_order};`;
                    resourceContent = resourceContent.replace('<<SHORTCUT_MENU_ORDER>>', sortProperty);
                }
            }

            if (projectSettings.module_log_audit === 1) {
                const auditRelation = `
        if (auth()->check() && auth()->user()->can('view_any_audit')) {
            $relations[] = AuditsRelationManager::class;
        }`;
                resourceContent = resourceContent.replace('<<RELATIONS_AUDIT>>', auditRelation);
            }

            resourceContent = resourceContent.replace('<<MODEL_NAME_FLATCASE>>', toFlatCase(tableName));
            if (menuItem) {
                resourceContent = resourceContent.replace('<<MENU_NAME>>', menuItem.item_label);
            }

// Bersihkan placeholder yang tidak digunakan dan baris kosong yang terhasil
            resourceContent = resourceContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, ''); // Buang placeholder pada baris sendiri
            resourceContent = resourceContent.replace(/<<.*?>>/g, ''); // Buang placeholder dalam baris (inline)

            const resourceFolder = toPluralPascalCase(tableName); // Nama folder kekal plural
            const resourceClassName = `${modelName}Resource`;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder);
            fs.mkdirSync(outputFolderPath, { recursive: true });
            
            const outputFilePath = path.join(outputFolderPath, `${resourceClassName}.php`);
            fs.writeFileSync(outputFilePath, resourceContent);
            console.log(`Resource generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Resources generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Resources:', error);
        return { success: false, message: error.message };
    }
}

// ADD THIS NEW, INDEPENDENT FUNCTION IN: main.js

/**
 * Menjana fail List Page Laravel Filament untuk setiap resource.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentListPages(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;

        const templatePath = path.join(__dirname, 'templates/php/filament/app/Filament/Resources/PagesList.template');
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found at: ${templatePath}`);
        }
        const templateContent = fs.readFileSync(templatePath, 'utf8');

        for (const tableName in tables) {
            if (tableName === 'users') {
                continue; 
            }

            const tableData = tables[tableName];
            let listContent = templateContent;

            const modelNameSingular = toSingularPascalCase(tableName);
            const modelNamePlural = toPluralPascalCase(tableName);
            listContent = listContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);
            listContent = listContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);

            listContent = listContent.replace('<<TABLE_VIEW_TITLE>>', tableData.table_view_title || modelNamePlural);
            
            // Logik yang betul: cari hubungan di mana jadual ini adalah anak DAN parent mempunyai tetapan 'show_count_in_tv'
            const parentRelationForIframe = relationships.find(r => r.child_table_name === tableName && r.show_count_in_tv === 1);
            const needsIframeLogic = !!parentRelationForIframe;

            if (needsIframeLogic) {
                const foreignKey = parentRelationForIframe.fk_child_field;

                const createActionCode = `CreateAction::make()
    ->when(
        session('is_in_iframe'),
        fn (CreateAction $action) => $action->url(fn (): string => static::getResource()::getUrl('create', [
                    '${foreignKey}' => request()->query('${foreignKey}')
                ]))
    )`;
                listContent = listContent.replace('<<CREATE_ACTION>>', createActionCode);
                
                listContent = listContent.replace('<<IMPORT_BUILDER>>', 'use Illuminate\\Database\\Eloquent\\Builder;');

                const filterQueryCode = `
    protected function getTableQuery(): Builder
    {
        $query = parent::getTableQuery();
        
        if ($fkValue = request()->query('${foreignKey}')) {
            $query->where('${foreignKey}', $fkValue);
        }
        return $query;
    }`;
                listContent = listContent.replace('<<FILTER_QUERY>>', filterQueryCode);
                
                const iframeSetupCode = `
    public function mount(): void
    {
        parent::mount();

        if (request()->has('iframe')) {
            session(['is_in_iframe' => true]);
            session(['foreignkey' => '${foreignKey}']);
        } else {
            session()->forget('is_in_iframe');
            session()->forget('foreignkey');
        }
    }
    
    public function getLayout(): string
    {
        if (session('is_in_iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        return parent::getLayout();
    }`;
                listContent = listContent.replace('<<IFRAME_SETUP>>', iframeSetupCode);

            } else {
                // Jika bukan dalam konteks iframe, guna CreateAction biasa
                listContent = listContent.replace('<<CREATE_ACTION>>', 'CreateAction::make(),');
            }

            const hasChildWithCount = relationships.some(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
            if (hasChildWithCount) {
                const cssCode = `
        FilamentView::registerRenderHook(
            'panels::body.end',
            fn (): string => <<<HTML
                <style>
                    td.fi-ta-cell > .fi-ta-actions {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start; 
                        gap: 0.5rem; 
                    }
                </style>
            HTML
        );`;
                listContent = listContent.replace('<<VERTICAL_ACTION_BUTTON_CSS>>', cssCode);
            }

            if (tableData.allow_print_view === 1) {
                const printCssCode = `
        if ((bool) request()->query('print')) {
            FilamentView::registerRenderHook(
                'panels::body.end',
                fn (): string => <<<HTML
                    <style>
                        @media print {
                            body { visibility: hidden; }
                            .fi-ta-content-ctn, .fi-ta-content-ctn * { visibility: visible; }
                            .fi-ta-content-ctn { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; }
                            body { font-size: 12pt !important; background-color: #fff !important; }
                            .fi-ta-cell .fi-ta-actions { display: none !important; }
                        }
                    </style>
                    <script>
                        window.onload = () => {
                            window.print();
                            window.onafterprint = () => { window.close(); };
                        };
                    </script>
                HTML
            );
        }`;
                listContent = listContent.replace('<<PRINT_ACTION_CSS>>', printCssCode);
            }

            listContent = listContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            listContent = listContent.replace(/<<.*?>>/g, '');

            const resourceFolder = modelNamePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
            fs.mkdirSync(outputFolderPath, { recursive: true });

            const outputFilePath = path.join(outputFolderPath, `List${modelNamePlural}.php`);
            fs.writeFileSync(outputFilePath, listContent);
            console.log(`List Page generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament List Pages generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament List Pages:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Menjana fail Create Page Laravel Filament untuk setiap resource.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentCreatePages(fullSchema, basePath) {
    try {
        const { database: { table: tables, relationships } } = fullSchema;

        const templatePath = path.join(__dirname, 'templates/php/filament/app/Filament/Resources/PagesCreate.template');
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found at: ${templatePath}`);
        }
        const templateContent = fs.readFileSync(templatePath, 'utf8');

        for (const tableName in tables) {
            if (tableName === 'users') {
                continue; // Langkau jadual 'users'
            }

            const tableData = tables[tableName]; // Dapatkan data untuk jadual semasa
            let createContent = templateContent;

            const modelNameSingular = toSingularPascalCase(tableName);
            createContent = createContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);

            const modelNamePlural = toPluralPascalCase(tableName);
            createContent = createContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);
            
            // ▼▼▼ PENAMBAHBAIKAN UNTUK GRID COLUMNS BERMULA DI SINI ▼▼▼
            if (tableData && tableData.column_grid_type === 'dynamic') {
                createContent = createContent.replace('<<GRIDCOLUMN_VAR>>', 'public int $gridColumns = 2;');
            }
            // ▲▲▲ PENAMBAHBAIKAN TAMAT ▲▲▲

            const isChildInIframeContext = relationships.some(r => 
                r.child_table_name === tableName && r.show_count_in_tv === 1
            );

            if (isChildInIframeContext) {
                const iframeLayoutCode = `
    public function getLayout(): string
    {
        if (session('is_in_iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        
        return parent::getLayout();
    }
`;
                createContent = createContent.replace('<<IFRAME_LAYOUT>>', iframeLayoutCode);
            }

            // Bersihkan placeholder yang tidak digunakan dan baris kosong
            createContent = createContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            createContent = createContent.replace(/<<.*?>>/g, '');

            const resourceFolder = modelNamePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
            fs.mkdirSync(outputFolderPath, { recursive: true });

            const outputFilePath = path.join(outputFolderPath, `Create${modelNameSingular}.php`);
            fs.writeFileSync(outputFilePath, createContent);
            console.log(`Create Page generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Create Pages generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Create Pages:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Menjana fail Edit Page Laravel Filament untuk setiap resource.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentEditPages(fullSchema, basePath) {
    try {
        const { database: { table: tables, relationships } } = fullSchema;

        const templatePath = path.join(__dirname, 'templates/php/filament/app/Filament/Resources/PagesEdit.template');
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found at: ${templatePath}`);
        }
        const templateContent = fs.readFileSync(templatePath, 'utf8');

        for (const tableName in tables) {
            if (tableName === 'users') {
                continue;
            }
            const tableData = tables[tableName];
            let editContent = templateContent;

            const modelNameSingular = toSingularPascalCase(tableName);
            editContent = editContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);

            const modelNamePlural = toPluralPascalCase(tableName);
            editContent = editContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);
            
            const primaryKeyField = Object.values(tableData.fields).find(f => f.primary_key === 1);
            editContent = editContent.replace(/<<PRIMARY_KEY>>/g, primaryKeyField ? primaryKeyField.field_name : 'id');

            const uniqueFields = Object.values(tableData.fields).filter(f => f.unique === 1);
            if (uniqueFields.length > 0) {
                const uniqueEmptyLines = uniqueFields.map(f => `        $data['${f.field_name}'] = '';`).join('\n');
                editContent = editContent.replace('<<UNIQUE_EMPTY>>', uniqueEmptyLines);
            }

            const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
            const firstStringField = Object.values(tableData.fields).find(f => stringTypes.includes(f.data_type.toUpperCase()));
            editContent = editContent.replace('<<FIRST_STRING_FIELD>>', firstStringField ? firstStringField.field_name : '');
            
            // ▼▼▼ PENAMBAHBAIKAN UNTUK GRID COLUMNS BERMULA DI SINI ▼▼▼
            if (tableData && tableData.column_grid_type === 'dynamic') {
                editContent = editContent.replace('<<GRIDCOLUMN_VAR>>', '    public int $gridColumns = 2;');
            }
            // ▲▲▲ PENAMBAHBAIKAN TAMAT ▲▲▲
            
            const isParentTable = relationships.some(r => r.parent_table_name === tableName);
            if(isParentTable) {
                const iframeParentCode = `
    public function mount(string|int $record): void
    {
        parent::mount($record);
        if (request()->has('iframe')) {
            session(['is_in_iframe' => true]);
        } else {
            session()->forget('is_in_iframe');
        }
    }
	
    public function getLayout(): string
    {
        if (request()->has('iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        return parent::getLayout();
    }`;
                editContent = editContent.replace('<<IFRAME_PARENT_SETUP>>', iframeParentCode);
            }

            const isChildInIframeContext = relationships.some(r => 
                r.child_table_name === tableName && r.show_count_in_tv === 1
            );

            if (isChildInIframeContext) {
                const iframeLayoutCode = `
    public function getLayout(): string
    {
        if (session('is_in_iframe')) {
            return 'filament.layouts.custom-iframe-layout';
        }
        
        return parent::getLayout();
    }
`;
                editContent = editContent.replace('<<IFRAME_CHILD_LAYOUT>>', iframeLayoutCode);
            }

            const isChildTable = relationships.some(r => r.child_table_name === tableName);
            if (isChildTable) {
                editContent = editContent.replace('<<IMPORT_CLOSE_IFRAME>>', 'use Filament\\Support\\Facades\\FilamentView;\nuse Illuminate\\Contracts\\View\\View;');
                const refreshIframeCode = `
    public function render(): View
    {
        FilamentView::registerRenderHook(
            'panels::body.end',
            fn (): string => <<<HTML
                <script>
                    document.addEventListener('click', function (event) {
                        if (event.target.closest('.fi-modal-close-btn')) {
                            setTimeout(() => {
                                window.parent.location.reload();
                            }, 100);
                        }
                    });
                </script>
            HTML
        );
        return parent::render();
    }`;
                editContent = editContent.replace('<<REFRESH_CLOSE_IFRAME>>', refreshIframeCode);
            }

            editContent = editContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            editContent = editContent.replace(/<<.*?>>/g, '');

            const resourceFolder = modelNamePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Pages');
            fs.mkdirSync(outputFolderPath, { recursive: true });
            
            const outputFilePath = path.join(outputFolderPath, `Edit${modelNameSingular}.php`);
            fs.writeFileSync(outputFilePath, editContent);
            console.log(`Edit Page generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Edit Pages generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Edit Pages:', error);
        return { success: false, message: error.message };
    }
}

/**
 * [VERSI AKHIR LENGKAP] Menjana fail ...Table.php Laravel Filament untuk setiap resource.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentTablesTable(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;

        const templatePath = path.join(__dirname, 'templates/php/filament/app/Filament/Resources/TablesTable.template');
        if (!fs.existsSync(templatePath)) throw new Error(`Template file not found at: ${templatePath}`);
        
        const templateContent = fs.readFileSync(templatePath, 'utf8');

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            let tableContent = templateContent;
            const tableData = tables[tableName];
            
            // --- FASA 1: KERANGKA UTAMA ---
            
            const modelNameSingular = toSingularPascalCase(tableName);
            const modelNamePlural = toPluralPascalCase(tableName);
            tableContent = tableContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);
            tableContent = tableContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);

            const childrenWithCount = relationships.filter(r => r.parent_table_name === tableName && r.show_count_in_tv === 1);
            if (childrenWithCount.length > 0) {
                const childImports = childrenWithCount.map(r => {
                    const childSingular = toSingularPascalCase(r.child_table_name);
                    const childResourceFolder = toPluralPascalCase(r.child_table_name);
                    return `use App\\Filament\\Resources\\${childResourceFolder}\\${childSingular}Resource;`;
                }).join('\n');
                tableContent = tableContent.replace('<<IMPORT_RESOURCES>>', childImports);

                const childPluralCamelNames = childrenWithCount.map(r => {
                    const relName = r.parent_table_name === r.child_table_name ? 'children' : toPluralCamelCase(r.child_table_name);
                    return `'${relName}'`;
                }).join(', ');
                const withCountFunction = `\n    public static function getEloquentQuery(): Builder\n    {\n        return parent::getEloquentQuery()->withCount([${childPluralCamelNames}]);\n    }`;
                tableContent = tableContent.replace('<<FUNCTION_SHOW_COUNT_IN_TV>>', withCountFunction);
            }

            if (tableData.allow_mass_delete === 1) tableContent = tableContent.replace('<<ACTION_MASS_DELETE>>', 'BulkActionGroup::make([\n                DeleteBulkAction::make(),\n            ]),');
            if (tableData.show_edit_button === 1 && tableData.enable_detail_view === 1) {
                tableContent = tableContent.replace('<<DISABLED_ROW_INTERACTION>>', '->recordUrl(null)');
                if (tableData.dv_separate_page === 1) tableContent = tableContent.replace('<<ACTION_EDIT_BUTTON>>', 'EditAction::make()->openUrlInNewTab(),');
                else tableContent = tableContent.replace('<<ACTION_EDIT_BUTTON>>', 'EditAction::make(),');
            }
            if (tableData.pagination_type === 'simple') tableContent = tableContent.replace('<<PAGINATION_TYPE>>', '->paginationMode(\'simple\')');
            else if (tableData.pagination_type === 'extreme') tableContent = tableContent.replace('<<PAGINATION_TYPE>>', '->extremePaginationLinks()');
            tableContent = tableContent.replace('<<ADD_DESCRIPTION>>', tableData.table_description || '');
            if (tableData.show_delete_button === 1) tableContent = tableContent.replace('<<ACTION_DELETE_BUTTON>>', 'DeleteAction::make(),');
            if (projectSettings.data_delete_type === 'soft') {
                if (tableData.allow_restore_delete === 1) tableContent = tableContent.replace('<<ACTION_RESTORE_BUTTON>>', 'RestoreAction::make(),');
                if (tableData.allow_force_delete === 1) tableContent = tableContent.replace('<<ACTION_FORCEDELETE_BUTTON>>', 'ForceDeleteAction::make(),');
                if (tableData.allow_restore_delete === 1 || tableData.allow_force_delete === 1) tableContent = tableContent.replace('<<TRASHED_FILTER>>', 'TrashedFilter::make(),');
            }
            if (tableData.allow_pagination === 0) tableContent = tableContent.replace('<<DISABLED_PAGINATION>>', '->paginated(false)');
            if (tableData.dv_separate_page === 1) tableContent = tableContent.replace('<<OPEN_TO_NEW_TAB>>', '->openRecordUrlInNewTab()');
            if (tableData.enable_detail_view === 0) tableContent = tableContent.replace('<<DISABLED_DETAILVIEW>>', '->recordUrl(null)');
            if (childrenWithCount.length > 0) {
                const primaryKeyField = Object.values(tableData.fields).find(f => f.primary_key === 1);
                const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
                const firstStringField = Object.values(tableData.fields).find(f => stringTypes.includes(f.data_type.toUpperCase()));
                const modalTitleField = firstStringField || primaryKeyField;
                if (modalTitleField) {
                    const showCountActions = childrenWithCount.map(r => {
                        const childSingular = toSingularPascalCase(r.child_table_name);
                        const countAttribute = r.parent_table_name === r.child_table_name ? 'children_count' : `${pluralize.plural(r.child_table_name)}_count`;
                        return `
                Action::make('show${childSingular}')
                    ->label(fn (${modelNameSingular} \$record): string => '${toTitleCase(r.child_table_name)}: ' . \$record->${countAttribute})
                    ->button()->outlined()->color('info')
                    ->tooltip('Show total of ${r.child_table_name.replace(/_/g, ' ')}')
                    ->visible(fn (${modelNameSingular} \$record): bool => \$record->${countAttribute} > 0)
                    ->modalHeading(fn (${modelNameSingular} \$record) => '${toTitleCase(modalTitleField.field_name)}: ' . \$record->${modalTitleField.field_name})
                    ->modalSubmitAction(false)->modalCancelAction(false)->modalWidth('6xl')
                    ->modalContent(fn (${modelNameSingular} \$record): View =>
                        view('filament.components.modal-iframe', ['src' => ${childSingular}Resource::getUrl('index', ['${r.fk_child_field}' => \$record->${primaryKeyField ? primaryKeyField.field_name : 'id'}, 'iframe' => 1])])
                    ),`;
                    }).join('');
                    tableContent = tableContent.replace('<<SHOW_COUNT_IN_TV>>', showCountActions);
                }
            }
            if (tableData.allow_print_view === 1) tableContent = tableContent.replace('<<SHOW_ALL_FOR_PRINT>>', `->when((bool) request()->query('print'), fn (Table \$table) => \$table->paginated(false),)`);
            
            // --- FASA 2: PENJANAAN LAJUR JADUAL ---
            const columnsCode = [];
            const visibleFields = Object.values(tableData.fields)
                .filter(field => field.hide_in_tv !== 1)
                .sort((a, b) => (a.field_order ?? 999) - (b.field_order ?? 999));

            for (const field of visibleFields) {
                if (field.editable_in_tv === 1) continue;

                let controller;
                if (field.media_type === 'image') controller = 'ImageColumn';
                else if (['upload', 'gmap', 'youtube'].includes(field.media_type) || field.data_type === 'BOOLEAN') controller = 'IconColumn';
                else controller = 'TextColumn';
                
                let fieldName;
                const fkRelationship = relationships.find(r => r.child_table_name === tableName && r.fk_child_field === field.field_name);
                if (fkRelationship) {
                    const parentCamel = fkRelationship.parent_table_name === fkRelationship.child_table_name ? 'parent' : toSingularCamelCase(fkRelationship.parent_table_name);
                    if(field.lookup_caption_1 && field.lookup_caption_2) {
                        const combined = `${field.lookup_caption_1}_${field.lookup_caption_2}`;
                        fieldName = `${parentCamel}.${combined}`;
                    } else if (field.lookup_caption_1) {
                        fieldName = `${parentCamel}.${field.lookup_caption_1}`;
                    } else {
                         fieldName = field.field_name;
                    }
                } else {
                    fieldName = field.field_name;
                }
                
                let lines = [`${controller}::make('${fieldName}')`];
                lines.push(`->label('${toTitleCase(field.caption || field.field_name)}')`);
                
                if (controller === 'ImageColumn') {
                    if (field.tv_thumb_shape === 'circular') lines.push('->circular()'); else lines.push('->square()');
                    if (field.tv_thumb_width) lines.push(`->imageWidth(${field.tv_thumb_width})`);
                    if (field.tv_thumb_height) lines.push(`->imageHeight(${field.tv_thumb_height})`);
                    if (field.image_storage_provider) lines.push(`->disk('${field.image_storage_provider}')`);
                    if (field.tv_enable_zooming === 1) {
                        lines.push(`->action(\n                    Action::make('Show full image')\n                        ->modalHeading(false)->modalFooter(null)\n                        ->modalContent(fn (${modelNameSingular} \$record): HtmlString => new HtmlString(\n                            \$record->${field.field_name}\n                                ? '<img src="' . Storage::url(\$record->${field.field_name}) . '" alt="${toTitleCase(field.caption || field.field_name)}" style="width: 100%;">'\n                                : '<p class="text-center">No image uploaded.</p>'\n                        ))\n                )`);
                    }
                } else if (controller === 'IconColumn') {
                    if (field.media_type === 'upload') {
                        const iconValue = field.tv_icon || 'document-arrow-down';
                        const storageProvider = field.file_storage_provider || 'public';
                        lines.push(`->icon(fn (\$state): ?string => \$state ? 'heroicon-o-${iconValue}' : null)`);
                        lines.push(`->url(fn (?${modelNameSingular} \$record) => \$record?->${field.field_name} ? Storage::disk('${storageProvider}')->url(\$record->${field.field_name}) : null, shouldOpenInNewTab: true)`);
                        if (field.tv_icon_color) lines.push(`->color('${field.tv_icon_color}')`);
                    } else if (field.media_type === 'gmap') {
                        if (field.tv_icon) lines.push(`->icon('heroicon-o-${field.tv_icon}')`);
                        if (field.tv_icon_color) lines.push(`->color('${field.tv_icon_color}')`);
                        lines.push(`->action(\n                    Action::make('Show Google Map')\n                        ->modalHeading(false)->modalFooter(null)\n                        ->modalContent(function (${modelNameSingular} \$record): HtmlString {\n                            if (blank(\$record->${field.field_name})) { return new HtmlString('<p class="text-center">No map link provided.</p>'); }\n                            \$iframeCode = \$record->${field.field_name};\n                            \$responsiveIframeCode = str_replace('width="600"', 'width="100%"', \$iframeCode);\n                            \$responsiveIframeCode = str_replace('height="450"', 'height="450px"', \$responsiveIframeCode);\n                            return new HtmlString(\$responsiveIframeCode);\n                        })\n                )`);
                    } else if (field.media_type === 'youtube') {
                        if (field.tv_icon) lines.push(`->icon('heroicon-o-${field.tv_icon}')`);
                        if (field.tv_icon_color) lines.push(`->color('${field.tv_icon_color}')`);
                        lines.push(`->action(\n                    Action::make('Show Youtube Video')\n                        ->modalHeading(false)->modalFooter(null)\n                        ->modalContent(fn (${modelNameSingular} \$record): HtmlString => new HtmlString(\n                            \$record->${field.field_name}\n                                ? '<iframe src="' . e(\$record->getCleanYoutubeUrl('${field.field_name}')) . '" width="100%" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>'\n                                : '<p class="text-center">No video link provided.</p>'\n                        ))\n                )`);
                    } else { 
                        // ▼▼▼ LOGIK BAHARU UNTUK BOOLEAN (Arahan 1.27) ▼▼▼
                        if (field.data_type === 'BOOLEAN') {
                            lines.push('->boolean()');
                        }
                        // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲
                        
                        if (field.tv_icon) lines.push(`->icon('heroicon-o-${field.tv_icon}')`);
                        if (field.tv_icon_color) lines.push(`->color('${field.tv_icon_color}')`);
                    }
                } else { // TextColumn
                    if (field.allow_sorting === 1) lines.push('->sortable()');
                    if (field.tv_wrap_text === 1) lines.push('->wrap()');
                    if (field.tv_font_weight && field.tv_font_weight !== 'Regular') lines.push(`->weight(FontWeight::${field.tv_font_weight})`);
                    if (field.tv_text_limit) lines.push(`->limit(${field.tv_text_limit}, end: ' (more)')`);
                    if (field.tv_text_color) lines.push(`->color('${field.tv_text_color}')`);
                    if(field.tv_text_size && field.tv_text_size !== 'Normal') lines.push(`->size(TextSize::${field.tv_text_size})`);
                }

                if (field.enable_global_filter === 1 && !field.enable_individual_filter) lines.push('->searchable()');
                if (!field.enable_global_filter && field.enable_individual_filter === 1) lines.push('->searchable(isIndividual: true, isGlobal: false)');
                if (field.enable_global_filter === 1 && field.enable_individual_filter === 1) lines.push('->searchable(isIndividual: true)');
                if (field.tv_wrap_header === 1) lines.push('->wrapHeader()');
                if (field.tv_enable_toggle === 1) lines.push('->toggleable(isToggledHiddenByDefault: true)');
                else lines.push('->toggleable()');
                if (field.tv_description_tooltips === 1 && field.description) lines.push(`->tooltip('${field.description.replace(/'/g, "\\'")}')`);
                if (field.tv_alignment === 'center') lines.push('->alignCenter()');
                else if (field.tv_alignment === 'right') lines.push('->alignEnd()');
                
                const dateTypes = ['DATE', 'DATETIME', 'TIMESTAMP'];
                const numericTypes = ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'];

                if(dateTypes.includes(field.data_type)){
                    const dateFormat = convertDateFormatToPhp(projectSettings.date_format);
                    const timeFormat = convertDateFormatToPhp(projectSettings.time_format);
                    const format = field.data_type === 'DATE' ? dateFormat : `${dateFormat} ${timeFormat}`;
                    lines.push(`->dateTime('${format}')`);
                }
                
                if(numericTypes.includes(field.data_type)){
                    if(field.tv_currency_code) lines.push(`->money('${field.tv_currency_code}')`);
                    else lines.push(`->numeric()`);
                }

                if(field.display_type === 'rich_html') lines.push(`->html()`);
                
                if (field.display_type === 'options_list' && field.options_list_values) {
                    const options = field.options_list_values.split(';;');
                    if (options.length < 7) {
                        const colors = ['gray', 'info', 'primary', 'warning', 'success', 'danger'];
                        const matchArms = options.map((opt, i) => `        '${opt}' => '${colors[i % colors.length]}',`).join('\n');
                        lines.push(`->badge()->color(fn (string \$state): string => match (\$state) {\n${matchArms}\n        })`);
                    }
                }
                
                if (field.data_type === 'JSON') {
                    const jsonFormatter = `->formatStateUsing(function (?array \$state): ?string {
                    if (blank(\$state)) { return null; }
                    if (isset(\$state['${field.field_name}'])) { return \$state['${field.field_name}']; }
                    if (is_array(\$state) && isset(\$state[0]['${field.field_name}'])) { return implode(', ', array_column(\$state, '${field.field_name}')); }
                    return '';
                })`;
                    lines.push(jsonFormatter);
                }

                const hasSummary = field.show_sum === 1 || field.show_avg_summary === 1 || field.show_count_summary === 1 || field.show_range_summary === 1;
                if (hasSummary) {
                    let summaryLines = [];
                    if (field.show_sum === 1) summaryLines.push('Sum::make()');
                    if (field.show_avg_summary === 1) summaryLines.push('Average::make()');
                    if (field.show_count_summary === 1) {
                        if (field.data_type === 'BOOLEAN') summaryLines.push('Count::make()->icons()');
                        else summaryLines.push('Count::make()');
                    }
                    if (field.show_range_summary === 1) {
                        const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT'];
                        if (numericTypes.includes(field.data_type)) summaryLines.push('Range::make()');
                        else if (dateTypes.includes(field.data_type)) summaryLines.push('Range::make()->minimalDateTimeDifference()');
                        else if (stringTypes.includes(field.data_type)) {
                            if (!lines.some(line => line.includes('->sortable()'))) lines.push('->sortable()');
                            summaryLines.push('Range::make()->minimalTextualDifference()');
                        }
                    }
                    if(summaryLines.length > 0) {
                        lines.push(`->summarize([\n                        ${summaryLines.join(',\n                        ')}\n                    ])`);
                    }
                }
                
                columnsCode.push(lines.join('\n                    '));
            }

            tableContent = tableContent.replace('<<ALL_COLUMNS>>', columnsCode.join(',\n                '));

            // --- FASA 3: PEMBERSIHAN ---
            tableContent = tableContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            tableContent = tableContent.replace(/<<.*?>>/g, '');

            const allUseStatements = tableContent.match(/use (.*?);/g) || [];
            let finalContent = tableContent;
            for (const useStmt of allUseStatements) {
                const match = useStmt.match(/use (?:.*\\)?(\w+)(?: as \w+)?;$/);
                if (match) {
                    const className = match[1];
                    const regex = new RegExp(`\\b${className}\\b`, 'g');
                    const occurrences = (finalContent.match(regex) || []).length;
                    if (occurrences <= 1) { 
                        finalContent = finalContent.replace(useStmt + '\n', '');
                    }
                }
            }
            tableContent = finalContent;

            const resourceFolder = modelNamePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Tables');
            fs.mkdirSync(outputFolderPath, { recursive: true });
            const outputFileName = `${modelNamePlural}Table.php`;
            const outputFilePath = path.join(outputFolderPath, outputFileName);
            fs.writeFileSync(outputFilePath, tableContent);
            console.log(`Table Class generated (Final): ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Table Classes (Final) generated successfully.' };
    } catch (error) {
        console.error('Failed to generate Filament Table Classes:', error);
        return { success: false, message: error.message };
    }
}

async function generateFilamentSchemasForm(fullSchema, basePath) {
    try {
        const { project: projectSettings, database: { table: tables, relationships } } = fullSchema;

        const templatePath = path.join(__dirname, 'templates/php/filament/app/Filament/Resources/SchemasForm.template');
        if (!fs.existsSync(templatePath)) throw new Error(`Template file not found at: ${templatePath}`);
        
        const templateContent = fs.readFileSync(templatePath, 'utf8');

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            let formContent = templateContent;
            const tableData = tables[tableName];
            
            // --- FASA 1: KERANGKA UTAMA ---
            const modelNameSingular = toSingularPascalCase(tableName);
            const modelNamePlural = toPluralPascalCase(tableName);
            formContent = formContent.replace(/<<TABLE_NAME_SINGULAR>>/g, modelNameSingular);
            formContent = formContent.replace(/<<TABLE_NAME_PLURAL>>/g, modelNamePlural);

            let importResources = new Set();

            const childRelations = relationships.filter(r => r.parent_table_name === tableName);
            for (const rel of childRelations) {
                const childTable = tables[rel.child_table_name];
                if (childTable && childTable.fields[rel.fk_child_field]) {
                    const fkFieldData = childTable.fields[rel.fk_child_field];
                    if (fkFieldData.lookup_link_behavior && fkFieldData.lookup_link_behavior !== 'disable') {
                        const childPlural = toPluralPascalCase(rel.child_table_name);
                        const childSingular = toSingularPascalCase(rel.child_table_name);
                        importResources.add(`use App\\Filament\\Resources\\${childPlural}\\${childSingular}Resource;`);
                    }
                }
            }

            Object.values(tableData.fields).forEach(field => {
                if (field.lookup_parent_table && field.lookup_link_behavior === 'modal') {
                     const parentPlural = toPluralPascalCase(field.lookup_parent_table);
                     const parentSingular = toSingularPascalCase(field.lookup_parent_table);
                     importResources.add(`use App\\Filament\\Resources\\${parentPlural}\\${parentSingular}Resource;`);
                }
            });

            formContent = formContent.replace('<<IMPORT_RESOURCES>>', Array.from(importResources).join('\n'));

            const gridType = tableData.column_grid_type || 'dynamic';
            if (gridType === 'static') {
                const columns = parseInt(tableData.static_grid_columns) || 2;
                let grid2 = '';
                let grid3 = '';
                if (columns === 2) { grid2 = "'md' => 2,"; } 
                else if (columns === 3) { grid2 = "'md' => 2,"; grid3 = "'xl' => 3,"; }
                
                const staticGridCode = `->columns([
        'default' => 1,
        ${grid2}
        ${grid3}
    ])`;
                formContent = formContent.replace('<<GRID_COLUMN_CONTROL>>', staticGridCode);
            } else {
                const dynamicGridCode = `->columns(fn (Page $livewire) => $livewire->gridColumns)
    ->headerActions([
        Action::make('1 Kolum')
            ->icon('heroicon-o-queue-list')
            ->iconButton()
            ->color('gray')
            ->tooltip('Display 1 column')
            ->action(fn (Page $livewire) => $livewire->gridColumns = 1),

        Action::make('2 Kolum')
            ->icon('heroicon-o-view-columns')
            ->iconButton()
            ->color('gray')
            ->tooltip('Display 2 column')
            ->action(fn (Page $livewire) => $livewire->gridColumns = 2),

        Action::make('3 Kolum')
            ->icon('heroicon-o-table-cells')
            ->iconButton()
            ->color('gray')
            ->tooltip('Display 3 column')
            ->action(fn (Page $livewire) => $livewire->gridColumns = 3),
    ])`;
                formContent = formContent.replace('<<GRID_COLUMN_CONTROL>>', dynamicGridCode);
            }

            formContent = formContent.replace('<<DETAIL_VIEW_TITLE>>', tableData.detail_view_title || '');

            // --- PEMPROSESAN MEDAN ---
            const formFieldsCode = [];
            const visibleFields = Object.values(tableData.fields)
                .filter(field => field.hide_in_dv !== 1)
                .sort((a, b) => (a.field_order ?? 999) - (b.field_order ?? 999));

            for (const field of visibleFields) {
                
                // ============================================================
                // LOGIK FASA 2: MEDAN STANDARD & HUBUNGAN
                // ============================================================
                if (field.media_type === 'link' && !['repeater', 'repeater_simple'].includes(field.display_type)) {
                    let fieldCode = `<<ELEMENT_TYPE>>::make('${field.field_name}')
    <<IS_EMAIL>>
    <<IS_NUMERIC>>
    <<IS_INTEGER>>
    <<IS_PASSWORD>>
    <<IS_PHONE>>
    <<IS_URL>>
    <<IS_READONLY>>
    <<IS_MIN_LENGTH>>
    <<IS_MAX_LENGTH>>
    <<IS_FIXED_LENGTH>>
    <<IS_MIN_VALUE>>
    <<IS_MAX_VALUE>>
    <<IS_REQUIRED>>
    <<IS_OFFAUTOCOMPLETE>>
    <<IS_PREFIX>>
    <<IS_SUFFIX>>
    <<SUFFIX_ICON_TEXT>>
    <<SUFFIX_COLORICON_TEXT>>
    <<IS_MASK>>
    <<IS_PLACEHOLDER>>
    <<IS_COLUMN_SPAN_FULL>>
    <<IS_UNIQUE>>
    <<IS_AUTOFOCUS>>
    <<IS_HELPER_TEXT>>
    <<IS_DEFAULT_VALUE>>
    <<IS_CAPTION>>
    <<IS_SEARCHABLE>>
    <<IS_PRELOAD>>
    <<OPTIONS_LIST_DROPDOWN>>
    <<DISABLED_EDIT_DROPDOWN_RELATIONSHIP>>
    <<IS_RELATIONSHIP_NORMAL>>
    <<PARENT_FIELDS_CAPTION>>
    <<IS_RELATIONSHIP_SELF_REF>>
    <<LINK_TO_PARENT_RECORD>>
    ->trim(),`;

                    let elementType = 'TextInput'; 

                    if (field.lookup_parent_table) {
                        if (field.lookup_display_as === 'radios') {
                            elementType = 'Radio';
                        } else {
                            elementType = 'Select';
                        }
                    } else {
                        if (field.display_type === 'datetime_input') elementType = 'DatePicker'; 
                        else if (field.display_type === 'text_area') elementType = 'Textarea'; 
                        else if (field.display_type === 'rich_html') elementType = 'RichEditor'; 
                        else if (field.display_type === 'check_box') elementType = 'Checkbox'; 
                        else if (field.display_type === 'options_list') {
                            if (['dropdown', 'multi'].includes(field.options_display)) elementType = 'Select'; 
                            else if (field.options_display === 'radios') elementType = 'Radio'; 
                            else if (field.options_display === 'checkboxes') elementType = 'CheckboxList'; 
                        }
                    }
                    
                    fieldCode = fieldCode.replace('<<ELEMENT_TYPE>>', elementType);

                    // Buang trim untuk jenis bukan teks
                    if (['Select', 'Checkbox', 'Radio', 'CheckboxList', 'DatePicker', 'RichEditor'].includes(elementType)) {
                        fieldCode = fieldCode.replace('->trim()', '');
                    }

                    if (field.display_type === 'text_input') {
                        if (field.format_as === 'email') fieldCode = fieldCode.replace('<<IS_EMAIL>>', "->email()");
                        else if (field.format_as === 'password') fieldCode = fieldCode.replace('<<IS_PASSWORD>>', "->password()->revealable()");
                        else if (field.format_as === 'tel') fieldCode = fieldCode.replace('<<IS_PHONE>>', "->tel()->telRegex('/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\\s\\.\\/0-9]*$/')");
                        else if (field.format_as === 'url') fieldCode = fieldCode.replace('<<IS_URL>>', "->url()");
                        else if (field.format_as === 'custom' && field.format_mask) fieldCode = fieldCode.replace('<<IS_MASK>>', `->mask('${field.format_mask}')`);
                    }

                    if (field.display_type === 'text_input') {
                        if (field.min_length && field.min_length === field.max_length) fieldCode = fieldCode.replace('<<IS_FIXED_LENGTH>>', `->length(${field.min_length})`);
                        else {
                            if (field.min_length) fieldCode = fieldCode.replace('<<IS_MIN_LENGTH>>', `->minLength(${field.min_length})`);
                            if (field.max_length) fieldCode = fieldCode.replace('<<IS_MAX_LENGTH>>', `->maxLength(${field.max_length})`);
                        }
                    }

                    if (field.display_type === 'text_input') {
                        if (field.min_value) fieldCode = fieldCode.replace('<<IS_MIN_VALUE>>', `->minValue(${field.min_value})`);
                        if (field.max_value) fieldCode = fieldCode.replace('<<IS_MAX_VALUE>>', `->maxValue(${field.max_value})`);
                    }

                    if (field.display_type === 'text_input') {
                        if (field.read_only === 1) fieldCode = fieldCode.replace('<<IS_READONLY>>', "->readOnly()");
                        if (field.required === 1) fieldCode = fieldCode.replace('<<IS_REQUIRED>>', "->required()->markAsRequired()");
                        if (['INT', 'BIGINT'].includes(field.data_type)) fieldCode = fieldCode.replace('<<IS_INTEGER>>', "->integer()");
                        if (field.data_type === 'DECIMAL') fieldCode = fieldCode.replace('<<IS_NUMERIC>>', "->numeric()");
                        if (field.off_autocomplete === 1) fieldCode = fieldCode.replace('<<IS_OFFAUTOCOMPLETE>>', "->autocomplete(false)");
                    }

                    if (field.helper_text) fieldCode = fieldCode.replace('<<IS_HELPER_TEXT>>', `->helperText('${field.helper_text}')`);
                    if (['text_input', 'text_area', 'rich_html'].includes(field.display_type) && field.placeholder) {
                        fieldCode = fieldCode.replace('<<IS_PLACEHOLDER>>', `->placeholder('${field.placeholder}')`);
                    }
                    if (['text_area', 'rich_html'].includes(field.display_type) && field.column_span_full === 1) {
                        fieldCode = fieldCode.replace('<<IS_COLUMN_SPAN_FULL>>', "->columnSpanFull()");
                    }

                    if (field.unique === 1) fieldCode = fieldCode.replace('<<IS_UNIQUE>>', "->unique(ignoreRecord: true)");
                    if (field.default_value) fieldCode = fieldCode.replace('<<IS_DEFAULT_VALUE>>', `->default('${field.default_value}')`);
                    fieldCode = fieldCode.replace('<<IS_CAPTION>>', `->label('${field.caption || toTitleCase(field.field_name)}')`);

                    if (field.display_type === 'options_list') {
                        if (field.data_type !== 'BOOLEAN') {
                            let optionsCode = '';
                            if (field.options_display === 'multi') optionsCode += "->multiple()\n";
                            if (field.options_list_values) {
                                const optionsArr = field.options_list_values.split(';;').map(opt => `'${opt}' => '${toTitleCase(opt)}'`).join(', ');
                                optionsCode += `->options([${optionsArr}])`;
                            } else {
                                optionsCode += `->options([])`;
                            }
                            fieldCode = fieldCode.replace('<<OPTIONS_LIST_DROPDOWN>>', optionsCode);
                        } else {
                            const trueLabel = field.boolean_label_true || 'True';
                            const falseLabel = field.boolean_label_false || 'False';
                             fieldCode = fieldCode.replace('<<OPTIONS_LIST_DROPDOWN>>', ``); 
                        }
                    }

                    if (field.lookup_parent_table) {
                        const parentTable = field.lookup_parent_table;
                        const caption1 = field.lookup_caption_1;
                        const relationshipName = toSingularCamelCase(parentTable);

                        if (parentTable === tableName) { 
                            const parentIdField = 'id';
                            const selfRefCode = `->relationship(\n    name: 'parent',\n    titleAttribute: '${caption1}',\n    modifyQueryUsing: fn (Builder $query, ?Model $record) => $query->where('${parentIdField}', '!=', $record?->${parentIdField})\n)`;
                            fieldCode = fieldCode.replace('<<IS_RELATIONSHIP_SELF_REF>>', selfRefCode);
                        } else {
                            fieldCode = fieldCode.replace('<<IS_RELATIONSHIP_NORMAL>>', `->relationship('${relationshipName}', '${caption1}')`);
                        }

                        if (field.lookup_caption_2) {
                            const caption2 = field.lookup_caption_2;
                            const separator = field.lookup_separator || ' ';
                            fieldCode = fieldCode.replace('<<PARENT_FIELDS_CAPTION>>', `->getOptionLabelFromRecordUsing(fn (Model $record) => "{$record->${caption1}} ${separator} {$record->${caption2}}")`);
                        }

                        const parentRelation = relationships.find(r => r.child_table_name === tableName && r.fk_child_field === field.field_name);
                        if (parentRelation && parentRelation.show_count_in_tv === 1) {
                            fieldCode = fieldCode.replace('<<DISABLED_EDIT_DROPDOWN_RELATIONSHIP>>', `->disabled(session('foreignkey') === '${field.field_name}')`);
                        }

                        if (field.lookup_searchable === 1) fieldCode = fieldCode.replace('<<IS_SEARCHABLE>>', "->searchable()");
                        if (field.lookup_preload === 1) fieldCode = fieldCode.replace('<<IS_PRELOAD>>', "->preload()");

                        if (field.lookup_link_behavior === 'modal') {
                            const parentTableSingular = toSingularPascalCase(parentTable);
                            const suffixActionCode = `->suffixActions([
    Action::make('view_${parentTable}')
        ->icon('heroicon-o-eye')
        ->modalContent(fn (Get $get): ?View => $get('${field.field_name}') ? view('filament.components.modal-iframe', ['src' => ${parentTableSingular}Resource::getUrl('edit', ['record' => $get('${field.field_name}')]) . '?iframe=1']) : null)
        ->modalWidth('6xl')
        ->modalSubmitAction(false)
        ->hidden(fn (Get $get): bool => !$get('${field.field_name}')),

    Action::make('create_${parentTable}')
        ->icon('heroicon-o-plus')
        ->modalContent(fn (): View => view('filament.components.modal-iframe', ['src' => ${parentTableSingular}Resource::getUrl('create') . '?iframe=1']))
        ->modalWidth('6xl')
        ->modalSubmitAction(false),
])`;
                            fieldCode = fieldCode.replace('<<LINK_TO_PARENT_RECORD>>', suffixActionCode);
                        }
                    }

                    if (field.display_type === 'text_input') {
                        if (field.prefix) fieldCode = fieldCode.replace('<<IS_PREFIX>>', `->prefix('${field.prefix}')`);
                        if (field.suffix) fieldCode = fieldCode.replace('<<IS_SUFFIX>>', `->suffix('${field.suffix}')`);
                        if (field.suffix_icon) fieldCode = fieldCode.replace('<<SUFFIX_ICON_TEXT>>', `->suffixIcon('heroicon-o-${field.suffix_icon}')`);
                        if (field.suffix_icon_color) fieldCode = fieldCode.replace('<<SUFFIX_COLORICON_TEXT>>', `->suffixIconColor('${field.suffix_icon_color}')`);
                    }

                    // ▼▼▼ PENAMBAHBAIKAN BAHARU DI SINI ▼▼▼
                    // Jika element ialah Select, buang ->integer()
                    if (elementType === 'Select') {
                        fieldCode = fieldCode.replace('->integer()', '');
                    }
                    // ▲▲▲ TAMAT PENAMBAHBAIKAN ▲▲▲

                    fieldCode = fieldCode.replace(/<<.*?>>/g, '');
                    fieldCode = fieldCode.replace(/^\s*[\r\n]/gm, '');
                    formFieldsCode.push(fieldCode);
                }

                // ============================================================
                // LOGIK MEDIA
                // ============================================================
                else if (field.media_type === 'image') {
                    const kebabFieldName = field.field_name.replace(/_/g, '-');
                    let imageCode = `FileUpload::make('${field.field_name}')
    ->label('${field.caption || toTitleCase(field.field_name)}')
    ->image()
    <<IMAGE_SHARP>>
    ->imageEditor()
    ->directory('${kebabFieldName}')
    ->disk('${field.image_storage_provider || 'public'}')
    ->downloadable(),`;

                    if (field.dv_thumb_shape === 'circular') {
                        imageCode = imageCode.replace('<<IMAGE_SHARP>>', '->avatar()->circleCropper()');
                    } else {
                        imageCode = imageCode.replace('<<IMAGE_SHARP>>', '');
                    }
                    imageCode = imageCode.replace(/<<.*?>>/g, '').replace(/^\s*[\r\n]/gm, '');
                    formFieldsCode.push(imageCode);
                }

                else if (field.media_type === 'upload') {
                    const kebabFieldName = field.field_name.replace(/_/g, '-');
                    let acceptedTypes = '';
                    if (field.file_types) {
                        acceptedTypes = field.file_types.split(',').map(t => `'${t.trim()}'`).join(', ');
                    }
                    let uploadCode = `FileUpload::make('${field.field_name}')
    ->label('${field.caption || toTitleCase(field.field_name)}')
    ->directory('${kebabFieldName}')
    ->disk('${field.file_storage_provider || 'public'}')
    ->acceptedFileTypes([${acceptedTypes}])
    ->downloadable()
    ->openable(),`;
                    uploadCode = uploadCode.replace(/<<.*?>>/g, '').replace(/^\s*[\r\n]/gm, '');
                    formFieldsCode.push(uploadCode);
                }

                else if (['gmap', 'youtube'].includes(field.media_type)) {
                    const viewerType = field.media_type === 'gmap' ? 'map' : 'video';
                    let mediaViewCode = `TextInput::make('${field.field_name}')
    ->label('${field.caption || toTitleCase(field.field_name)}')
    ->columnSpanFull(),
ViewField::make('${field.field_name}')
    ->view('filament.forms.components.${viewerType}-viewer')
    ->columnSpanFull(),`;
                    mediaViewCode = mediaViewCode.replace(/<<.*?>>/g, '').replace(/^\s*[\r\n]/gm, '');
                    formFieldsCode.push(mediaViewCode);
                }

                // ============================================================
                // LOGIK REPEATER
                // ============================================================
                else if (field.display_type === 'repeater_simple') {
                    const elementType = field.repeater_simple_display_as === 'dropdown_list' ? 'Select' : 'TextInput';
                    let elementCode = `${elementType}::make('${field.field_name}')`;
                    
                    if (field.repeater_simple_display_as === 'text_input') {
                        if (field.repeater_simple_format_as === 'email') elementCode += "->email()";
                        if (field.repeater_simple_format_as === 'url') elementCode += "->url()";
                        if (field.repeater_simple_format_as === 'password') elementCode += "->password()->revealable()";
                        if (field.repeater_simple_format_as === 'tel') elementCode += "->tel()->telRegex('/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\\s\\.\\/0-9]*$/')";
                    }
                    
                    if (field.repeater_simple_required === 1) elementCode += "->required()";
                    
                    if (field.repeater_simple_display_as === 'dropdown_list' && field.repeater_simple_list_values) {
                        const optionsArr = field.repeater_simple_list_values.split(';;').map(opt => `'${opt}' => '${toTitleCase(opt)}'`).join(', ');
                        elementCode += `->options([${optionsArr}])`;
                    }

                    let repeaterCode = `Repeater::make('${field.field_name}')
    ->label('${field.caption || toTitleCase(field.field_name)}')
    ->simple(
        ${elementCode}->unique(ignoreRecord: true),
    )
    ->reorderable(false),`;
                    formFieldsCode.push(repeaterCode);
                }

                else if (field.display_type === 'repeater') {
                    let schemaElements = [];
                    
                    for (let i = 1; i <= 3; i++) {
                        const displayAs = field[`repeater_${i}_display_as`];
                        if (!displayAs) continue; 

                        const subFieldName = `${field.field_name}_${i}`; 

                        const elementType = displayAs === 'dropdown_list' ? 'Select' : 'TextInput';
                        let elementCode = `${elementType}::make('${subFieldName}')\n            ->label('Item ${i}')`;

                        if (displayAs === 'text_input') {
                            const formatAs = field[`repeater_${i}_format_as`];
                            if (formatAs === 'email') elementCode += "->email()";
                            if (formatAs === 'url') elementCode += "->url()";
                            if (formatAs === 'password') elementCode += "->password()->revealable()";
                            if (formatAs === 'tel') elementCode += "->tel()->telRegex('/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\\s\\.\\/0-9]*$/')";
                        }

                        if (field[`repeater_${i}_required`] === 1) elementCode += "->required()";

                        if (displayAs === 'dropdown_list') {
                             const listValues = field[`repeater_${i}_list_values`];
                             if (listValues) {
                                const optionsArr = listValues.split(';;').map(opt => `'${opt}' => '${toTitleCase(opt)}'`).join(', ');
                                elementCode += `->options([${optionsArr}])`;
                             } else {
                                elementCode += `->options([])`;
                             }
                        }
                        schemaElements.push(elementCode + ',');
                    }

                    let repeaterCode = `Repeater::make('${field.field_name}')
    ->label('${field.caption || toTitleCase(field.field_name)}')
    ->schema([
        ${schemaElements.join('\n        ')}
    ])
    ->reorderable(false),`;
                    formFieldsCode.push(repeaterCode);
                }
            } // Tamat loop fields

            formContent = formContent.replace('<<ALL_COLUMNS_FORM>>', formFieldsCode.join('\n'));

            // --- FASA 4: PEMBERSIHAN AKHIR ---
            formContent = formContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, ''); 
            formContent = formContent.replace(/<<.*?>>/g, '');

            // Pembersihan 'use' statement
            const allUseStatements = formContent.match(/use (.*?);/g) || [];
            let finalContent = formContent;
            
            for (const useStmt of allUseStatements) {
                const match = useStmt.match(/use (?:.*\\)?(\w+)(?: as \w+)?;$/);
                if (match) {
                    const className = match[1];
                    const regex = new RegExp(`\\b${className}\\b`, 'g');
                    const occurrences = (finalContent.match(regex) || []).length;
                    
                    if (occurrences <= 1) { 
                        finalContent = finalContent.replace(useStmt + '\n', '');
                    }
                }
            }
            formContent = finalContent;

            const resourceFolder = modelNamePlural;
            const schemasFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'Schemas');
            fs.mkdirSync(schemasFolderPath, { recursive: true });

            const outputFileName = `${modelNameSingular}Form.php`;
            const outputFilePath = path.join(schemasFolderPath, outputFileName);
            
            fs.writeFileSync(outputFilePath, formContent);
            console.log(`Form Schema generated (Final): ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Form Schemas generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Form Schemas:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Menjana fail migrasi Laravel berdasarkan skema projek.
 * @param {object} fullSchema - Objek skema lengkap dari FiziSysMaker (mengandungi tables & relationships).
 * @param {string} projectPath - Laluan root projek Laravel yang dijana.
 */
async function generateLaravelMigrations(fullSchema, outputBasePath) {
    try {
        const { database: { table: tables, relationships } } = fullSchema;
        const migrationsPath = path.join(outputBasePath, 'database', 'migrations');

        if (!fs.existsSync(migrationsPath)) {
            fs.mkdirSync(migrationsPath, { recursive: true });
        }

        let now = new Date();
        let sequence = 0;

        // ==================================================================================
        // FASA 1: CREATE TABLES (Struktur Asas Sahaja - TANPA Foreign Key Constraints)
        // ==================================================================================
        for (const tableName in tables) {
            // Skip jadual sistem Laravel
            if (['migrations', 'jobs', 'failed_jobs', 'sessions', 'password_reset_tokens', 'cache', 'users'].includes(tableName)) continue;

            const tableData = tables[tableName];
            sequence++;
            
            const timestamp = getFormattedTimestamp(now, sequence);
            const fileName = `${timestamp}_create_${tableName}_table.php`;
            
            // Cari Primary Key
            const fieldsArr = Object.values(tableData.fields);
            const pkField = fieldsArr.find(f => f.primary_key === 1);
            
            // Senarai medan yang perlu DIABAIKAN dalam loop biasa
            const ignoredFields = ['created_at', 'updated_at', 'deleted_at'];
            if (pkField) ignoredFields.push(pkField.field_name);

            // Filter dan susun medan
            const regularFields = fieldsArr
                .filter(f => !ignoredFields.includes(f.field_name))
                .sort((a, b) => (a.field_order || 999) - (b.field_order || 999));

            let content = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('${tableName}', function (Blueprint $table) {
`;

            // 1. PRIMARY KEY
            if (pkField) {
                if (['INT', 'INTEGER', 'BIGINT', 'MEDIUMINT', 'SMALLINT', 'TINYINT'].includes(pkField.data_type.toUpperCase())) {
                    if (pkField.field_name === 'id') {
                        content += `            $table->id();\n`;
                    } else {
                        content += `            $table->id('${pkField.field_name}');\n`;
                    }
                } else {
                    content += `            $table->string('${pkField.field_name}')->primary();\n`;
                }
            }

            // 2. MEDAN BIASA (Regular Fields)
            regularFields.forEach(field => {
                const isForeignKey = relationships.some(r => r.child_table_name === tableName && r.fk_child_field === field.field_name);
                let line = '';
                const upperType = field.data_type ? field.data_type.toUpperCase() : 'VARCHAR';

                // --- JENIS DATA ---
                if (isForeignKey && ['INT', 'INTEGER', 'BIGINT'].includes(upperType)) {
                    // Kita guna foreignId tetapi JANGAN letak 'constrained' di sini (Fasa 1)
                    line = `            $table->foreignId('${field.field_name}')`;
                } else if (['VARCHAR', 'STRING', 'CHAR'].includes(upperType)) {
                    const method = upperType === 'CHAR' ? 'char' : 'string';
                    const lengthParam = (field.length && parseInt(field.length) > 0) ? `, ${field.length}` : '';
                    line = `            $table->${method}('${field.field_name}'${lengthParam})`;
                } else {
                    line = `            ${getFieldDefinitionForMigration(field)}`;
                }

                // --- NULLABLE / NOT NULL LOGIC (Dikekalkan) ---
                if (field.not_null !== undefined && field.not_null !== null) {
                    // Jika not_null == 0, tambah nullable(). Jika 1, biarkan default (Not Null).
                    if (Number(field.not_null) === 0) {
                        line += `->nullable()`;
                    }
                } else {
                    // Fallback untuk projek lama
                    if (field.is_nullable === 1) line += `->nullable()`;
                }

                // --- DEFAULT VALUE ---
                if (field.default_value !== null && field.default_value !== undefined && field.default_value !== '') {
                    const defVal = field.default_value;
                    if (defVal.toUpperCase() !== 'NULL') {
                        if (defVal.toUpperCase() === 'CURRENT_TIMESTAMP') {
                            line += `->useCurrent()`;
                        } else if (field.data_type.toUpperCase() === 'BOOLEAN') {
                            const boolVal = (defVal === 'true' || defVal === '1') ? 1 : 0;
                            line += `->default(${boolVal})`;
                        } else if (!isNaN(defVal) && ['INT','DECIMAL','FLOAT','DOUBLE'].some(t => field.data_type.toUpperCase().includes(t))) {
                            line += `->default(${defVal})`;
                        } else {
                            line += `->default('${defVal}')`;
                        }
                    }
                }

                // --- UNIQUE ---
                if (field.is_unique === 1 || field.unique === 1) line += `->unique()`;

                content += `${line};\n`;
            });
            
// ============================================================
            // PENAMBAHAN MULA: Indeks Unik Komposit (Table Constraints)
            // ============================================================
            if (tableData.constraints && tableData.constraints.length > 0) {
                tableData.constraints.forEach(constraint => {
                    // Hanya proses jika jenis adalah UNIQUE
                    if (constraint.constraint_type === 'UNIQUE') {
                        try {
                            // Tukar string JSON '["col1","col2"]' kepada array sebenar
                            const columns = JSON.parse(constraint.columns);
                            
                            if (Array.isArray(columns) && columns.length > 0) {
                                // Format array PHP: ['pelajar_id', 'kursus_id']
                                const columnsPhp = "['" + columns.join("', '") + "']";
                                
                                let line = `            $table->unique(${columnsPhp}`;
                                
                                // Tambah nama constraint jika ada (Optional, tapi digalakkan)
                                if (constraint.constraint_name) {
                                    line += `, '${constraint.constraint_name}'`;
                                }
                                
                                line += `);\n`;
                                content += line;
                            }
                        } catch (error) {
                            console.warn(`Gagal memproses constraint untuk jadual ${tableName}:`, error);
                        }
                    }
                    // Nota: Anda juga boleh tambah logik untuk Composite Primary Key di sini jika perlu
                });
            }
            // ============================================================
            // PENAMBAHAN TAMAT
            // ============================================================

            // 3. TIMESTAMPS & SOFT DELETES
            content += `            $table->timestamps();\n`;
            if (tableData.soft_deletes === 1 || fieldsArr.some(f => f.field_name === 'deleted_at')) {
                content += `            $table->softDeletes();\n`;
            }

            content += `        });
    }

    public function down(): void
    {
        Schema::dropIfExists('${tableName}');
    }
};`;

            fs.writeFileSync(path.join(migrationsPath, fileName), content);
        }

        // ==================================================================================
        // FASA 2: FOREIGN KEYS (Dilakukan dalam fail berasingan untuk elak Circular Dependency)
        // ==================================================================================
        // Kita tambah senggang masa (20 saat) supaya migrasi ini dijalankan selepas semua jadual siap
        sequence += 20; 

        for (const tableName in tables) {
            if (tableName === 'users') continue;

            const childRels = relationships.filter(r => r.child_table_name === tableName);
            if (childRels.length === 0) continue;

            sequence++;
            const timestamp = getFormattedTimestamp(now, sequence);
            const fileName = `${timestamp}_add_foreign_keys_to_${tableName}_table.php`;

            let content = `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('${tableName}', function (Blueprint $table) {
`;
            childRels.forEach(rel => {
                const fk = rel.fk_child_field;
                const parentTable = rel.parent_table_name;
                const parentKey = 'id'; // Default Laravel assumption

                // Ambil nilai on_delete/on_update dari DB atau default ke 'NO ACTION'
                const onDelete = rel.on_delete && rel.on_delete.toLowerCase() !== 'no action' ? rel.on_delete.toLowerCase() : null;
                const onUpdate = rel.on_update && rel.on_update.toLowerCase() !== 'no action' ? rel.on_update.toLowerCase() : null;

                // Membina sintaks Foreign Key
                let line = `            $table->foreign(['${fk}'])->references(['${parentKey}'])->on('${parentTable}')`;
                
                if (onUpdate) line += `->onUpdate('${onUpdate}')`;
                if (onDelete) line += `->onDelete('${onDelete}')`; 
                
                content += `${line};\n`;
            });

            content += `        });
    }

    public function down(): void
    {
        Schema::table('${tableName}', function (Blueprint $table) {
`;
            // Drop Foreign Keys semasa Rollback
            childRels.forEach(rel => {
                content += `            $table->dropForeign(['${rel.fk_child_field}']);\n`;
            });

            content += `        });
    }
};`;
            fs.writeFileSync(path.join(migrationsPath, fileName), content);
        }

        return { success: true, message: 'Migrations generated successfully (2-Phase Safe Mode).' };

    } catch (error) {
        console.error('Migration Error:', error);
        return { success: false, message: error.message };
    }
}
// ==========================================
// Helper Functions
// ==========================================

function getFieldDefinition(field) {
    const name = field.field_name;
    let def = '';

    // 1. Primary Key
    if (field.primary_key === 1) {
        if (field.data_type.includes('INT')) return `$table->id('${name}');`;
        return `$table->string('${name}')->primary();`;
    }

    // 2. Map Data Type
    const typeMap = {
        'VARCHAR': 'string', 'CHAR': 'char', 'TEXT': 'text', 'MEDIUMTEXT': 'mediumText', 'LONGTEXT': 'longText',
        'INT': 'integer', 'INTEGER': 'integer', 'BIGINT': 'bigInteger', 'TINYINT': 'tinyInteger', 'SMALLINT': 'smallInteger',
        'DECIMAL': 'decimal', 'FLOAT': 'float', 'DOUBLE': 'double',
        'DATE': 'date', 'DATETIME': 'dateTime', 'TIMESTAMP': 'timestamp', 'TIME': 'time',
        'BOOLEAN': 'boolean', 'JSON': 'json', 'ENUM': 'enum'
    };
    
    // Kendalian khas TINYINT(1) -> boolean
    let laravelType = typeMap[field.data_type.toUpperCase()] || 'string';
    if (field.data_type.toUpperCase() === 'TINYINT' && field.max_length == 1) laravelType = 'boolean';

    // Bina baris kod
    if (laravelType === 'enum') {
        const opts = field.options_list_values ? field.options_list_values.split(';;').map(o => `'${o}'`).join(', ') : '';
        def = `$table->enum('${name}', [${opts}])`;
    } 
    else if (laravelType === 'decimal') {
        def = `$table->decimal('${name}', 10, 2)`;
    }
    else {
        def = `$table->${laravelType}('${name}')`;
    }

    // 3. Modifiers
    if (field.is_nullable === 1) def += '->nullable()';
    if (field.is_unique === 1 || field.unique === 1) def += '->unique()';
    
    // Default Value
    if (field.default_value !== null && field.default_value !== '') {
        if (field.default_value === 'CURRENT_TIMESTAMP') def += '->useCurrent()';
        else if (field.data_type === 'BOOLEAN') def += `->default(${field.default_value === 'true' ? 1 : 0})`;
        else if (['INT','DECIMAL','FLOAT'].some(t => field.data_type.includes(t))) def += `->default(${field.default_value})`;
        else def += `->default('${field.default_value}')`;
    }

    return def + ';';
}
// ==========================================
// Helper Functions (Perlu ada dalam skop yang sama atau diimport)
// ==========================================

// Menjana timestamp YYYY_MM_DD_HHMMSS + offset saat
function getFormattedTimestamp(date, offsetSeconds) {
    const d = new Date(date.getTime() + (offsetSeconds * 1000));
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function getFieldDefinitionForMigration(field) {
    const name = field.field_name;
    const type = field.data_type.toUpperCase();
    const length = field.max_length;

    // Pemetaan Jenis Data
    if (type === 'INT' || type === 'INTEGER') return `$table->integer('${name}')`;
    if (type === 'BIGINT') return `$table->bigInteger('${name}')`;
    if (type === 'TINYINT') return (length == 1) ? `$table->boolean('${name}')` : `$table->tinyInteger('${name}')`;
    if (type === 'SMALLINT') return `$table->smallInteger('${name}')`;
    if (type === 'VARCHAR') return `$table->string('${name}', ${length || 255})`;
    if (type === 'CHAR') return `$table->char('${name}', ${length || 255})`;
    if (type === 'TEXT') return `$table->text('${name}')`;
    if (type === 'MEDIUMTEXT') return `$table->mediumText('${name}')`;
    if (type === 'LONGTEXT') return `$table->longText('${name}')`;
    if (type === 'DATE') return `$table->date('${name}')`;
    if (type === 'DATETIME') return `$table->dateTime('${name}')`;
    if (type === 'TIMESTAMP') return `$table->timestamp('${name}')`;
    if (type === 'TIME') return `$table->time('${name}')`;
    if (type === 'DECIMAL') return `$table->decimal('${name}', 10, 2)`; // Default precision
    if (type === 'FLOAT') return `$table->float('${name}')`;
    if (type === 'DOUBLE') return `$table->double('${name}')`;
    if (type === 'BOOLEAN') return `$table->boolean('${name}')`;
    if (type === 'JSON') return `$table->json('${name}')`;
    
    if (type === 'ENUM') {
        const opts = field.options_list_values 
            ? field.options_list_values.split(';;').map(o => `'${o}'`).join(', ')
            : '';
        return `$table->enum('${name}', [${opts}])`;
    }

    return `$table->string('${name}')`; // Fallback
}

/**
 * Menjana fail RelationManager Laravel Filament untuk setiap hubungan one-to-many.
 * @param {object} fullSchema - Objek penuh dari getFullProjectSchema.
 * @param {string} basePath - Laluan asas ke folder 'generated'.
 */
async function generateFilamentRelationManagers(fullSchema, basePath) {
    try {
        const { database: { relationships } } = fullSchema;

        const templatePath = path.join(__dirname, 'templates/php/filament/app/Filament/Resources/RelationManagers.template');
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template file not found at: ${templatePath}`);
        }
        const templateContent = fs.readFileSync(templatePath, 'utf8');

        // Loop melalui setiap hubungan yang wujud
        for (const rel of relationships) {
            // Langkau jika ia adalah 'one-to-one' atau melibatkan jadual 'users'
            if (rel.relationship_type === 'one-to-one' || rel.parent_table_name === 'users' || rel.child_table_name === 'users') {
                continue;
            }

            let managerContent = templateContent;

            // Sediakan semua variasi nama yang diperlukan
            const parentTablePlural = toPluralPascalCase(rel.parent_table_name);
            const childTablePlural = toPluralPascalCase(rel.child_table_name);
            const childTableSingular = toSingularPascalCase(rel.child_table_name);
            
            // Tentukan nama fungsi hubungan yang betul
            const relationshipName = rel.parent_table_name === rel.child_table_name
                ? 'children' // Guna 'children' untuk hubungan kepada diri sendiri
                : toPluralCamelCase(rel.child_table_name); // Guna nama biasa untuk hubungan lain
            
            // Lakukan penggantian placeholder
            managerContent = managerContent.replace(/<<TABLE_NAME_PLURAL>>/g, parentTablePlural);
            managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_PLURAL>>/g, childTablePlural);
            managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_PLURAL_CAMEL>>/g, relationshipName);
            managerContent = managerContent.replace(/<<CHILD_TABLE_NAME_SINGULAR>>/g, childTableSingular);

            // Bersihkan placeholder yang tidak digunakan dan baris kosong
            managerContent = managerContent.replace(/^\s*<<.*?>>\s*\r?\n/gm, '');
            managerContent = managerContent.replace(/<<.*?>>/g, '');

            // Jana fail output
            const resourceFolder = parentTablePlural;
            const outputFolderPath = path.join(basePath, 'app', 'Filament', 'Resources', resourceFolder, 'RelationManagers');
            fs.mkdirSync(outputFolderPath, { recursive: true });

            const outputFileName = `${childTableSingular}RelationManager.php`;
            const outputFilePath = path.join(outputFolderPath, outputFileName);
            
            fs.writeFileSync(outputFilePath, managerContent);
            console.log(`RelationManager generated: ${outputFilePath}`);
        }
        
        return { success: true, message: 'Filament Relation Managers generated successfully.' };

    } catch (error) {
        console.error('Failed to generate Filament Relation Managers:', error);
        return { success: false, message: error.message };
    }
}

// Di dalam src/main.js

ipcMain.handle('generate-app', async () => {
    const win = BrowserWindow.getFocusedWindow();
    try {
        const activeProject = await db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
        if (!activeProject) {
            throw new Error("No active project found.");
        }

        const fullSchema = await getFullProjectSchema(activeProject.project_id);
        if (!fullSchema) {
            throw new Error("Failed to retrieve the full project schema.");
        }
        
        win?.webContents.send('show-overlay', { message: 'Generating application files...' });

        const generatedAppPath = getGeneratedFolderPath();
        const filamentPath = path.join(generatedAppPath, 'filament_app');

        // Panggil semua fungsi penjana yang sedia ada...
        await generateFilamentModels(fullSchema, filamentPath);
        await generateFilamentUserModel(fullSchema, filamentPath);
        await generateFilamentResources(fullSchema, filamentPath);
        await generateFilamentListPages(fullSchema, filamentPath);
        await generateFilamentCreatePages(fullSchema, filamentPath);
        await generateFilamentEditPages(fullSchema, filamentPath);
        await generateFilamentRelationManagers(fullSchema, filamentPath);

        const tableClassResult = await generateFilamentTablesTable(fullSchema, filamentPath);
        if (!tableClassResult.success) throw new Error(`Filament Table Class generation failed: ${tableClassResult.message}`);
        
        const formSchemaResult = await generateFilamentSchemasForm(fullSchema, filamentPath);
        if (!formSchemaResult.success) throw new Error(`Filament Form Schema generation failed: ${formSchemaResult.message}`);
        
        // ▼▼▼ TAMBAHAN BARU DI SINI: Generate Migrations ▼▼▼
        // Menggunakan fullSchema dan filamentPath yang SAMA seperti fungsi lain
        const migrationResult = await generateLaravelMigrations(fullSchema, filamentPath);
        if (!migrationResult.success) throw new Error(`Laravel Migration generation failed: ${migrationResult.message}`);
        // ▲▲▲ TAMAT TAMBAHAN ▲▲▲

        console.log(`All files generated successfully in: ${filamentPath}`);

        return { 
            success: true, 
            message: 'Application files generated successfully!',
            folderPath: filamentPath 
        };
    } catch (error) {
        console.error('Gagal menjana aplikasi:', error);
        return { success: false, message: error.message };
    } finally {
        win?.webContents.send('hide-overlay');
    }
});

// Handler untuk membuka folder
ipcMain.on('open-folder', (event, path) => {
    shell.openPath(path);
});

/**
 * Menjalankan 'composer install' di dalam folder projek yang telah dijana.
 * @param {string} projectPath Laluan penuh ke folder di mana 'composer.json' berada.
 * @returns {Promise<boolean>} Mengembalikan true jika berjaya, false jika gagal.
 */
async function runComposerInstall(projectPath) {
  return new Promise((resolve, reject) => {
    // Tentukan laluan ke PHP dan Composer berdasarkan mod aplikasi
    const isPackaged = app.isPackaged;
    const baseBinPath = isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin')
      : path.join(__dirname, '../../bin'); // Keluar dari src/main

    const phpPath = path.join(baseBinPath, 'win-php-8.x', 'php.exe');
    const composerPath = path.join(baseBinPath, 'composer.phar');

    console.log(`Running composer in: ${projectPath}`);
    console.log(`Using PHP: ${phpPath}`);

    // Gunakan spawn untuk kawalan yang lebih baik
    const composerProcess = spawn(phpPath, [composerPath, 'install'], {
      cwd: projectPath, // Tetapkan direktori kerja ke folder projek yang dijana
      stdio: 'pipe' // Tangkap output
    });

    // Dengar output untuk dipaparkan (cth., di konsol atau hantar ke UI)
    composerProcess.stdout.on('data', (data) => {
      console.log(`Composer: ${data.toString()}`);
      // Di sini anda boleh hantar kemajuan ke tetingkap UI
      // mainWindow.webContents.send('composer-output', data.toString());
    });

    composerProcess.stderr.on('data', (data) => {
      console.error(`Composer Error: ${data.toString()}`);
    });

    composerProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Composer install completed successfully.');
        resolve(true);
      } else {
        console.error(`Composer process exited with code ${code}`);
        reject(false);
      }
    });

    composerProcess.on('error', (err) => {
        console.error('Failed to start Composer process.', err);
        reject(false);
    });
  });
}

// IPC handler untuk menerima permintaan dari UI
ipcMain.handle('run-composer', async (event, projectPath) => {
    try {
        return await runComposerInstall(projectPath);
    } catch (error) {
        return false;
    }
});

// ADD THESE TWO NEW HANDLERS ANYWHERE INSIDE: src/main.js

ipcMain.handle('table:save-constraint', async (event, { table_id, constraint_type, columns }) => {
    if (!table_id || !constraint_type || !columns || columns.length === 0) {
        return { success: false, message: 'Invalid data provided for constraint.' };
    }

    try {
        const transaction = db.transaction(() => {
            // 1. Simpan definisi kekangan baharu
            const columnsJson = JSON.stringify(columns);
            db.prepare(
                `INSERT INTO table_constraints (table_id, constraint_type, columns) VALUES (?, ?, ?)`
            ).run(table_id, constraint_type, columnsJson);

            // 2. Kemas kini status 'unique' untuk setiap medan yang terlibat
            const updateStmt = db.prepare(`UPDATE fields SET "unique" = 1 WHERE table_id = ? AND field_name = ?`);
            for (const fieldName of columns) {
                updateStmt.run(table_id, fieldName);
            }
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error("Gagal menyimpan kekangan jadual:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('table:delete-constraint', async (event, { constraint_id }) => {
    if (!constraint_id) {
        return { success: false, message: 'Constraint ID is required.' };
    }
    
    try {
        const transaction = db.transaction(() => {
            // 1. Dapatkan maklumat kekangan sebelum memadam
            const constraint = db.prepare('SELECT * FROM table_constraints WHERE constraint_id = ?').get(constraint_id);
            if (!constraint) {
                throw new Error('Constraint not found.');
            }
            const { table_id, columns: columnsJson } = constraint;
            const columns = JSON.parse(columnsJson);

            // 2. Padam kekangan itu sendiri
            db.prepare('DELETE FROM table_constraints WHERE constraint_id = ?').run(constraint_id);

            // 3. Semak semula setiap medan yang terlibat
            const checkStmt = db.prepare('SELECT 1 FROM table_constraints WHERE table_id = ? AND columns LIKE ? LIMIT 1');
            const updateStmt = db.prepare(`UPDATE fields SET "unique" = 0 WHERE table_id = ? AND field_name = ?`);
            
            for (const fieldName of columns) {
                // Semak jika medan ini masih sebahagian daripada KEKANGAN UNIK LAIN
                const isStillUnique = checkStmt.get(table_id, `%"${fieldName}"%`);
                
                // Jika tidak, buang status 'unique' daripadanya
                if (!isStillUnique) {
                    updateStmt.run(table_id, fieldName);
                }
            }
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error("Gagal memadam kekangan jadual:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('field:update-index', async (event, { field_id, is_indexed }) => {
    try {
        db.prepare('UPDATE fields SET is_indexed = ? WHERE field_id = ?').run(is_indexed ? 1 : 0, field_id);
        return { success: true };
    } catch (error) {
        console.error("Gagal mengemas kini indeks medan:", error);
        return { success: false, message: error.message };
    }
});
