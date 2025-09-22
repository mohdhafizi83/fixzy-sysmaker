// main.js (Proses Utama Electron) - DIPERBETULKAN

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { Parser } = require("node-sql-parser");
const parser = new Parser();

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
// Tambah keseluruhan fungsi ini di dalam src/main.js
// FIND AND REPLACE THIS ENTIRE HANDLER IN: src/main.js
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

// main.js

async function getFullProjectSchema(projectId) {
  try {
    const project = db.prepare("SELECT * FROM projects WHERE project_id = ?").get(projectId);
    if (!project) throw new Error(`Projek dengan ID ${projectId} tidak ditemui.`);

    const tables = db.prepare("SELECT * FROM tables WHERE project_id = ? ORDER BY table_order, table_id").all(projectId);
    const tableIds = tables.map((t) => t.table_id);

    let fields = [];
    if (tableIds.length > 0) {
        const placeholder = tableIds.map(() => "?").join(",");
        fields = db.prepare(`SELECT * FROM fields WHERE table_id IN (${placeholder}) ORDER BY field_order, field_id`).all(...tableIds);
    }
    
    const structuredTables = {};
    tables.forEach((table) => {
      structuredTables[table.table_name] = { ...table, fields: {} };
    });
    fields.forEach((field) => {
      const parentTable = tables.find((t) => t.table_id === field.table_id);
      if (parentTable) {
        structuredTables[parentTable.table_name].fields[field.field_name] = field;
      }
    });

    let relationships = [];
    if (tableIds.length > 0) {
      const placeholder = tableIds.map(() => "?").join(",");
      relationships = db.prepare(
          `SELECT r.*, p.table_name as parent_table_name, c.table_name as child_table_name
           FROM parent_child_relationships r
           JOIN tables p ON r.parent_table_id = p.table_id
           JOIN tables c ON r.child_table_id = c.table_id
           WHERE r.parent_table_id IN (${placeholder}) OR r.child_table_id IN (${placeholder})`
        ).all(...tableIds, ...tableIds);
    }

    const groups = db.prepare("SELECT * FROM menu_groups WHERE project_id = ? ORDER BY group_order, group_name").all(projectId);
    const groupedItems = db.prepare(`
        SELECT mi.*, t.table_name 
        FROM menu_items mi
        JOIN tables t ON mi.table_id = t.table_id
        WHERE mi.project_id = ? AND mi.menu_group_id IS NOT NULL
        ORDER BY mi.item_order
    `).all(projectId);
    
    const individualItems = db.prepare(`
        SELECT mi.*, t.table_name
        FROM menu_items mi
        LEFT JOIN tables t ON mi.table_id = t.table_id
        WHERE mi.project_id = ? AND mi.menu_group_id IS NULL
        ORDER BY mi.item_order
    `).all(projectId);

    const structuredMenuGroups = groups.map(group => {
        return {
            ...group,
            items: groupedItems.filter(item => item.menu_group_id === group.menu_group_id)
        };
    });

    return {
      project: project,
      database: {
        name: project.app_title,
        table: structuredTables,
        relationships: relationships,
        menu_groups: structuredMenuGroups,
        individual_menus: individualItems
      },
    };
  } catch (error) {
    console.error("Gagal mengambil skema penuh (fungsi bantuan):", error);
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
// main.js

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
        
        const maxOrderResult = db.prepare('SELECT MAX(field_order) as max_order FROM fields WHERE table_id = ?').get(tableId);
        const nextOrder = (maxOrderResult && maxOrderResult.max_order !== null ? maxOrderResult.max_order : -1) + 1;

        const info = db.prepare(
            `INSERT INTO fields (table_id, field_name, caption, data_type, length, field_order) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(tableId, newName, newName, defaultType, defaultLength, nextOrder);

        return db.prepare('SELECT * FROM fields WHERE field_id = ?').get(info.lastInsertRowid);
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
            // 1. Cipta jadual
            const info = db.prepare(
                'INSERT INTO tables (project_id, table_name, table_view_title, table_order) VALUES (?, ?, ?, ?)'
            ).run(projectId, newName, newName, nextOrder);
            const tableId = info.lastInsertRowid;

            // 2. Cipta item menu yang sepadan
            const maxMenuOrderResult = db.prepare(
                'SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL'
            ).get(projectId);
            const nextMenuOrder = (maxMenuOrderResult && maxMenuOrderResult.max_order !== null ? maxMenuOrderResult.max_order : -1) + 1;
            
            // ▼▼▼ MULA PERUBAHAN ▼▼▼
            const itemUrl = `${newName} Resource`;
            db.prepare(
                'INSERT INTO menu_items (project_id, table_id, item_label, item_url, item_order, menu_group_id) VALUES (?, ?, ?, ?, ?, NULL)'
            ).run(projectId, tableId, newName, itemUrl, nextMenuOrder);
            // ▲▲▲ TAMAT PERUBAHAN ▲▲▲
            
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

    let fields = [];
    if (tableIds.length > 0) {
        const placeholder = tableIds.map(() => "?").join(",");
        fields = db.prepare(`SELECT * FROM fields WHERE table_id IN (${placeholder}) ORDER BY field_order, field_id`).all(...tableIds);
    }
    
    let customViews = [];
    if (tableIds.length > 0) {
        const placeholder = tableIds.map(() => "?").join(",");
        customViews = db.prepare(`SELECT * FROM custom_views WHERE table_id IN (${placeholder}) ORDER BY view_order`).all(...tableIds);
    }

    let customViewFields = [];
    const viewIds = customViews.map(v => v.custom_view_id);
    if (viewIds.length > 0) {
        const placeholder = viewIds.map(() => "?").join(",");
        customViewFields = db.prepare(`SELECT * FROM custom_view_fields WHERE custom_view_id IN (${placeholder}) ORDER BY display_order`).all(...viewIds);
    }

    const structuredTables = {};
    tables.forEach((table) => {
      const viewsForTable = customViews.filter(v => v.table_id === table.table_id);
      viewsForTable.forEach(view => {
          view.fields = customViewFields.filter(f => f.custom_view_id === view.custom_view_id);
      });
      structuredTables[table.table_name] = { ...table, fields: {}, custom_views: viewsForTable };
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
           WHERE r.parent_table_id IN (${placeholder}) OR r.child_table_id IN (${placeholder})`
        )
        .all(...tableIds, ...tableIds);
    }

    const groups = db.prepare("SELECT * FROM menu_groups WHERE project_id = ? ORDER BY group_order").all(projectId);
    const groupedItems = db.prepare(`SELECT mi.*, t.table_name FROM menu_items mi LEFT JOIN tables t ON mi.table_id = t.table_id WHERE mi.project_id = ? AND mi.menu_group_id IS NOT NULL ORDER BY mi.item_order`).all(projectId);
    const topLevelItems = db.prepare(`SELECT mi.*, t.table_name FROM menu_items mi LEFT JOIN tables t ON mi.table_id = t.table_id WHERE mi.project_id = ? AND mi.menu_group_id IS NULL ORDER BY item_order`).all(projectId);
    
    const unifiedMenu = [];
    groups.forEach(group => {
        unifiedMenu.push({ type: 'group', id: group.menu_group_id, order: group.group_order, name: group.group_name, items: groupedItems.filter(item => item.menu_group_id === group.menu_group_id) });
    });
    

topLevelItems.forEach(item => {
    // ▼▼▼ LOGIK BAHARU UNTUK MENGENAL PASTI JENIS ITEM ▼▼▼
    let itemType = 'custom_item';
    if (item.table_id) {
        itemType = 'table_item';
    } else if (item.custom_view_id) {
        itemType = 'custom_view_item';
    }
    // ▲▲▲ TAMAT LOGIK BAHARU ▲▲▲

    unifiedMenu.push({ 
        type: itemType, 
        id: item.item_id, 
        table_id: item.table_id,
        custom_view_id: item.custom_view_id, // Tambah ini untuk rujukan
        order: item.item_order, 
            label: item.item_label || item.table_name, 
            url: item.item_url, 
            table_name: item.table_name 
        });
    });
    unifiedMenu.sort((a, b) => (a.order || 0) - (b.order || 0));

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
});

// ADD THIS NEW HANDLER in: src/main.js
ipcMain.handle('menu:save-unified-structure', async (event, { projectId, menuStructure }) => {
    if (!projectId || !Array.isArray(menuStructure)) {
        return { success: false, message: "Data tidak sah." };
    }
    
    const transaction = db.transaction(() => {
        const updateGroupStmt = db.prepare('UPDATE menu_groups SET group_name = ?, group_order = ? WHERE menu_group_id = ?');
        const updateItemStmt = db.prepare('UPDATE menu_items SET item_order = ?, menu_group_id = ? WHERE item_id = ?');

        // 1. Set all items to be top-level first to handle items being moved out of groups.
        db.prepare('UPDATE menu_items SET menu_group_id = NULL WHERE project_id = ?').run(projectId);
        
        // 2. Iterate through the new structure and apply changes.
        menuStructure.forEach((topLevelItem, topIndex) => {
            if (topLevelItem.type === 'group') {
                // Update the group's name and its order among top-level items.
                updateGroupStmt.run(topLevelItem.name, topIndex, topLevelItem.id);
                // Update each child item to belong to this group with its new order.
                topLevelItem.items.forEach((childItem, childIndex) => {
                    updateItemStmt.run(childIndex, topLevelItem.id, childItem.id);
                });
            } else { // type 'table_item' or 'custom_item'
                // Update the top-level item's order. Its group_id is already NULL.
                updateItemStmt.run(topIndex, null, topLevelItem.id);
            }
        });
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

// FIND AND REPLACE THIS ENTIRE FUNCTION IN: src/main.js

function importSchema(sql, projectId, dialect) {
    const dialectMap = {
        'MySQL': 'mysql',
        'PostgreSQL': 'postgresql',
        'TSQL': 'mysql', 
        'SQLite': 'sqlite'
    };
    const parserDialect = dialectMap[dialect] || 'mysql';

    let tablesCreated = 0;
    let relationshipsCreated = 0;
    const tableMap = {};
    const foreignKeysToProcess = [];

    let processedSql = sql;

    if (dialect === 'TSQL') {
        processedSql = processedSql
            .replace(/^GO\s*$/gim, '')
            .replace(/IDENTITY\s*\(\d+\s*,\s*\d+\)/gi, 'AUTO_INCREMENT')
            .replace(/\((MAX)\)/gi, '')
            .replace(/\b(NVARCHAR|VARCHAR|TEXT)\s*(?!\()/gi, 'TEXT ')
            .replace(/GETDATE\(\)/gi, 'CURRENT_TIMESTAMP')
            .replace(/\bN(VARCHAR|CHAR|TEXT)\b/gi, '$1')
            // ▼▼▼ PENAMBAHBAIKAN ▼▼▼
            .replace(/\bDATETIME2\b/gi, 'DATETIME'); // Tukar DATETIME2 kepada DATETIME
            // ▲▲▲ TAMAT PENAMBAHBAIKAN ▲▲▲
    }
    
    if (dialect === 'SQLite') {
        processedSql = processedSql.replace(/^PRAGMA.*?;/gim, '');
    }

    if (dialect === 'MySQL') {
        processedSql = processedSql.replace(
            /\s+ENGINE=\w+\s*DEFAULT\s*CHARSET=\w+(\s*COLLATE=\w+)?(\s*COMMENT='.*?')?;/gi,
            ";"
        );
    }
    
    const getFieldNameFromAST = (columnRef) => {
        if (!columnRef || !columnRef.column) return 'parse_error';
        if (typeof columnRef.column === 'string') return columnRef.column;
        if (typeof columnRef.column === 'object' && columnRef.column.expr && columnRef.column.expr.value) {
            return columnRef.column.expr.value;
        }
        console.warn("Unrecognized field name structure in AST:", JSON.stringify(columnRef, null, 2));
        return String(columnRef.column); 
    };
    
    const extractDefaultValue = (defaultNode) => {
        if (!defaultNode || !defaultNode.value) return null;
        const valueNode = defaultNode.value;
        switch (valueNode.type) {
            case "null": return "NULL";
            case "single_quote_string": case "number": return String(valueNode.value);
            case "function":
                if (valueNode.name && valueNode.name.name && Array.isArray(valueNode.name.name)) {
                    return valueNode.name.name.map(part => part.value).join('.');
                }
                break;
        }
        return null;
    };
	
    let tableOrder = 0;
	
    const transaction = db.transaction((ast) => {
        const getMaxMenuOrderStmt = db.prepare('SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL');
        const insertMenuItemStmt = db.prepare('INSERT INTO menu_items (project_id, table_id, item_label, item_url, item_order, menu_group_id) VALUES (?, ?, ?, ?, ?, NULL)');

        for (const statement of ast) {
            if (statement.type === "create" && statement.keyword === "table") {
                const tableName = statement.table[0].table;
                const tableInfo = db.prepare("INSERT INTO tables (project_id, table_name, table_view_title, table_order) VALUES (?, ?, ?, ?)").run(projectId, tableName, tableName, tableOrder); 
                tableOrder++;
                const tableId = tableInfo.lastInsertRowid;
                tablesCreated++;
                tableMap[tableName] = tableId;

                const maxOrderResult = getMaxMenuOrderStmt.get(projectId);
                const nextMenuOrder = (maxOrderResult && maxOrderResult.max_order !== null ? maxOrderResult.max_order : -1) + 1;
                const itemUrl = `${tableName} Resource`;
                insertMenuItemStmt.run(projectId, tableId, tableName, itemUrl, nextMenuOrder);

				let fieldOrder = 0;
                const tableLevelConstraints = [];
                for (const col of statement.create_definitions) {
                    if (col.resource === "column") {
                        let dataType = col.definition.dataType;
                        if ((col.auto_increment || col.autoincrement) && !dataType) dataType = 'INTEGER';
                        if (dataType && Array.isArray(col.definition.suffix) && col.definition.suffix.length > 0) {
                            dataType += ' ' + col.definition.suffix.join(' ');
                        }
                        if (!dataType) {
                            console.warn(`Could not determine data type for column '${getFieldNameFromAST(col.column)}'. Defaulting to 'TEXT'.`);
                            dataType = 'TEXT';
                        }
                        const extractedFieldName = getFieldNameFromAST(col.column);
                        let fieldData = {
                            table_id: tableId,
                            field_name: extractedFieldName,
                            caption: extractedFieldName,
							field_order: fieldOrder,
                            data_type: dataType,
                            length: col.definition.length || null,
                            precision: col.definition.scale || null,
                            required: 0,
                            auto_increment: 0,
                            unsigned: 0,
                            zero_fill: 0,
                            primary_key: 0,
                            unique: 0,
                            text_area: 0, 
                            rich_html: 0,
							read_only: 0,
                            default_value: null,
                        };
                        const upperDataType = fieldData.data_type ? fieldData.data_type.toUpperCase() : '';
                        if (upperDataType === 'TEXT') fieldData.text_area = 1;
                        else if (upperDataType === 'MEDIUMTEXT' || upperDataType === 'LONGTEXT') fieldData.rich_html = 1;
                        
                        if (col.auto_increment || col.autoincrement) {
                            fieldData.auto_increment = 1;
                        }
                        if ((col.nullable && col.nullable.type === "not null") && !fieldData.auto_increment) fieldData.required = 1;
                        if (col.unsigned) fieldData.unsigned = 1;
                        if (col.zerofill) fieldData.zero_fill = 1;
                        if (col.default_val) fieldData.default_value = extractDefaultValue(col.default_val);
                        
                        if (col.constraints) {
                            for (const constraint of col.constraints) {
                                const definition = constraint.definition || constraint;
                                switch (definition.constraint_type.toLowerCase()) {
                                    case "primary key": fieldData.primary_key = 1; fieldData.read_only = 1; break;
                                    case "unique key": fieldData.unique = 1; break;
                                    case "not null": fieldData.required = 1; break;
                                    case "autoincrement": 
                                    case "auto_increment": fieldData.auto_increment = 1; break;
                                    case "default": if (!fieldData.default_value) fieldData.default_value = extractDefaultValue(definition); break;
                                }
                            }
                        }
                        if (col.primary_key === 'primary key') {
                            fieldData.primary_key = 1;
                            fieldData.read_only = 1;
                        }
                        db.prepare(`INSERT INTO fields (table_id, field_name, data_type, length, precision, required, auto_increment, unsigned, zero_fill, primary_key, "unique", text_area, rich_html, read_only, default_value, caption, field_order) VALUES (@table_id, @field_name, @data_type, @length, @precision, @required, @auto_increment, @unsigned, @zero_fill, @primary_key, @unique, @text_area, @rich_html, @read_only, @default_value, @caption, @field_order)`).run(fieldData);
                        fieldOrder++;
                    } else if (col.resource === "constraint") {
                        tableLevelConstraints.push(col);
                    }
                }

                for (const constraint of tableLevelConstraints) {
                    if (constraint.constraint_type) {
                        const constraintType = constraint.constraint_type.toLowerCase();
                        if (constraintType === "primary key" && constraint.definition && Array.isArray(constraint.definition)) {
                            for (const colDef of constraint.definition) {
                                db.prepare(`UPDATE fields SET primary_key = 1, read_only = 1 WHERE table_id = ? AND field_name = ?`).run(tableId, getFieldNameFromAST({column: colDef.column}));
                            }
                        } else if (constraintType === "unique key" && constraint.definition && Array.isArray(constraint.definition)) {
                            for (const colDef of constraint.definition) {
                                db.prepare(`UPDATE fields SET "unique" = 1 WHERE table_id = ? AND field_name = ?`).run(tableId, getFieldNameFromAST({column: colDef.column}));
                            }
                        } else if (constraintType === "foreign key" && constraint.reference_definition && constraint.definition && constraint.definition.length > 0 && constraint.reference_definition.definition && constraint.reference_definition.definition.length > 0) {
                            const parentTableName = constraint.reference_definition.table[0].table;
                            const fkChildField = getFieldNameFromAST({column: constraint.definition[0].column});
                            const parentField = getFieldNameFromAST({column: constraint.reference_definition.definition[0].column});
                            foreignKeysToProcess.push({ childTableName: tableName, parentTableName: parentTableName, fkChildField: fkChildField, parentField: parentField, tabTitle: tableName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) });
                        }
                    }
                }
            }
        }

        for (const fk of foreignKeysToProcess) {
            const childTableId = tableMap[fk.childTableName];
            const parentTableId = tableMap[fk.parentTableName];
            if (childTableId && parentTableId) {
                db.prepare(`INSERT INTO parent_child_relationships (parent_table_id, child_table_id, fk_child_field, parent_field, tab_title) VALUES (?, ?, ?, ?, ?)`).run(parentTableId, childTableId, fk.fkChildField, fk.parentField, fk.tabTitle);
                relationshipsCreated++;
                let captionField = '';
                const parentFields = db.prepare('SELECT field_name, primary_key, data_type FROM fields WHERE table_id = ? ORDER BY field_order').all(parentTableId);
                const nonNumericTypes = ['VARCHAR', 'CHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'DATE', 'DATETIME', 'TIMESTAMP'];
                const nonNumericField = parentFields.find(f => {
                    const upperType = f.data_type ? f.data_type.toUpperCase() : '';
                    return nonNumericTypes.includes(upperType);
                });
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
        return {
            success: true,
            message: `Successfully imported ${tablesCreated} tables and ${relationshipsCreated} relationships!`,
        };
    } catch (error) {
        console.error("Gagal mengimport SQL:", error);
        return { success: false, message: `SQL Parsing/Import Error: ${error.message}` };
    }
}

ipcMain.handle("sql:import-file", async (event, { projectId, dialect }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "SQL Files", extensions: ["sql"] }],
  });

  if (!canceled && filePaths.length > 0) {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.webContents.send('show-overlay');
    
    const sqlContent = fs.readFileSync(filePaths[0], "utf8");
    return importSchema(sqlContent, projectId, dialect);
  }
  return { success: false, message: "No file selected." };
});

ipcMain.handle("sql:import-text", (event, { sql, projectId, dialect }) => {
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
            'module_auth_google_sso', 'module_authorization', 'module_log_audit', 'data_delete_type'
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
                'default_sort_by', 'sort_descending', 'allow_sorting', 'allow_filters', 'allow_csv_export',
                'allow_print_view', 'allow_user_save_filters', 'allow_mass_delete', 'tv_template', 'hide_field_captions', 'use_first_field_as_title', 'table_view_classes_input',
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
            'show_link_above', 'show_count_in_tv', 'allow_add_from_tv'
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

ipcMain.handle('generate-app', async () => {
    try {
        const generatedAppPath = getGeneratedFolderPath();
        const newFilePath = path.join(generatedAppPath, 'fail_baru.php');
        const fileContent = '<?php\n\n// Ini adalah fail yang dijana secara automatik.\necho "Hello, FiziSysMaker!";';

        // Tulis fail ke dalam folder 'generated' di AppData
        fs.writeFileSync(newFilePath, fileContent);

        console.log(`Fail berjaya dicipta di: ${newFilePath}`);

        // Hantar kembali status kejayaan dan laluan fail
        return { 
            success: true, 
            path: newFilePath,
            folderPath: generatedAppPath // Hantar laluan folder juga
        };
    } catch (error) {
        console.error('Gagal menulis fail:', error);
        return { success: false, message: error.message };
    }
});

// Handler untuk membuka folder
ipcMain.on('open-folder', (event, path) => {
    shell.openPath(path);
});
