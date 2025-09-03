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
      path.join(__dirname, "schema.sql"),
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
ipcMain.handle('database:batch-update', async (event, queue) => {
    if (!queue) return { success: false, message: 'Queue is empty.' };

    const transaction = db.transaction(() => {
        // Kemas kini Projek
        if (queue.project && Object.keys(queue.project).length > 0) {
            // Asumsikan hanya ada satu projek aktif, jadi ID tidak diperlukan dari queue
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

        // Kemas kini Jadual (DIPERBAIKI)
        if (queue.tables && Object.keys(queue.tables).length > 0) {
            for (const id in queue.tables) {
                const { ...fieldsToUpdate } = queue.tables[id];
                // Buang 'table_name' jika ia dihantar untuk tujuan konteks sahaja
                if (Object.keys(fieldsToUpdate).length > 1 && fieldsToUpdate.table_name === db.prepare('SELECT table_name FROM tables WHERE table_id = ?').get(id).table_name) {
                    delete fieldsToUpdate.table_name;
                }
                const setClause = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
                const values = Object.values(fieldsToUpdate);
                if (setClause) db.prepare(`UPDATE tables SET ${setClause} WHERE table_id = ?`).run(...values, id);
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
                // 'rel' akan mempunyai { childTableName, fk_child_field }
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

// FIND AND REPLACE THIS ENTIRE HANDLER IN: src/main.js

ipcMain.handle('menu:save-custom-item', async (event, { item_id, project_id, label, url, menu_group_id }) => {
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
            db.prepare( // KEMAS KINI: Tambah menu_group_id
                `UPDATE menu_items SET item_label = ?, item_url = ?, menu_group_id = ? WHERE item_id = ? AND project_id = ?`
            ).run(label, url, menu_group_id || null, item_id, project_id);
        } else {
            // Logic to insert a new item
            if (!label) {
                 throw new Error("Label is required for a new menu item.");
            }
            
            // ▼▼▼ START OF FIX ▼▼▼
            // Check if the label corresponds to an existing table to get its ID
            const table = db.prepare(
                'SELECT table_id FROM tables WHERE table_name = ? AND project_id = ?'
            ).get(label, project_id);
            const tableId = table ? table.table_id : null;
            // ▲▲▲ END OF FIX ▲▲▲
            
            // ▼▼▼ MULA PERUBAHAN: Kira 'order' berdasarkan kumpulan ▼▼▼
            let nextOrder;
            if (menu_group_id) {
                const maxOrderResult = db.prepare(
                    'SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id = ?'
                ).get(project_id, menu_group_id);
                nextOrder = (maxOrderResult && maxOrderResult.max_order !== null ? maxOrderResult.max_order : -1) + 1;
            } else {
                const maxOrderResult = db.prepare(
                    'SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL'
                ).get(project_id);
                nextOrder = (maxOrderResult && maxOrderResult.max_order !== null ? maxOrderResult.max_order : -1) + 1;
            }
            // ▲▲▲ TAMAT PERUBAHAN ▲▲▲

            // ▼▼▼ MODIFIED INSERT STATEMENT ▼▼▼
            db.prepare(
                `INSERT INTO menu_items (project_id, table_id, item_label, item_url, item_order, menu_group_id) VALUES (?, ?, ?, ?, ?, ?)`
            ).run(project_id, tableId, label, url, nextOrder, menu_group_id || null);
            // ▲▲▲ END OF MODIFICATION ▲▲▲
        }
        return { success: true };
    } catch (error) {
        console.error("Gagal menyimpan item menu:", error);
        return { success: false, message: error.message };
    }
});

// ▼▼▼ TAMBAH KESELURUHAN HANDLER BAHARU INI SELEPAS BLOK DI ATAS ▼▼▼
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
        // ▼▼▼ MULA PERUBAHAN: Pastikan nama kumpulan unik dan tidak null ▼▼▼
        const baseName = groupName || 'New Group';
        let finalName = baseName;
        let counter = 1;
        const checkNameStmt = db.prepare('SELECT 1 FROM menu_groups WHERE project_id = ? AND group_name = ?');
        while (checkNameStmt.get(projectId, finalName)) {
            counter++;
            finalName = `${baseName} ${counter}`;
        }
        // ▲▲▲ TAMAT PERUBAHAN ▲▲▲

        const maxOrderResult = db.prepare(
            'SELECT MAX(COALESCE(group_order, 0)) as max_order FROM menu_groups WHERE project_id = ?'
        ).get(projectId);
        
        const nextOrder = (maxOrderResult?.max_order ?? -1) + 1;

        const info = db.prepare(
            'INSERT INTO menu_groups (project_id, group_name, group_order) VALUES (?, ?, ?)'
        ).run(projectId, finalName, nextOrder); // Guna 'finalName' yang unik
        
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
            const deleteTable = db.prepare('DELETE FROM tables WHERE table_id = ?');

            for (const tableName of tableNamesToDelete) {
                const table = getTableId.get(projectId, tableName);
                if (table) {
                    deleteTable.run(table.table_id);
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
// main.js

ipcMain.handle('table:create', async (event, projectId) => {
    try {
        let newName;
        let isUnique = false;
        const checkStmt = db.prepare('SELECT table_id FROM tables WHERE project_id = ? AND table_name = ?');

        while (!isUnique) {
            // ▼▼▼ BARIS INI DIUBAH UNTUK MENJANA HURUF SAHAJA ▼▼▼
            const randomChars = Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * 26))).join('');
            newName = `table_${randomChars}`;
            const existingTable = checkStmt.get(projectId, newName);
            if (!existingTable) {
                isUnique = true;
            }
        }

        const maxOrderResult = db.prepare('SELECT MAX(table_order) as max_order FROM tables WHERE project_id = ?').get(projectId);
        const nextOrder = (maxOrderResult ? (maxOrderResult.max_order || 0) : 0) + 1;

        const info = db.prepare(
            'INSERT INTO tables (project_id, table_name, table_view_title, table_order) VALUES (?, ?, ?, ?)'
        ).run(projectId, newName, newName, nextOrder);

        return db.prepare('SELECT * FROM tables WHERE table_id = ?').get(info.lastInsertRowid);

    } catch (error) {
        console.error("Gagal mencipta jadual baharu:", error);
        return null;
    }
});

// Handler untuk mendapatkan skema penuh
// FIND AND REPLACE THIS ENTIRE HANDLER IN: src/main.js

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
           WHERE r.parent_table_id IN (${placeholder}) OR r.child_table_id IN (${placeholder})`
        )
        .all(...tableIds, ...tableIds);
    }

    // ▼▼▼ MULA LOGIK MENU BERSEPADU ▼▼▼
    const groups = db.prepare(
        "SELECT * FROM menu_groups WHERE project_id = ? ORDER BY group_order"
    ).all(projectId);
      
    const groupedItems = db.prepare(`
        SELECT mi.*, t.table_name 
        FROM menu_items mi
        LEFT JOIN tables t ON mi.table_id = t.table_id
        WHERE mi.project_id = ? AND mi.menu_group_id IS NOT NULL
        ORDER BY mi.item_order
    `).all(projectId);
    
    const topLevelItems = db.prepare(`
        SELECT mi.*, t.table_name
        FROM menu_items mi
        LEFT JOIN tables t ON mi.table_id = t.table_id
        WHERE mi.project_id = ? AND mi.menu_group_id IS NULL ORDER BY item_order
    `).all(projectId);

    // Gabungkan kumpulan dan item peringkat atasan ke dalam satu senarai
    const unifiedMenu = [];

    groups.forEach(group => {
        unifiedMenu.push({
            type: 'group',
            id: group.menu_group_id,
            order: group.group_order,
            name: group.group_name,
            // Lampirkan item-item yang tergolong dalam kumpulan ini
            items: groupedItems.filter(item => item.menu_group_id === group.menu_group_id)
        });
    });

    topLevelItems.forEach(item => {
        unifiedMenu.push({
            type: item.table_id ? 'table_item' : 'custom_item',
            id: item.item_id,
            order: item.item_order,
            label: item.item_label || item.table_name,
            url: item.item_url,
            table_name: item.table_name,
        });
    });
    
    // Susun senarai bersepadu berdasarkan 'order'
    unifiedMenu.sort((a, b) => (a.order || 0) - (b.order || 0));
    // ▲▲▲ TAMAT LOGIK MENU BERSEPADU ▲▲▲

    return {
      project: project,
      database: {
        name: project.app_title,
        table: structuredTables,
        relationships: relationships,
        unified_menu: unifiedMenu, // Hantar data yang telah disatukan
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
	
    let tableOrder = 0;
	
    const transaction = db.transaction((ast) => {
        for (const statement of ast) {
            if (statement.type === "create" && statement.keyword === "table") {
                const tableName = statement.table[0].table;
                const tableInfo = db
                    .prepare(
                        // UBAH PENYATAAN INSERT DI BAWAH
                        "INSERT INTO tables (project_id, table_name, table_view_title, table_order) VALUES (?, ?, ?, ?)"
                    )
                    .run(projectId, tableName, tableName, tableOrder); // TAMBAH 'tableOrder'
                
                tableOrder++;
                const tableId = tableInfo.lastInsertRowid;
                tablesCreated++;
                tableMap[tableName] = tableId;

				let fieldOrder = 0;
                const tableLevelConstraints = [];
                for (const col of statement.create_definitions) {
                    if (col.resource === "column") {
                        let fieldData = {
                            table_id: tableId,
                            field_name: col.column.column,
							field_order: fieldOrder,
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
                            `INSERT INTO fields (table_id, field_name, data_type, length, required, auto_increment, unsigned, zero_fill, primary_key, "unique", text_area, rich_html, read_only, default_value, caption, field_order) VALUES (@table_id, @field_name, @data_type, @length, @required, @auto_increment, @unsigned, @zero_fill, @primary_key, @unique, @text_area, @rich_html, @read_only, @default_value, @field_name, @field_order)`
                        ).run(fieldData);
                        
                        fieldOrder++; // TAMBAH PADA PENGHITUNG
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
                // 1. Cipta hubungan parent-child dalam pangkalan data
                db.prepare(
                    `INSERT INTO parent_child_relationships 
                     (parent_table_id, child_table_id, fk_child_field, parent_field, tab_title) 
                     VALUES (?, ?, ?, ?, ?)`
                ).run(parentTableId, childTableId, fk.fkChildField, fk.parentField, fk.tabTitle);
                relationshipsCreated++;

                // 2. Logik baharu: Cari medan kapsyen secara automatik
                let captionField = '';
                const parentFields = db.prepare('SELECT field_name, primary_key, data_type FROM fields WHERE table_id = ? ORDER BY field_order').all(parentTableId);
                
                // Keutamaan 1: Cari medan bukan numerik yang pertama.
                const nonNumericTypes = ['VARCHAR', 'CHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'DATE', 'DATETIME', 'TIMESTAMP'];
                const nonNumericField = parentFields.find(f => nonNumericTypes.includes(f.data_type.toUpperCase()));

                if (nonNumericField) {
                    captionField = nonNumericField.field_name;
                }
                // Keutamaan 2: Jika gagal, cari medan pertama selepas primary key.
                else {
                    const pkIndex = parentFields.findIndex(f => f.primary_key === 1);
                    if (pkIndex > -1 && pkIndex + 1 < parentFields.length) {
                        captionField = parentFields[pkIndex + 1].field_name;
                    }
                }

                // 3. Jika medan kapsyen ditemui, kemas kini medan foreign key
                if (captionField) {
                    db.prepare(
                        `UPDATE fields 
                         SET lookup_parent_table = ?, lookup_caption_1 = ? 
                         WHERE table_id = ? AND field_name = ?`
                    ).run(fk.parentTableName, captionField, childTableId, fk.fkChildField);
                }
            }
        }
    });

    try {
        const ast = parser.astify(cleanedSql, { database: "MySQL" });
        transaction(ast);
        return {
            success: true,
            message: `Successfully imported ${tablesCreated} tables and ${relationshipsCreated} relationships!`,
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
    // ▼▼▼ KEMAS KINI DI SINI ▼▼▼
    // Hantar isyarat ke frontend untuk paparkan overlay SELEPAS fail dipilih
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.webContents.send('show-overlay');
    // ▲▲▲ TAMAT KEMAS KINI ▲▲▲

    const sqlContent = fs.readFileSync(filePaths[0], "utf8");
    return importSchema(sqlContent, projectId);
  }
  return { success: false, message: "No file selected." };
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
    width: 1200, // Lebar ini masih berguna sebagai saiz sandaran
    height: 800, // Tinggi ini masih berguna sebagai saiz sandaran
    show: false, // UBAH: Mulakan tetingkap secara tersembunyi
	resizable: false, //Kunci saiz tetingkap
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // TAMBAH: Panggil fungsi maximize() pada objek tetingkap
  win.maximize();
  
  win.loadFile("src/index.html");

  // TAMBAH: Tunjukkan tetingkap hanya apabila ia sedia untuk dipaparkan
  win.on('ready-to-show', () => {
    win.show();
  });
  
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

// Handler baharu untuk mengemas kini tetapan jadual
ipcMain.handle('table:update', async (event, data) => {
    try {
        const { table_id, ...fieldsToUpdate } = data;
        if (!table_id) {
            throw new Error("Table ID tidak dibekalkan.");
        }

        if (fieldsToUpdate.hasOwnProperty('table_name')) {
            const newTableName = fieldsToUpdate.table_name;
            let isNameValid = true;

            // 1. Semak jika null atau kosong
            if (!newTableName || newTableName.trim() === '') {
                isNameValid = false;
            }
            // 2. Semak jika mengandungi aksara tidak sah
            else if (!/^[a-zA-Z_]+$/.test(newTableName)) {
                isNameValid = false;
            }
            // 3. Semak jika nama sudah wujud (untuk jadual lain dalam projek yang sama)
            else {
                const projectInfo = db.prepare('SELECT project_id FROM tables WHERE table_id = ?').get(table_id);
                const existingTable = db.prepare(
                    'SELECT table_id FROM tables WHERE project_id = ? AND table_name = ? AND table_id != ?'
                ).get(projectInfo.project_id, newTableName, table_id);
                if (existingTable) {
                    isNameValid = false;
                }
            }

            // Jika tidak sah, buang 'table_name' dari senarai kemas kini
            if (!isNameValid) {
                delete fieldsToUpdate.table_name;
            }
        }
		
        // Senarai lajur yang dibenarkan untuk dikemas kini dalam jadual 'tables'
        const allowedColumns = [
		    'table_name',
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
