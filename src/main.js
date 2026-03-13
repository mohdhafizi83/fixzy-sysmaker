// main.js (Proses Utama Electron) - DIPERBETULKAN

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { Parser } = require("node-sql-parser");
const parser = new Parser();
const { spawn } = require('child_process');
// Pembolehubah untuk menjejak proses pelayan PHP
let previewServerProcess = null;

// ▼▼▼ TAMBAH DUA BARIS INI (Sistem Memori Hot Reload) ▼▼▼
let lastGeneratedSchema = null; 
let lastPreviewScenario = 0;
const pluralize = require('pluralize');

// IMPORT FUNGSI BANTUAN DARI UTILS
const { 
    convertDateFormatToPhp,
    toPascalCase,
    toFlatCase,
    toTitleCase,
    toSingularPascalCase,
    toSingularCamelCase,
    toPluralPascalCase,
    toPluralCamelCase,
    getFilesRecursive,
    runStep
} = require('./utils');

// =================================================================
// IMPORT GENERATORS (STRUKTUR MODULAR BARU)
// =================================================================

// 1. Resources Induk
const { 
    generateFilamentResources, 
    generateFilamentResourcesCustomModules 
} = require('./generators/laravelResourceGenerator');

// 2. List Pages
const { 
    generateFilamentListPages, 
    generateFilamentListCustomModules 
} = require('./generators/laravelListGenerator');

// 3. Create Pages
const { 
    generateFilamentCreatePages, 
    generateFilamentCreateCustomModules 
} = require('./generators/laravelCreateGenerator');

// 4. Edit Pages
const { 
    generateFilamentEditPages, 
    generateFilamentEditCustomModules 
} = require('./generators/laravelEditGenerator');

// 5. Relation Managers
const { 
    generateFilamentRelationManagers 
} = require('./generators/laravelRelationManagersGenerator');

// 6. Tables (Jadual)
const { 
    generateFilamentTablesTable, 
    generateFilamentTablesCustomModules 
} = require('./generators/laravelTablesGenerator');

// 7. Forms (Schemas)
const { 
    generateFilamentSchemasForm, 
    generateFilamentSchemasCustomModules 
} = require('./generators/laravelSchemasGenerator');

// 8. Database Layer (Kekal Sama)
const { 
    generateFilamentModels,
    generateFilamentUserModel,
    generateLaravelUserMigration,
    generateLaravelMigrations, 
    generateLaravelFactories, 
    generateLaravelDatabaseSeeder 
} = require('./generators/laravelDatabaseGenerator');

const { generateFilamentExports } = require('./generators/laravelExportsGenerator');

const { generateFilamentImporters } = require('./generators/laravelImportersGenerator');

const { generateAdminPanelProvider } = require('./generators/laravelAdminPanelGenerator');

const { generateDeploymentGuidePage } = require('./generators/laravelDocsGenerator');

const { deployApp, updateApp } = require('./deploymentHandler');

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

// =================================================================
// FUNGSI BANTUAN: SALIN FOLDER DENGAN PROGRESS BAR (FIZIKAL 100%)
// =================================================================
async function copyDirWithProgress(src, dest, onProgress) {
    let totalFiles = 0;
    async function countFiles(dir) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (let entry of entries) {
            if (entry.isDirectory()) {
                await countFiles(path.join(dir, entry.name));
            } else {
                totalFiles++;
            }
        }
    }
    await countFiles(src);

    let copiedFiles = 0;
    async function copyRecursive(source, destination) {
        await fs.promises.mkdir(destination, { recursive: true });
        const entries = await fs.promises.readdir(source, { withFileTypes: true });

        for (let entry of entries) {
            const srcPath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);

            if (entry.isDirectory()) {
                await copyRecursive(srcPath, destPath);
            } else {
                await fs.promises.copyFile(srcPath, destPath); // Salinan fizikal sebenar
                copiedFiles++;
                
                if (copiedFiles % 100 === 0 || copiedFiles === totalFiles) {
                    const percentage = Math.round((copiedFiles / totalFiles) * 100);
                    onProgress(copiedFiles, totalFiles, percentage);
                }
            }
        }
    }

    await copyRecursive(src, dest);
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
            const newUrl = `${newTableName} Module`;

            // KEMAS KINI DIPERBAIKI: Kemas kini label dan URL berdasarkan table_id,
            // tanpa mengira apa nilai lama mereka. Ini memastikan konsistensi.
            db.prepare(
                'UPDATE menu_items SET item_label = ?, item_detail = ? WHERE table_id = ?'
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


ipcMain.handle('menu:save-custom-item', async (event, { item_id, project_id, label, url, menu_group_id, table_id, module_id, show_record_count }) => {
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
                 SET item_label = ?, item_detail = ?, menu_group_id = ?, table_id = ?, module_id = ?, show_record_count = ? 
                 WHERE item_id = ? AND project_id = ?`
            ).run(label, url || null, menu_group_id || null, table_id || null, module_id || null, show_record_count ? 1 : 0, item_id, project_id);

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
                `INSERT INTO menu_items (project_id, table_id, module_id, item_label, item_detail, item_order, menu_group_id, show_record_count) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(project_id, table_id || null, module_id || null, label, url || null, nextOrder, menu_group_id || null, show_record_count ? 1 : 0);
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
    // 1. PENAPIS KESELAMATAN (PROTECTED FIELDS)
    const protectedFields = ['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by'];
    
    if (protectedFields.includes(fieldName)) {
        console.warn(`[Keselamatan] Cubaan memadam medan sistem dikesan: ${fieldName}`);
        return { success: false, message: "Akses Ditolak: Medan sistem asas ini tidak boleh dipadam kerana ia penting untuk operasi teras Laravel Filament." };
    }

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
                'INSERT INTO tables (project_id, table_name, module_name, table_view_title, table_order) VALUES (?, ?, ?, ?, ?)'
            ).run(projectId, newName, newName, newName, nextOrder);
            const tableId = info.lastInsertRowid;

// Tambah `hide_in_tv` dan `hide_in_dv` pada senarai lajur
            const insertFieldStmt = db.prepare(`
                INSERT INTO fields (table_id, field_name, caption, data_type, length, primary_key, auto_increment, unsigned, read_only, field_order, hide_in_tv, hide_in_dv)
                VALUES (@table_id, @field_name, @caption, @data_type, @length, @primary_key, @auto_increment, @unsigned, @read_only, @field_order, @hide_in_tv, @hide_in_dv)
            `);

            // 1a. Cipta medan 'id' (Sembunyikan dari TV dan DV)
            insertFieldStmt.run({
                table_id: tableId, field_name: 'id', caption: 'ID', data_type: 'INT',
                length: 11, primary_key: 1, auto_increment: 1, unsigned: 1, read_only: 1, field_order: 0, hide_in_tv: 1, hide_in_dv: 1
            });

            // 1b. Cipta medan Timestamps & Userstamps (Blameable)
            const systemFields = [
                { name: 'created_at', caption: 'Created At', type: 'DATETIME', length: null, order: 1 },
                { name: 'updated_at', caption: 'Updated At', type: 'DATETIME', length: null, order: 2 },
                { name: 'deleted_at', caption: 'Deleted At', type: 'DATETIME', length: null, order: 3 },
                { name: 'created_by', caption: 'Created By', type: 'BIGINT', length: 20, order: 4 },
                { name: 'updated_by', caption: 'Updated By', type: 'BIGINT', length: 20, order: 5 },
                { name: 'deleted_by', caption: 'Deleted By', type: 'BIGINT', length: 20, order: 6 }
            ];

            for (const sysFld of systemFields) {
                insertFieldStmt.run({
                    table_id: tableId, 
                    field_name: sysFld.name, 
                    caption: sysFld.caption, 
                    data_type: sysFld.type,
                    length: sysFld.length, 
                    primary_key: 0, 
                    auto_increment: 0, 
                    unsigned: sysFld.type === 'BIGINT' ? 1 : 0, // Unsigned untuk ID Pengguna
                    read_only: 1, // Userstamps adalah read_only
                    field_order: sysFld.order, 
                    hide_in_tv: 1, 
                    hide_in_dv: 1
                });
            }
            
            const maxMenuOrderResult = db.prepare(
                'SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL'
            ).get(projectId);
            const nextMenuOrder = (maxMenuOrderResult && maxMenuOrderResult.max_order !== null ? maxMenuOrderResult.max_order : -1) + 1;
            
            const itemUrl = `${newName} Module`;
            db.prepare(
                'INSERT INTO menu_items (project_id, table_id, item_label, item_detail, item_order, menu_group_id) VALUES (?, ?, ?, ?, ?, NULL)'
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
            'INSERT INTO tables (project_id, table_name, module_name, table_view_title, table_order) VALUES (?, ?, ?, ?, ?)'
        ).run(projectId, 'users', 'Users', 'Users', 0);
        const tableId = tableInfo.lastInsertRowid;

        // 4. Cipta item menu untuk jadual 'users'
        const menuUrl = 'users Module';
        db.prepare(
            'INSERT INTO menu_items (project_id, table_id, item_label, item_detail, item_order) VALUES (?, ?, ?, ?, ?)'
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

ipcMain.handle('projects:get-all', async () => {
    try {
        return db.prepare('SELECT project_id, app_title, is_active FROM projects ORDER BY app_title').all();
    } catch (error) {
        console.error("Gagal mendapatkan senarai projek:", error);
        return [];
    }
});

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
            'copy_children_async', 'allow_pwa_install', 'url', 'project_hook_workflow', 'stack_base', 'stack_database',
			'stack_theme', 'module_auth_email_2fa', 'module_auth_email_captcha', 'module_auth_ldap',
            'module_auth_google_sso', 'module_authorization', 'module_log_audit', 'data_delete_type', 'module_fake_data', 'tenancy_type', 'tenant_table'
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
                'table_name', 'module_name', 'table_view_title', 'table_description', 'show_quick_search', 'allow_pagination', 'pagination_type', 'default_sort_by', 'sort_descending', 'allow_csv_export', 'allow_csv_import', 'allow_print_view', 'allow_mass_delete', 'show_edit_button', 'show_delete_button', 'allow_restore_delete', 'allow_force_delete', 'tv_template', 'hide_field_captions', 'use_first_field_as_title', 'table_view_classes_input', 'detail_view_classes_input', 'detail_view_title', 'record_owner', 'default_focus', 'redirect_after_insert', 'enable_detail_view', 'delete_with_children', 'dv_allow_print_view', 'dv_separate_page', 'dv_hide_save_as_copy', 'dv_sticky_buttons', 'dv_allow_add_from_homepage', 'column_grid_type', 'static_grid_columns', 'table_hook_workflow', 'feature_source'
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
console.log(setClause);
            // 2. Jika nama jadual ditukar, kemas kini juga 'menu_items'
            if (oldTableName && fieldsToUpdate.table_name) {
                const newTableName = fieldsToUpdate.table_name;
                const newUrl = `${newTableName} Module`;
                const oldUrl = `${oldTableName} Module`;

                // Kemas kini label HANYA jika ia sepadan dengan nama jadual lama
                db.prepare(
                    'UPDATE menu_items SET item_label = ? WHERE table_id = ? AND item_label = ?'
                ).run(newTableName, table_id, oldTableName);
                
                // Kemas kini URL HANYA jika ia sepadan dengan format 'Module' yang lama
                db.prepare(
                    'UPDATE menu_items SET item_detail = ? WHERE table_id = ? AND item_detail = ?'
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
		    'field_name', 'caption', 'description', 'data_type', 'length', 'precision', 'alignment', 'default_value', 'read_only', 'helper_text', 'placeholder', 'min_length', 'max_length', 'min_value', 'max_value', 'primary_key', 'zero_fill', 'required', 'display_type', 'auto_increment', 'unique', 'not_null', 'is_indexed', 'show_sum', 'show_avg_summary', 'show_count_summary', 'show_range_summary', 'allow_sorting', 'tv_wrap_header', 'tv_wrap_text', 'tv_enable_toggle', 'tv_description_tooltips', 'tv_text_limit', 'tv_text_size', 'tv_font_weight', 'tv_date_time_format', 'tv_alignment', 'tv_text_color', 'tv_icon', 'tv_icon_color', 'tv_currency_code', 'unsigned', 'enable_global_filter', 'enable_individual_filter', 'enable_range_filter', 'binary', 'hide_in_tv', 'editable_in_tv', 'hide_in_dv', 'media_type', 'media_link_behavior', 'media_link_display_as', 'media_link_other_field', 'allow_image_uploads', 'image_storage_provider', 'max_file_size', 'delete_image_server', 'dont_rename_image', 'tv_thumb_shape', 'tv_thumb_width', 'tv_thumb_height', 'tv_enable_zooming', 'tv_show_full_size', 'dv_thumb_shape', 'dv_thumb_width', 'dv_thumb_height', 'dv_enable_zooming', 'dv_show_full_size', 'allow_file_uploads', 'file_storage_provider', 'file_types', 'file_max_size', 'delete_file_server', 'dont_rename_file', 'file_behavior', 'file_display_as', 'file_other_field', 'display_gmap', 'gmap_type', 'gmap_tv_width', 'gmap_tv_height', 'gmap_dv_height', 'accept_video_url', 'youtube_tv_width', 'youtube_tv_height', 'youtube_dv_width', 'youtube_dv_height', 'lookup_parent_table', 'lookup_caption_1', 'lookup_separator', 'lookup_caption_2', 'lookup_display_as', 'lookup_inherit_permissions', 'lookup_link_behavior', 'lookup_searchable', 'lookup_preload', 'options_list_values', 'options_display', 'options_quick_list', 'boolean_label_true', 'boolean_label_false', 'format_as', 'format_mask', 'off_autocomplete', 'column_span_full', 'repeater_simple_display_as', 'repeater_simple_format_as', 'repeater_simple_list_values', 'repeater_1_display_as', 'repeater_1_format_as', 'repeater_1_list_values', 'repeater_2_display_as', 'repeater_2_format_as', 'repeater_2_list_values', 'repeater_3_display_as', 'repeater_3_format_as', 'repeater_3_list_values', 'repeater_simple_required', 'repeater_1_required', 'repeater_2_required', 'repeater_3_required', 'prefix', 'suffix', 'suffix_icon', 'suffix_icon_color', 'calculated_enable', 'calculated_query', 'lookup_custom_query', 'algorithm_enable', 'algorithm_logic', 'calculation_builder_state', 'hook_functions'
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

// HANDLER UNTUK UPSERT RELATIONSHIP
ipcMain.handle('relationship:upsert', async (event, data) => {
    console.log("--- [MAIN] Menerima Request Upsert Relationship ---", data);
    
    try {
        const { parentTableName, childTableName, fk_child_field } = data;
        
        // 1. Validasi Input
        if (!parentTableName || !childTableName || !fk_child_field) {
             return { success: false, message: "Data tidak lengkap." };
        }

        // 2. Dapatkan ID Jadual & Module Name
        const parentTable = db.prepare("SELECT table_id FROM tables WHERE table_name = ?").get(parentTableName);
        
        // Kita ambil 'module_name' sekali untuk Child Table
        const childTable = db.prepare("SELECT table_id, module_name FROM tables WHERE table_name = ?").get(childTableName);

        if (!parentTable || !childTable) {
            return { success: false, message: `Table not found.` };
        }

        // 3. Cari Relationship Sedia Ada
        const existingRel = db.prepare(`
            SELECT relationship_id FROM parent_child_relationships 
            WHERE fk_child_field = ? AND child_table_id = ?
        `).get(fk_child_field, childTable.table_id);

        const transaction = db.transaction(() => {
            if (existingRel) {
                // UPDATE: Hanya kemaskini parent_table_id. 
                // Kita TIDAK update tab_title di sini untuk elak overwrite custom title pengguna.
                console.log(`--- [MAIN] Mengemaskini Relationship ID: ${existingRel.relationship_id}`);
                db.prepare(`
                    UPDATE parent_child_relationships 
                    SET parent_table_id = ? 
                    WHERE relationship_id = ?
                `).run(parentTable.table_id, existingRel.relationship_id);
            } else {
                // INSERT: Logik Title Case di sini
                console.log("--- [MAIN] Mencipta Relationship Baharu");
                
                // Cari parent field
                const pkField = db.prepare(`
                    SELECT field_name FROM fields 
                    WHERE table_id = ? AND primary_key = 1 
                    LIMIT 1
                `).get(parentTable.table_id);
                const parentFieldName = pkField ? pkField.field_name : 'id';

                // Jana tab_title dari module_name (atau table_name jika module_name tiada)
                const rawName = childTable.module_name || childTableName;
                const formattedTitle = toTitleCase(rawName);

                console.log(`--- [MAIN] Auto-Generated Tab Title: '${formattedTitle}'`);

                db.prepare(`
                    INSERT INTO parent_child_relationships 
                    (parent_table_id, child_table_id, fk_child_field, parent_field, relationship_type, tab_title) 
                    VALUES (?, ?, ?, ?, 'one-to-many', ?)
                `).run(parentTable.table_id, childTable.table_id, fk_child_field, parentFieldName, formattedTitle);
            }
        });

        transaction();
        return { success: true };

    } catch (error) {
        console.error("--- [MAIN] Ralat SQL:", error);
        return { success: false, message: error.message };
    }
});

// HANDLER UNTUK DELETE RELATIONSHIP
ipcMain.handle('relationship:delete', async (event, data) => {
    try {
        const { childTableName, fk_child_field } = data;
        const deleteStmt = db.prepare(`
            DELETE FROM parent_child_relationships 
            WHERE fk_child_field = ? 
            AND child_table_id = (SELECT table_id FROM tables WHERE table_name = ?)
        `);
        deleteStmt.run(fk_child_field, childTableName);
        
        // Opsional: Kosongkan lookup settings pada field tersebut
        // db.prepare("UPDATE fields SET lookup_parent_table = NULL, lookup_caption_1 = NULL WHERE field_name = ? AND table_id = (SELECT table_id FROM tables WHERE table_name = ?)").run(fk_child_field, childTableName);
        
        return { success: true };
    } catch (error) {
        console.error("Gagal memadam hubungan:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('custom-module:save', async (event, data) => {
    // 1. Destructuring - kita tangkap project_id dan settings_override
    const { project_id, module_id, table_id, module_name, menu_icon, filter_rules, included_relations, fields, settings_override } = data;
    
    if (!table_id || !module_name) {
        return { success: false, message: 'Table ID and Module Name are required.' };
    }

    const transaction = db.transaction(() => {
        let viewId = module_id;
        let isNewView = false;

        if (viewId) { // Update existing module
            db.prepare(
                `UPDATE custom_modules SET module_name = ?, menu_icon = ?, filter_rules = ?, included_relations = ?, settings_override = ? WHERE module_id = ?`
            ).run(module_name, menu_icon, filter_rules, included_relations, settings_override, viewId);
        } else { // Insert new module
            isNewView = true;
            const maxOrderResult = db.prepare('SELECT MAX(module_order) as max_order FROM custom_modules WHERE table_id = ?').get(table_id);
            const nextOrder = (maxOrderResult?.max_order ?? -1) + 1;
            
            const info = db.prepare(
                `INSERT INTO custom_modules (project_id, table_id, module_name, menu_icon, filter_rules, included_relations, settings_override, module_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(project_id, table_id, module_name, menu_icon, filter_rules, included_relations, settings_override, nextOrder);
            
            viewId = info.lastInsertRowid;
        }

        db.prepare('DELETE FROM custom_module_fields WHERE module_id = ?').run(viewId);
        
        // Dapatkan statement untuk mencari ID medan berdasarkan nama
        const getFieldIdStmt = db.prepare('SELECT field_id FROM fields WHERE table_id = ? AND field_name = ?');
        
        const insertFieldStmt = db.prepare(
            `INSERT INTO custom_module_fields (module_id, field_id, is_readonly, settings_override, display_order) 
             VALUES (?, ?, ?, ?, ?)`
        );

if (fields && Array.isArray(fields)) {
            fields.forEach((field, index) => {
                let actualFieldId = field.field_id;
                
                // Jika data datang dari UI (Create Modal), ia tiada field_id tapi ada sourceName
                if (!actualFieldId && (field.sourceName || field.field_source_name)) {
                    const fData = getFieldIdStmt.get(table_id, field.sourceName || field.field_source_name);
                    if (fData) actualFieldId = fData.field_id;
                }

                if (actualFieldId) {
                    // Tangkap format dari RAM (Auto-Save) atau format dari UI (Create)
                    const isReadonly = field.isReadonly !== undefined ? (field.isReadonly ? 1 : 0) : (field.is_readonly ? 1 : 0);
                    
                    let finalSettingsOverride = field.settings_override || "{}";
                    // Jika dari UI (ada label), kita bina JSON override
                    if (field.label !== undefined) {
                        const currentOverrides = {};
                        if (field.label.trim() !== '') currentOverrides.caption = field.label;
                        finalSettingsOverride = JSON.stringify(currentOverrides);
                    }

                    const finalOrder = field.display_order !== undefined ? field.display_order : (field.displayOrder !== undefined ? field.displayOrder : index);
                    
                    insertFieldStmt.run(viewId, actualFieldId, isReadonly, finalSettingsOverride, finalOrder);
                }
            });
        }
        
// Cipta item menu jika ia adalah modul baharu
        let newMenuItemObj = null; // Pembolehubah untuk memegang data menu baharu

        if (isNewView) {
            const tableInfo = db.prepare('SELECT table_name, project_id FROM tables WHERE table_id = ?').get(table_id);
            if (tableInfo) {
                const maxMenuOrderResult = db.prepare(
                    'SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL'
                ).get(tableInfo.project_id);
                const nextMenuOrder = (maxMenuOrderResult?.max_order ?? -1) + 1;
                
                // Cipta item menu jika ia adalah modul baharu
                const menuLabel = module_name; 
                const menuUrl = `${tableInfo.table_name} Custom Module`;

                // KITA GUNAKAN module_id AGAR SAMA DENGAN FRONTEND
                const menuInfo = db.prepare(
                    `INSERT INTO menu_items (project_id, module_id, item_label, item_detail, item_order) VALUES (?, ?, ?, ?, ?)`
                ).run(tableInfo.project_id, viewId, menuLabel, menuUrl, nextMenuOrder);
                
                // Dapatkan rekod menu yang baru sahaja dicipta
                newMenuItemObj = db.prepare('SELECT * FROM menu_items WHERE item_id = ?').get(menuInfo.lastInsertRowid);
            }
        }
        
// 1. KITA PULANGKAN KEDUA-DUANYA DARI DALAM TRANSAKSI
        return { viewId, newMenuItemObj };
    });

    try {
        // 2. TANGKAP KEDUA-DUANYA DI LUAR TRANSAKSI
        const { viewId, newMenuItemObj } = transaction();
        
        const savedView = db.prepare('SELECT * FROM custom_modules WHERE module_id = ?').get(viewId);
        return { success: true, view: savedView, newMenuItem: newMenuItemObj };
    } catch (error) {
        console.error("Failed to save custom module:", error);
        return { success: false, message: error.message };
    }
});

// ---------------------------------------------------------
    // 1. BAIKI: Simpan Override Medan (Field) - Fix "no such column: id"
    // ---------------------------------------------------------
    ipcMain.handle('custom-module:save-field-override', async (event, data) => {
        try {
            const { module_id, field_id, settings_override } = data;
            
            // Semak kewujudan menggunakan composite key (module_id + field_id)
            // Kita tidak guna 'SELECT id' untuk elak ralat jika lajur id tiada
            const check = db.prepare("SELECT count(*) as count FROM custom_module_fields WHERE module_id = ? AND field_id = ?").get(module_id, field_id);

            if (check.count > 0) {
                // UPDATE: Guna module_id dan field_id sebagai syarat
                db.prepare("UPDATE custom_module_fields SET settings_override = ? WHERE module_id = ? AND field_id = ?").run(settings_override, module_id, field_id);
            } else {
                // INSERT
                db.prepare("INSERT INTO custom_module_fields (module_id, field_id, settings_override) VALUES (?, ?, ?)").run(module_id, field_id, settings_override);
            }

            return { success: true };
        } catch (err) {
            console.error('Error saving field override:', err);
            return { success: false, message: err.message };
        }
    });

    // ---------------------------------------------------------
    // 2. TAMBAH: Simpan Override Jadual (Table) - Untuk Bug 1 & 2
    // ---------------------------------------------------------
    ipcMain.handle('custom-module:save-table-override', async (event, data) => {
        try {
            const { module_id, settings_override } = data;
            
            // Kita simpan override table ke dalam lajur 'settings_override' di table 'custom_modules'
            // Pastikan lajur ini wujud. Jika belum, kita cuba update sahaja.
            
            const stmt = db.prepare("UPDATE custom_modules SET settings_override = ? WHERE module_id = ?");
            const info = stmt.run(settings_override, module_id);

            if (info.changes === 0) {
                return { success: false, message: "Module ID not found." };
            }

            return { success: true };
        } catch (err) {
            // Jika ralat "no such column: settings_override" berlaku
            if (err.message.includes('no such column: settings_override')) {
                // Auto-fix: Tambah lajur tersebut (SQLite)
                try {
                    db.prepare("ALTER TABLE custom_modules ADD COLUMN settings_override TEXT").run();
                    // Cuba simpan semula
                    db.prepare("UPDATE custom_modules SET settings_override = ? WHERE module_id = ?").run(settings_override, module_id);
                    return { success: true, message: "Column created and saved." };
                } catch (alterErr) {
                    return { success: false, message: "Failed to add settings_override column: " + alterErr.message };
                }
            }
            console.error('Error saving table override:', err);
            return { success: false, message: err.message };
        }
    });
    
ipcMain.handle('custom-module:delete', async (event, viewId) => {
    if (!viewId) {
        return { success: false, message: 'Custom Module ID is required.' };
    }
    try {
        const transaction = db.transaction(() => {
            // Padam item menu yang berkaitan dahulu
            db.prepare('DELETE FROM menu_items WHERE module_id = ?').run(viewId);
            // Kemudian padam custom view (akan memadam custom_module_fields melalui CASCADE)
            db.prepare('DELETE FROM custom_modules WHERE module_id = ?').run(viewId);
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

//ipcMain.handle('generate-app', async () => {
//    const win = BrowserWindow.getFocusedWindow();
//    try {
//        // 1. Dapatkan Projek Aktif
//        const activeProject = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
//        if (!activeProject) throw new Error("Tiada projek aktif dijumpai.");
//
//        const projectId = activeProject.project_id;
//        
//        // Dapatkan Schema Penuh
//        const fullSchema = await getFullProjectSchema(projectId);
//        if (!fullSchema) throw new Error("Gagal mendapatkan schema projek penuh.");
//
//        // Tentukan Stack Pilihan (Berdasarkan HTML <select> anda)
//        // Default ke 'core_php' ikut schema, tapi kita handle fallback ke laravel jika perlu
//        const selectedStack = activeProject.stack_base || 'core_php';
//        
//        console.log(`Memulakan janaan untuk Project ID: ${projectId} | Stack: ${selectedStack}`);
//        win?.webContents.send('show-overlay', { message: `Menjana aplikasi (${selectedStack})...` });
//
//        // 2. Tentukan Folder Sementara (Staging Area)
//        const tempBasePath = getGeneratedFolderPath(); 
//        // Nama folder staging unik untuk elak konflik
//        const stagingFolderName = `${activeProject.app_title.replace(/[^a-zA-Z0-9_-]/g, '_')}_staging`;
//        const stagingPath = path.join(tempBasePath, stagingFolderName);
//
//        // Bersihkan folder staging (Reset)
//        if (fs.existsSync(stagingPath)) {
//            fs.rmSync(stagingPath, { recursive: true, force: true });
//        }
//        fs.mkdirSync(stagingPath, { recursive: true });
//
//        // 3. SUIS LOGIK GENERATOR (Dispatcher)
//        let generateResult;
//
//        switch (selectedStack) {
//            case 'laravel_filament':
//                // Panggil Orchestrator Laravel Filament
//                generateResult = await generateLaravelFilamentStack(fullSchema, stagingPath);
//                break;
//
//            case 'laravel_backpack':
//                generateResult = { success: false, message: "Generator Laravel Backpack belum tersedia." };
//                break;
//            
//            case 'core_php':
//                generateResult = { success: false, message: "Generator Core PHP sedang dalam pembangunan." };
//                break;
//
//            case 'ci4':
//            case 'ci3':
//                generateResult = { success: false, message: "Generator CodeIgniter akan datang." };
//                break;
//            
//            case 'django':
//            case 'flask':
//                generateResult = { success: false, message: "Generator Python belum tersedia." };
//                break;
//
//            // ... Tambah case lain berdasarkan HTML anda (aspnet_core, ror, java_spring, mean, dll) ...
//
//            default:
//                // Fallback keselamatan
//                console.warn(`Stack '${selectedStack}' tidak dikenali. Mencuba Laravel Filament sebagai default.`);
//                generateResult = await generateLaravelFilamentStack(fullSchema, stagingPath);
//                break;
//        }
//
//        // Jika janaan GAGAL di peringkat staging, berhenti di sini.
//        if (!generateResult.success) {
//            throw new Error(generateResult.message);
//        }
//
//        // 4. LOGIK PEMINDAHAN KE DOC_ROOT (Deployment)
//        let finalPath = stagingPath; 
//        
//        // Baca setting doc_root
//        const docRootSetting = db.prepare("SELECT setting_value FROM fizisys_settings WHERE setting_name = 'doc_root'").get();
//
//        if (docRootSetting && docRootSetting.setting_value && docRootSetting.setting_value.trim() !== '') {
//            const docRoot = docRootSetting.setting_value;
//            // Sanitasi nama folder projek
//            const appFolderName = activeProject.app_title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
//            const destinationPath = path.join(docRoot, appFolderName);
//
//            console.log(`Memindahkan fail ke Doc Root: ${destinationPath}`);
//            win?.webContents.send('show-overlay', { message: 'Memindahkan fail ke folder pelayan...' });
//
//            try {
//                if (!fs.existsSync(destinationPath)) {
//                    fs.mkdirSync(destinationPath, { recursive: true });
//                }
//                
//                // Salin dari Staging ke Doc Root (Overwrite)
//                fs.cpSync(stagingPath, destinationPath, { recursive: true, force: true });
//                
//                // Set finalPath ke lokasi sebenar untuk dibuka oleh frontend
//                finalPath = destinationPath;
//
//            } catch (moveError) {
//                console.error("Gagal memindahkan fail:", moveError);
//                // Jangan throw error di sini, supaya user masih boleh akses fail di folder temp
//                dialog.showErrorBox("Amaran Pemindahan", `Aplikasi berjaya dijana tetapi gagal disalin ke Doc Root.\nSila semak permission folder.\nLokasi fail: ${stagingPath}`);
//            }
//        }
//
//        return { 
//            success: true, 
//            message: 'Aplikasi berjaya dijana!',
//            folderPath: finalPath // Ini penting untuk butang "Open Folder" di frontend
//        };
//
//    } catch (error) {
//        console.error('Ralat Proses Janaan:', error);
//        return { success: false, message: error.message };
//    } finally {
//        win?.webContents.send('hide-overlay');
//    }
//});

ipcMain.handle('generate-app', async (event) => { // Perhatikan 'event' ditambah di sini
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
        // 1. Dapatkan Data Projek & Schema
        const activeProject = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
        if (!activeProject) throw new Error("Tiada projek aktif dijumpai.");

        const fullSchema = await getFullProjectSchema(activeProject.project_id);
        if (!fullSchema) throw new Error("Gagal mendapatkan schema projek penuh.");

        const selectedStack = activeProject.stack_base || 'core_php';

        win?.webContents.send('show-overlay', { message: `Menjana fail aplikasi (${selectedStack})...` });

        // 2. FASA 1: JANA SCRIPT KE FOLDER STAGING (AppData)
        const tempBasePath = getGeneratedFolderPath(); 
        const stagingFolderName = `${activeProject.app_title.replace(/[^a-zA-Z0-9_-]/g, '_')}_staging`;
        const stagingPath = path.join(tempBasePath, stagingFolderName);

        // Bersihkan folder staging
        if (fs.existsSync(stagingPath)) {
            fs.rmSync(stagingPath, { recursive: true, force: true });
        }
        fs.mkdirSync(stagingPath, { recursive: true });

        // Jalankan Generator berdasarkan Stack
        let generateResult;
        switch (selectedStack) {
            case 'laravel_filament':
                generateResult = await generateLaravelFilamentStack(fullSchema, stagingPath);
                break;
            case 'laravel_backpack':
                generateResult = { success: false, message: "Generator Laravel Backpack belum tersedia." };
                break;
            
            case 'core_php':
                generateResult = { success: false, message: "Generator Core PHP sedang dalam pembangunan." };
                break;

            case 'ci4':
            case 'ci3':
                generateResult = { success: false, message: "Generator CodeIgniter akan datang." };
                break;
            
            case 'django':
            case 'flask':
                generateResult = { success: false, message: "Generator Python belum tersedia." };
                break;            default:
                console.warn(`Stack '${selectedStack}' belum disokong sepenuhnya. Menggunakan Laravel Filament.`);
                generateResult = await generateLaravelFilamentStack(fullSchema, stagingPath);
                break;
        }

        if (!generateResult.success) {
            throw new Error(`Ralat Janaan: ${generateResult.message}`);
        }

        // 3. FASA 2: TENTUKAN LOKASI PROJEK SEBENAR (DOC_ROOT)
        // Dapatkan tetapan global
        const settings = db.prepare("SELECT setting_name, setting_value FROM fizisys_settings").all();
        const config = settings.reduce((acc, curr) => ({ ...acc, [curr.setting_name]: curr.setting_value }), {});

        const docRoot = config.doc_root;
        
        // Jika doc_root tidak ditetapkan, kita hanya mampu bagi folder staging sahaja
        if (!docRoot || docRoot.trim() === '') {
            return { 
                success: true, 
                message: 'Aplikasi berjaya dijana di folder sementara (Doc Root tidak ditetapkan).',
                folderPath: stagingPath 
            };
        }

        // Tentukan path destinasi
        const appFolderName = activeProject.app_title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        const destinationPath = path.join(docRoot, appFolderName);
        
        let finalActionMessage = "";

        // 4. FASA 3: SEMAK KEWUJUDAN PROJEK & LAKSANAKAN FUNGSI
        if (fs.existsSync(destinationPath)) {
            // ========================================================
            // KES A: FOLDER WUJUD -> JALANKAN UPDATE
            // ========================================================
            console.log(`Projek dikesan di ${destinationPath}. Menjalankan fungsi UPDATE...`);
            win?.webContents.send('show-overlay', { message: 'Mengemaskini aplikasi sedia ada...' });

            const updateConfig = {
                projectPath: destinationPath,
                generatedPath: stagingPath
            };

            // Panggil fungsi dari deploymentHandler.js
            // Kita hantar 'event' supaya ia boleh hantar log ke UI
            const updateResult = await updateApp(event, updateConfig);
            
            if (!updateResult.success) throw new Error(updateResult.message);
            finalActionMessage = "Aplikasi berjaya dikemaskini!";

        } else {
            // ========================================================
            // KES B: FOLDER TIADA -> JALANKAN DEPLOY
            // ========================================================
            console.log(`Projek belum wujud di ${destinationPath}. Menjalankan fungsi DEPLOY...`);
            win?.webContents.send('show-overlay', { message: 'Memulakan pemasangan baru (Deploy)...' });

            // Sediakan konfigurasi Deploy
            const dbName = `db_${appFolderName}`;
            const dbUser = `user_${appFolderName.substring(0, 10)}`; // Hadkan panjang user
            const dbPass = 'password123'; // IDEALNYA: Generate random password atau ambil dari setting

            const deployConfig = {
                gitRepoUrl: config.git_repo_url || 'https://github.com/mohdhafizi83/FiziSysMaker-Laravel-Filament-Boilerplate.git', // Default jika tiada setting
                projectPath: destinationPath,
                generatedPath: stagingPath,
                dbConfig: {
                    host: 'localhost',
                    user: dbUser,
                    password: dbPass,
                    dbName: dbName,
                    rootPassword: config.db_root_password || '' // PENTING: Perlu ada untuk create DB
                }
            };

            const deployResult = await deployApp(event, deployConfig);

            if (!deployResult.success) throw new Error(deployResult.message);
            finalActionMessage = "Aplikasi baru berjaya dipasang!";
        }

        return { 
            success: true, 
            message: finalActionMessage,
            folderPath: destinationPath 
        };

    } catch (error) {
        console.error('Ralat Generate App:', error);
        return { success: false, message: error.message };
    } finally {
        win?.webContents.send('hide-overlay');
    }
});

// Handler untuk membuka folder (biasanya dipanggil selepas generate berjaya)
ipcMain.on('open-folder', (event, folderPath) => {
    if (folderPath && fs.existsSync(folderPath)) {
        shell.openPath(folderPath);
    } else {
        console.error(`Gagal membuka folder: ${folderPath} tidak wujud.`);
    }
});

ipcMain.handle('run-composer', async (event, projectPath) => {
    try {
        return await runComposerInstall(projectPath);
    } catch (error) {
        return false;
    }
});


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

ipcMain.handle('app:deploy', deployApp);
ipcMain.handle('app:update', updateApp);

// =================================================================
// FUNGSI BUILT-IN PREVIEW SERVER
// =================================================================

ipcMain.handle('preview:start', async (event, projectPath) => {
    return new Promise((resolve, reject) => {
        try {
            // 1. Tentukan laluan PHP (Sama seperti runComposer)
            const baseBinPath = app.isPackaged 
                ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin')
                : path.join(__dirname, '../../bin');
            const phpPath = path.join(baseBinPath, 'php-8.4.12', 'php.exe');

            // 2. Bunuh pelayan sedia ada jika sedang berjalan
            if (previewServerProcess) {
                previewServerProcess.kill();
                previewServerProcess = null;
                console.log("Pelayan preview terdahulu telah dihentikan.");
            }

            // 3. Pastikan fail database.sqlite wujud (Elak prompt Laravel)
            const dbPath = path.join(projectPath, 'database', 'database.sqlite');
            if (!fs.existsSync(dbPath)) {
                fs.writeFileSync(dbPath, ''); // Cipta fail kosong
            }

            console.log(`Menyediakan pangkalan data di: ${projectPath}`);

            // 4. Jalankan Migrate & Seed (Bina jadual dan masukkan data test)
            const migrateProcess = spawn(phpPath, ['artisan', 'migrate:fresh', '--seed', '--force'], {
                cwd: projectPath,
                stdio: 'pipe' // Abaikan output untuk percepatkan
            });

            migrateProcess.on('close', (code) => {
                if (code !== 0) {
                    return resolve({ success: false, message: "Ralat semasa menjalankan migrasi pangkalan data." });
                }

                console.log("Migrasi berjaya! Menghidupkan pelayan Laravel...");

                // 5. Hidupkan PHP Built-in Server
                const port = 8080;
                previewServerProcess = spawn(phpPath, ['artisan', 'serve', `--port=${port}`], {
                    cwd: projectPath,
                    stdio: 'pipe'
                });

                previewServerProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    console.log(`[Server]: ${output}`);
                    
                    // Jika server berjaya dihidupkan, Laravel akan paparkan "Server running on..."
                    if (output.includes('running') || output.includes('127.0.0.1')) {
                        resolve({ success: true, url: `http://127.0.0.1:${port}/admin` });
                    }
                });

                previewServerProcess.stderr.on('data', (data) => {
                    console.error(`[Server Error]: ${data.toString()}`);
                });

                previewServerProcess.on('error', (err) => {
                    resolve({ success: false, message: `Gagal menghidupkan pelayan: ${err.message}` });
                });
            });

        } catch (error) {
            resolve({ success: false, message: error.message });
        }
    });
});

// Fungsi untuk memberhentikan pelayan (Boleh dipanggil jika pengguna tutup FiziSysMaker)
ipcMain.handle('preview:stop', () => {
    if (previewServerProcess) {
        previewServerProcess.kill();
        previewServerProcess = null;
        console.log("Pelayan preview telah dihentikan oleh pengguna.");
        return true;
    }
    return false;
});

// =================================================================
// SISTEM PENGESAN PERUBAHAN (DIFF CHECKER) UNTUK HOT RELOAD
// =================================================================

/**
 * Membandingkan Skema Lama dan Baharu untuk menentukan Senario Pralihat
 * Pulangan:
 * 1 = Tiada Perubahan (Hanya buka modal semula)
 * 2 = Perubahan UI/Tetapan (Jana kod UI + Clear Cache)
 * 3 = Perubahan Pangkalan Data (Jana semua + Migrate DB)
 */
function analyzeSchemaDiff(oldSchema, newSchema) {
    if (!oldSchema) {
        console.log("[Diff Checker] Tiada memori lama. Paksa Senario 3 (First Run).");
        return 3; 
    }

    // 1. Ujian Senario 1 (Tiada Perubahan Langsung)
    // Oleh kerana SQLite memulangkan data dengan susunan (ORDER BY) yang konsisten,
    // kita boleh menggunakan JSON.stringify untuk perbandingan pantas 100%.
    const oldStr = JSON.stringify(oldSchema);
    const newStr = JSON.stringify(newSchema);
    
    if (oldStr === newStr) {
        console.log("[Diff Checker] Skema 100% sama. Masuk Senario 1.");
        return 1;
    }

    // 2. Ujian Senario 3 (Perubahan Pangkalan Data)
    const isDbChanged = checkDatabaseChanges(oldSchema, newSchema);
    if (isDbChanged) {
        console.log("[Diff Checker] Perubahan struktur pangkalan data dikesan. Masuk Senario 3.");
        return 3;
    }

    // 3. Jika ia bukan Senario 1 (Ada beza) dan bukan Senario 3 (Bukan beza DB),
    // maka ia pasti Senario 2 (Hanya UI/Tetapan yang berubah).
    console.log("[Diff Checker] Hanya perubahan UI/Tetapan dikesan. Masuk Senario 2.");
    return 2;
}

/**
 * Fungsi bantuan untuk memeriksa hanya ciri fizikal Pangkalan Data
 */
function checkDatabaseChanges(oldS, newS) {
    // A. Semak bilangan atau nama jadual
    const oldTables = Object.keys(oldS.database.table);
    const newTables = Object.keys(newS.database.table);
    if (oldTables.length !== newTables.length) return true;

    for (const tName of newTables) {
        if (!oldS.database.table[tName]) return true; // Jadual baharu ditambah

        const oldFields = oldS.database.table[tName].fields;
        const newFields = newS.database.table[tName].fields;

        // B. Semak bilangan atau nama medan (fields)
        const oldFieldNames = Object.keys(oldFields);
        const newFieldNames = Object.keys(newFields);
        if (oldFieldNames.length !== newFieldNames.length) return true;

        for (const fName of newFieldNames) {
            if (!oldFields[fName]) return true; // Medan baharu ditambah

            const oF = oldFields[fName];
            const nF = newFields[fName];

            // C. Semak ciri FIZIKAL medan (Jika berubah, wajib migrate DB)
            if (oF.data_type !== nF.data_type) return true;
            if (oF.length !== nF.length) return true;
            if (oF.primary_key !== nF.primary_key) return true;
            if (oF.unique !== nF.unique) return true;
            if (oF.not_null !== nF.not_null) return true;
            if (oF.unsigned !== nF.unsigned) return true;
            if (oF.auto_increment !== nF.auto_increment) return true;
            if (oF.default_value !== nF.default_value) return true;
        }
    }

    // D. Semak perubahan pada Relationships (One-to-Many, dll)
    // Perubahan relationship melibatkan Foreign Key di DB, wajib migrate
    if (JSON.stringify(oldS.database.relationships) !== JSON.stringify(newS.database.relationships)) {
        return true;
    }

    return false; // Tiada perubahan pada tapak fizikal DB
}

// =================================================================
// FUNGSI BUILT-IN PREVIEW SERVER (SMART REBUILD / HOT RELOAD)
// =================================================================
ipcMain.handle('preview:instant-run', async (event) => { 
    const win = BrowserWindow.fromWebContents(event.sender); 
    return new Promise(async (resolve, reject) => {
        try {
            const templatePreviewPath = app.isPackaged ? path.join(process.resourcesPath, 'preview_env') : path.join(__dirname, '../resources/preview_env');
            const userDataPath = app.getPath('userData'); 
            const workingPreviewPath = path.join(userDataPath, 'preview_env');

            // 1. SALINAN KALI PERTAMA (Fizikal)
            if (!fs.existsSync(workingPreviewPath)) {
                if (!fs.existsSync(templatePreviewPath)) return resolve({ success: false, message: `Template tidak dijumpai: ${templatePreviewPath}` });

                const { response } = await dialog.showMessageBox(win, {
                    type: 'info', buttons: ['OK', 'Batal'], title: 'Persediaan Persekitaran Pralihat',
                    message: 'Pemasangan Kali Pertama',
                    detail: 'Ini adalah kali pertama anda menggunakan fungsi Show Preview.\nProses ini melibatkan penyalinan fail asas sistem dan mungkin memakan masa 1 hingga 3 minit.\n\nAdakah anda mahu meneruskan?'
                });

                if (response !== 0) return resolve({ success: false, message: 'Dibatalkan oleh pengguna.' });

                win?.webContents.send('show-overlay', { message: 'Mengira fail sistem. Sila tunggu...', progress: 0 });
                await copyDirWithProgress(templatePreviewPath, workingPreviewPath, (copied, total, percentage) => {
                    win?.webContents.send('show-overlay', { message: `Menyediakan persekitaran (Menyalin fail ${copied}/${total})...`, progress: Math.round(percentage * 0.90) });
                });
            } else {
                win?.webContents.send('show-overlay', { message: 'Menyemak perubahan skema...', progress: 90 });
            }

            const previewPath = workingPreviewPath;
            const baseBinPath = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin') : path.join(__dirname, '../bin'); 
            const phpPath = path.join(baseBinPath, 'php-8.4.12', 'php.exe');
            const port = 8080;

            // ========================================================
            // 2. DAPATKAN DATA SKEMA TERKINI & LOAD MEMORI CAKERA TEPAT (HARD DISK)
            // ========================================================
            const activeProject = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
            if (!activeProject) return resolve({ success: false, message: "Tiada projek aktif dijumpai." });

            const fullSchema = await getFullProjectSchema(activeProject.project_id);
            if (!fullSchema) return resolve({ success: false, message: "Gagal mendapatkan schema projek." });

            // MULA PEMBAIKAN: Baca dari Hard Disk jika RAM kosong (App baru dibuka)
            const schemaCachePath = path.join(userDataPath, 'last_schema_cache.json');
            if (!lastGeneratedSchema && fs.existsSync(schemaCachePath)) {
                try {
                    lastGeneratedSchema = JSON.parse(fs.readFileSync(schemaCachePath, 'utf8'));
                    console.log("[Preview] Memori skema dari sesi lepas berjaya dimuatkan dari cakera.");
                } catch (e) {
                    console.warn("[Preview] Gagal membaca cache skema, menganggap ia sesi baharu.");
                }
            }

            // ========================================================
            // 3. ANALISIS HOT RELOAD (DIFF CHECKER)
            // ========================================================
            let scenario = analyzeSchemaDiff(lastGeneratedSchema, fullSchema);
            
            // Paksa Senario 3 jika fail database.sqlite ghaib (dipadam manual oleh pengguna)
            const dbSqlitePath = path.join(previewPath, 'database', 'database.sqlite');
            if (!fs.existsSync(dbSqlitePath)) {
                scenario = 3;
                console.log("[Preview] Pangkalan data SQLite hilang. Memaksa Senario 3.");
            }

            // Fungsi bantuan untuk menghidupkan pelayan secara seragam
            const startServerAndResolve = () => {
                win?.webContents.send('show-overlay', { message: 'Menghidupkan Pelayan Tempatan...', progress: 99 });
                previewServerProcess = spawn(phpPath, ['artisan', 'serve', `--port=${port}`], { cwd: previewPath });
                previewServerProcess.on('error', (err) => resolve({ success: false, message: `Gagal menghidupkan pelayan: ${err.message}` }));
                previewServerProcess.stdout.on('data', (data) => {
                    if (data.toString().includes('running') || data.toString().includes('127.0.0.1')) {
                        win?.webContents.send('show-overlay', { message: 'Pralihat Sedia Dilancarkan!', progress: 100 });
                        setTimeout(() => resolve({ success: true, url: `http://127.0.0.1:${port}/admin` }), 500);
                    }
                });
            };

            // --- SENARIO 1: TIADA PERUBAHAN ---
            if (scenario === 1) {
                console.log("[Preview] Senario 1: Tiada perubahan skema.");
                if (previewServerProcess) {
                    // Pelayan dah hidup, terus buka
                    win?.webContents.send('show-overlay', { message: 'Pralihat Sedia Dilancarkan!', progress: 100 });
                    return setTimeout(() => resolve({ success: true, url: `http://127.0.0.1:${port}/admin` }), 300);
                } else {
                    // App baru buka, pelayan mati. Hanya hidupkan pelayan.
                    return startServerAndResolve();
                }
            }

            // Bunuh pelayan lama JIKA senario 3 (untuk lepaskan fail kunci DB)
            if (scenario === 3 && previewServerProcess) {
                if (process.platform === 'win32') spawn('taskkill', ['/pid', previewServerProcess.pid, '/f', '/t']);
                else previewServerProcess.kill();
                previewServerProcess = null;
            }

            // ========================================================
            // 4. PEMBERSIHAN FOLDER PINTAR
            // ========================================================
            const modelsPath = path.join(previewPath, 'app', 'Models');
            const migrationsPath = path.join(previewPath, 'database', 'migrations');
            const resourcesPath = path.join(previewPath, 'app', 'Filament', 'Resources');
            const policiesPath = path.join(previewPath, 'app', 'Policies');
            
            if (fs.existsSync(modelsPath)) fs.readdirSync(modelsPath).forEach(file => { if (file !== 'User.php') fs.rmSync(path.join(modelsPath, file), { recursive: true, force: true }); });
            
            if (fs.existsSync(resourcesPath)) {
                const protectedResources = ['Users', 'Roles', 'UserResource', 'RoleResource'];
                fs.readdirSync(resourcesPath).forEach(file => {
                    if (!protectedResources.some(keyword => file.includes(keyword))) fs.rmSync(path.join(resourcesPath, file), { recursive: true, force: true });
                });
            }

            if (scenario === 3) {
                if (fs.existsSync(migrationsPath)) {
                    const protectedMigrations = ['create_users_table', 'create_cache_table', 'create_jobs_table', 'create_permission_tables', 'create_audits_table', 'create_notifications_table', 'create_imports_table', 'create_exports_table', 'create_failed_import_rows_table'];
                    fs.readdirSync(migrationsPath).forEach(file => {
                        if (!protectedMigrations.some(keyword => file.includes(keyword))) fs.rmSync(path.join(migrationsPath, file), { recursive: true, force: true });
                    });
                }
                if (fs.existsSync(policiesPath)) {
                    fs.readdirSync(policiesPath).forEach(file => {
                        const filePath = path.join(policiesPath, file);
                        if (fs.statSync(filePath).isFile()) { try { fs.rmSync(filePath, { force: true }); } catch (err) {} }
                    });
                }
            }

            // ============================================================
            // 5. TRIGGER PENJANA (GENERATORS)
            // ============================================================
            console.log(`[Preview] Menjana fail untuk Senario ${scenario}...`);
            
            if (scenario === 3) {
                await generateLaravelUserMigration(fullSchema, previewPath);
                await generateLaravelMigrations(fullSchema, previewPath);
                await generateLaravelFactories(fullSchema, previewPath);
                await generateLaravelDatabaseSeeder(fullSchema, previewPath);
                await generateFilamentUserModel(fullSchema, previewPath);
            }
            
            await generateFilamentModels(fullSchema, previewPath); 
            await generateFilamentTablesTable(fullSchema, previewPath);
            await generateFilamentSchemasForm(fullSchema, previewPath);
            await generateFilamentListPages(fullSchema, previewPath);
            await generateFilamentCreatePages(fullSchema, previewPath);
            await generateFilamentEditPages(fullSchema, previewPath);
            await generateFilamentRelationManagers(fullSchema, previewPath);
            await generateFilamentResources(fullSchema, previewPath);
            await generateFilamentTablesCustomModules(fullSchema, previewPath);
            await generateFilamentSchemasCustomModules(fullSchema, previewPath);
            await generateFilamentListCustomModules(fullSchema, previewPath);
            await generateFilamentCreateCustomModules(fullSchema, previewPath);
            await generateFilamentEditCustomModules(fullSchema, previewPath);
            await generateFilamentResourcesCustomModules(fullSchema, previewPath);
            await generateFilamentExports(fullSchema, previewPath);
            await generateFilamentImporters(fullSchema, previewPath);
            await generateAdminPanelProvider(fullSchema, previewPath);

            // Simpan memori skema selepas kod berjaya dijana ke RAM dan Cakera Keras
            lastGeneratedSchema = JSON.parse(JSON.stringify(fullSchema));
            fs.writeFileSync(schemaCachePath, JSON.stringify(lastGeneratedSchema), 'utf8');

            // ============================================================
            // 6. --- SENARIO 2: HOT RELOAD (CLEAR CACHE) ---
            // ============================================================
            if (scenario === 2) {
                console.log(`[Preview] Senario 2: Mengemaskini Cache...`);
                win?.webContents.send('show-overlay', { message: 'Mengemaskini Antaramuka (Menjana Semula Cache)...', progress: 96 });
                
                const cacheProcess = spawn(phpPath, ['artisan', 'optimize:clear'], { cwd: previewPath });
                cacheProcess.on('close', () => {
                    if (previewServerProcess) {
                        win?.webContents.send('show-overlay', { message: 'Pralihat Dikemaskini!', progress: 100 });
                        setTimeout(() => resolve({ success: true, url: `http://127.0.0.1:${port}/admin` }), 500);
                    } else {
                        // Jika pelayan mati waktu S2 (sebab app baru buka), kita hidupkan lepas cache dicuci
                        startServerAndResolve();
                    }
                });
                return;
            }

            // ============================================================
            // 7. --- SENARIO 3: SETUP DB & START SERVER ---
            // ============================================================
            if (!fs.existsSync(dbSqlitePath)) fs.writeFileSync(dbSqlitePath, ''); 

            console.log(`[Preview] Menjalankan Migrasi & Seeder...`);
            let currentProgress = 90;
            win?.webContents.send('show-overlay', { message: 'Memulakan Migrasi Pangkalan Data...', progress: currentProgress });

            const migrateProcess = spawn(phpPath, ['artisan', 'migrate:fresh', '--seed', '--force'], { cwd: previewPath });
            let migrateLog = '';
            
            migrateProcess.stdout.on('data', (data) => { 
                migrateLog += data.toString(); 
                if (currentProgress < 95) {
                    currentProgress += 1; 
                    win?.webContents.send('show-overlay', { message: 'Membina jadual dan data ujian (Seeder)...', progress: currentProgress });
                }
            });
            migrateProcess.stderr.on('data', (data) => { migrateLog += data.toString(); });
            migrateProcess.on('error', (err) => { resolve({ success: false, message: `Gagal mencari fail PHP: ${err.message}` }); });

            migrateProcess.on('close', (code) => {
                if (code !== 0) return resolve({ success: false, message: `Gagal menjalankan migrasi pangkalan data.\n\nLog Terminal:\n...${migrateLog.slice(-1000)}` });

                win?.webContents.send('show-overlay', { message: 'Menjana Polisi Keselamatan & Hak Akses...', progress: 96 });

                const shieldProcess = spawn(phpPath, ['artisan', 'shield:generate', '--all', '--panel=admin', '--no-interaction'], { cwd: previewPath });
                let shieldLog = '';
                shieldProcess.stdout.on('data', (data) => { shieldLog += data.toString(); });
                shieldProcess.stderr.on('data', (data) => { shieldLog += data.toString(); });

                shieldProcess.on('close', (shieldCode) => {
                    if (shieldCode !== 0 || shieldLog.toLowerCase().includes('error') || shieldLog.toLowerCase().includes('exception')) {
                        return resolve({ success: false, message: `Gagal menjana Polisi Shield!\n\nSebab Ralat:\n${shieldLog.trim()}` });
                    }
                    startServerAndResolve();
                }); 
            }); 

        } catch (error) {
            console.error('Ralat Instant Preview:', error);
            resolve({ success: false, message: error.message });
        }
    });
});

// Pastikan pelayan dibunuh apabila aplikasi ditutup
app.on('will-quit', () => {
    if (previewServerProcess) {
        previewServerProcess.kill();
    }
});

// Tambahkan ini untuk mematikan pelayan pralihat (Preview Server) ke akar umbi!
ipcMain.on('stop-preview-server', () => {
    if (typeof previewServerProcess !== 'undefined' && previewServerProcess !== null) {
        
        // Semak adakah OS pengguna adalah Windows
        if (process.platform === 'win32') {
            const { spawn } = require('child_process');
            // /pid = Process ID, /f = Force kill, /t = Kill whole tree (Induk & Anak)
            spawn('taskkill', ['/pid', previewServerProcess.pid, '/f', '/t']);
        } else {
            // Untuk pengguna Mac/Linux, .kill() biasa sudah mencukupi untuk membunuh tree
            previewServerProcess.kill(); 
        }

        previewServerProcess = null;
        console.log('[Preview] Pelayan PHP dan keturunannya telah dibasmi sepenuhnya.');
    }
});

// =================================================================
// ▼▼▼ VALIDATION HANDLERS (BETTER-SQLITE3 COMPATIBLE) ▼▼▼
// =================================================================

// Load validations untuk column tertentu
ipcMain.handle('get-field-validations', (event, columnId) => {
    try {
        // Guna .all() untuk better-sqlite3
        return db.prepare("SELECT * FROM field_validations WHERE column_id = ?").all(columnId);
    } catch (error) {
        console.error("Gagal mendapatkan validasi:", error);
        return [];
    }
});

// Save validations (Padam lama, insert baru untuk update pukal)
ipcMain.handle('save-field-validations', (event, { columnId, validations }) => {
    try {
        // Guna Transaction untuk better-sqlite3 (lebih laju & selamat)
        const saveTransaction = db.transaction(() => {
            // 1. Padam rekod lama
            db.prepare("DELETE FROM field_validations WHERE column_id = ?").run(columnId);

            // 2. Masukkan rekod baru jika ada
            if (validations && validations.length > 0) {
                const insertStmt = db.prepare(
                    "INSERT INTO field_validations (column_id, rule_type, rule_value_1, rule_value_2, is_active) VALUES (?, ?, ?, ?, 1)"
                );
                
                for (const v of validations) {
                    insertStmt.run(columnId, v.rule_type, v.value1, v.value2);
                }
            }
        });

        saveTransaction();
        return { success: true };

    } catch (error) {
        console.error("Gagal menyimpan validasi:", error);
        return { success: false, message: error.message };
    }
});

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
    
    // Custom Modules
    let customViews = db.prepare(`SELECT * FROM custom_modules WHERE table_id IN (${placeholder}) ORDER BY module_order`).all(...tableIds);
    const viewIds = customViews.map(v => v.module_id);
    let customViewFields = [];
    if (viewIds.length > 0) {
        const viewPlaceholder = viewIds.map(() => "?").join(",");
        customViewFields = db.prepare(`SELECT * FROM custom_module_fields WHERE module_id IN (${viewPlaceholder}) ORDER BY display_order`).all(...viewIds);
    }

    // ▼▼▼ TAMBAHAN BARU: Field Validations (Dari Test) ▼▼▼
    const validations = db.prepare(`
        SELECT fv.*, f.table_id, f.field_name 
        FROM field_validations fv
        JOIN fields f ON fv.column_id = f.field_id
        WHERE f.table_id IN (${placeholder}) AND fv.is_active = 1
    `).all(...tableIds);
    // ▲▲▲ TAMAT TAMBAHAN ▲▲▲

    const structuredTables = {};
    tables.forEach((table) => {
      const viewsForTable = customViews.filter(v => v.table_id === table.table_id);
      viewsForTable.forEach(view => {
          view.fields = customViewFields.filter(f => f.module_id === view.module_id);
      });

      structuredTables[table.table_name] = { 
          ...table, 
          fields: {}, 
          custom_modules: viewsForTable,
          constraints: constraints.filter(c => c.table_id === table.table_id)
      };
    });

    fields.forEach((field) => {
      const parentTable = tables.find((t) => t.table_id === field.table_id);
      if (parentTable) {
        // ▼▼▼ TAMBAHAN BARU: Attach Validation ke Field ▼▼▼
        field.validations = validations.filter(v => v.column_id === field.field_id);
        // ▲▲▲ TAMAT TAMBAHAN ▲▲▲
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
    
    // (Logik Menu di sini KEKAL SAMA kerana ia sudah versi terkini)
    const allItems = db.prepare(`
        SELECT mi.*, t.table_name 
        FROM menu_items mi 
        LEFT JOIN tables t ON mi.table_id = t.table_id 
        WHERE mi.project_id = ? 
        ORDER BY mi.item_order
    `).all(projectId);
    
    const groups = db.prepare("SELECT * FROM menu_groups WHERE project_id = ? ORDER BY group_order").all(projectId);
    const unifiedMenu = [];

    const groupMap = new Map();
    groups.forEach(group => {
        const groupItems = allItems
            .filter(item => item.menu_group_id === group.menu_group_id)
            .map(item => {
                let itemType = 'custom_item';
                if (item.table_id) itemType = 'table_item';
                else if (item.module_id) itemType = 'custom_module_item';
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
    
    allItems.forEach(item => {
        if (item.menu_group_id === null) {
            let itemType = 'custom_item';
            if (item.table_id) itemType = 'table_item';
            else if (item.module_id) itemType = 'custom_module_item';
            
            unifiedMenu.push({ 
                type: itemType,
                order: item.item_order,
                ...item 
            });
        }
    });

    unifiedMenu.sort((a, b) => a.order - b.order);

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

/**
 * Mengendalikan semakan pra-import: memberi amaran kepada pengguna dan memadam jadual lama jika perlu.
 * @param {BrowserWindow} win - Tetingkap utama aplikasi untuk melampirkan dialog.
 * @param {number} projectId - ID projek semasa.
 * @param {string} sqlContent - Kandungan penuh skrip SQL yang akan diimport.
 * @returns {Promise<boolean>} - Mengembalikan 'true' jika import boleh diteruskan, 'false' jika dibatalkan.
 */

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
        const insertMenuItemStmt = db.prepare('INSERT INTO menu_items (project_id, table_id, item_label, item_detail, item_order, menu_group_id) VALUES (?, ?, ?, ?, ?, NULL)');
        // Dalam fungsi importSchema
        const insertFieldStmt = db.prepare(`INSERT INTO fields (table_id, field_name, data_type, length, precision, required, auto_increment, unsigned, zero_fill, primary_key, "unique", not_null, is_indexed, read_only, default_value, caption, field_order) VALUES (@table_id, @field_name, @data_type, @length, @precision, @required, @auto_increment, @unsigned, @zero_fill, @primary_key, @unique, @not_null, @is_indexed, @read_only, @default_value, @caption, @field_order)`);

        
        const foreignKeysToProcess = [];

        for (const statement of ast) {
            if (statement.type !== "create" || statement.keyword !== "table") continue;
            
            const tableName = statement.table[0].table.trim();
            const tableViewTitle = toTitleCase(tableName);
            
            const tableInfo = db.prepare("INSERT INTO tables (project_id, table_name, module_name, table_view_title, table_order) VALUES (?, ?, ?, ?, ?)").run(projectId, tableName, tableViewTitle, tableViewTitle, tableOrder++);
            const tableId = tableInfo.lastInsertRowid;
            tablesCreated++;
            tableMap[tableName] = tableId;

            const maxMenuOrderResult = getMaxMenuOrderStmt.get(projectId);
            const nextMenuOrder = (maxMenuOrderResult?.max_order ?? -1) + 1;
            insertMenuItemStmt.run(projectId, tableId, tableViewTitle, `${tableName} Module`, nextMenuOrder);

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
                    
// Tetapkan hide_in_tv = 1, hide_in_dv = 1, dan read_only = 1 secara lalai untuk medan sistem
                    const protectedFields = ['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by'];
                    
                    if (fieldData.primary_key === 1 || protectedFields.includes(fieldName)) {
                        fieldData.hide_in_tv = 1;
                        fieldData.hide_in_dv = 1;
                        fieldData.read_only = 1;
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
        
        // Tambah hide_in_tv dan hide_in_dv pada statement SQL
        const insertStandardFieldStmt = db.prepare(`INSERT INTO fields (table_id, field_name, caption, data_type, length, primary_key, auto_increment, unsigned, read_only, is_indexed, field_order, hide_in_tv, hide_in_dv) VALUES (@table_id, @field_name, @caption, @data_type, @length, @primary_key, @auto_increment, @unsigned, @read_only, @is_indexed, @field_order, @hide_in_tv, @hide_in_dv)`);
        
        for (const tableName in tableMap) {
            const tableId = tableMap[tableName];
            if (!checkPKStmt.get(tableId)) {
                if (!checkFieldExistsStmt.get(tableId, 'id')) {
                    insertStandardFieldStmt.run({ table_id: tableId, field_name: 'id', caption: 'ID', data_type: 'INT', length: 11, primary_key: 1, auto_increment: 1, unsigned: 1, read_only: 1, is_indexed: 0, field_order: -1, hide_in_tv: 1, hide_in_dv: 1 });
                    if (!standardizationLog[tableName]) standardizationLog[tableName] = [];
                    standardizationLog[tableName].push('id');
                }
            }
            
            const systemFields = [
                { name: 'created_at', type: 'DATETIME', length: null, unsigned: 0 },
                { name: 'updated_at', type: 'DATETIME', length: null, unsigned: 0 },
                { name: 'deleted_at', type: 'DATETIME', length: null, unsigned: 0 },
                { name: 'created_by', type: 'BIGINT', length: 20, unsigned: 1 },
                { name: 'updated_by', type: 'BIGINT', length: 20, unsigned: 1 },
                { name: 'deleted_by', type: 'BIGINT', length: 20, unsigned: 1 }
            ];

            const allFields = db.prepare('SELECT field_name FROM fields WHERE table_id = ?').all(tableId);
            const existingFieldNames = new Set(allFields.map(f => f.field_name));
            let lastOrder = allFields.length;
            
            for (const sysFld of systemFields) {
                if (!existingFieldNames.has(sysFld.name)) {
                    insertStandardFieldStmt.run({ 
                        table_id: tableId, 
                        field_name: sysFld.name, 
                        caption: toTitleCase(sysFld.name), 
                        data_type: sysFld.type, 
                        length: sysFld.length, 
                        primary_key: 0, 
                        auto_increment: 0, 
                        unsigned: sysFld.unsigned, 
                        read_only: 1, 
                        is_indexed: 0, 
                        field_order: lastOrder++,
                        hide_in_tv: 1,
                        hide_in_dv: 1
                    });
                    if (!standardizationLog[tableName]) standardizationLog[tableName] = [];
                    standardizationLog[tableName].push(sysFld.name);
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

/**
 * ORCHESTRATOR: Menguruskan urutan penjanaan penuh untuk stack Laravel Filament.
 */
async function generateLaravelFilamentStack(fullSchema, outputDir) {
    try {
        console.log("Memulakan Orchestrator Laravel Filament...");
        
        // Pastikan folder output wujud
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // ============================================================
        // FASA 1: DATABASE LAYER
        // ============================================================
        console.log("--- Menjana Database Layer ---");

        const migrationUserResult = await generateLaravelUserMigration(fullSchema, outputDir);
        if (!migrationUserResult.success) throw new Error(`Migrations Users: ${migrationUserResult.message}`);
        
        const migrationResult = await generateLaravelMigrations(fullSchema, outputDir);
        if (!migrationResult.success) throw new Error(`Migrations: ${migrationResult.message}`);

        const modelResult = await generateFilamentModels(fullSchema, outputDir);
        if (!modelResult.success) throw new Error(`Models: ${modelResult.message}`);

        const userModelResult = await generateFilamentUserModel(fullSchema, outputDir);
        if (!userModelResult.success) throw new Error(`User Model: ${userModelResult.message}`);

        const factoryResult = await generateLaravelFactories(fullSchema, outputDir);
        if (!factoryResult.success) throw new Error(`Factories: ${factoryResult.message}`);

        const seederResult = await generateLaravelDatabaseSeeder(fullSchema, outputDir);
        if (!seederResult.success) throw new Error(`Seeders: ${seederResult.message}`);


        // ============================================================
        // FASA 2: STANDARD Module (CRUD ASAL)
        // ============================================================
        console.log("--- Menjana Standard Resources ---");

        // 1. Components (Table & Form) MESTI dijana dahulu kerana Resource memanggilnya
        const tableResult = await generateFilamentTablesTable(fullSchema, outputDir);
        if (!tableResult.success) throw new Error(`Tables (Standard): ${tableResult.message}`);

        const formResult = await generateFilamentSchemasForm(fullSchema, outputDir);
        if (!formResult.success) throw new Error(`Forms (Standard): ${formResult.message}`);

        // 2. Pages
        await generateFilamentListPages(fullSchema, outputDir);
        await generateFilamentCreatePages(fullSchema, outputDir);
        await generateFilamentEditPages(fullSchema, outputDir);

        // 3. Relation Managers
        await generateFilamentRelationManagers(fullSchema, outputDir);

        // 4. Resource Induk (Menghubungkan semua di atas)
        const resourceResult = await generateFilamentResources(fullSchema, outputDir);
        if (!resourceResult.success) throw new Error(`Resources (Standard): ${resourceResult.message}`);


        // ============================================================
        // FASA 3: CUSTOM VIEWS (FASA BARU)
        // ============================================================
        console.log("--- Menjana Custom Modules ---");

        // 1. Components Custom Module
        const cvTableResult = await generateFilamentTablesCustomModules(fullSchema, outputDir);
        if (!cvTableResult.success) console.warn(`Custom Tables Warning: ${cvTableResult.message}`);

        const cvFormResult = await generateFilamentSchemasCustomModules(fullSchema, outputDir);
        if (!cvFormResult.success) console.warn(`Custom Forms Warning: ${cvFormResult.message}`);

        // 2. Pages Custom Module
        await generateFilamentListCustomModules(fullSchema, outputDir);
        await generateFilamentCreateCustomModules(fullSchema, outputDir);
        await generateFilamentEditCustomModules(fullSchema, outputDir);

        // 3. Resource Custom Module (Tiada Relation Manager khas, guna standard)
        const cvResourceResult = await generateFilamentResourcesCustomModules(fullSchema, outputDir);
        if (!cvResourceResult.success) console.warn(`Custom Resources Warning: ${cvResourceResult.message}`);


        // ============================================================
        // FASA 4: CIRI TAMBAHAN & KONFIGURASI
        // ============================================================
        console.log("--- Menjana Ciri Tambahan ---");

        const exportResult = await generateFilamentExports(fullSchema, outputDir);
        if (!exportResult.success) throw new Error(`Exports: ${exportResult.message}`);
        
        const importResult = await generateFilamentImporters(fullSchema, outputDir);
        if (!importResult.success) throw new Error(`Imports: ${importResult.message}`);
        
        const adminPanelResult = await generateAdminPanelProvider(fullSchema, outputDir);
        if (!adminPanelResult.success) throw new Error(`AdminPanelProvider: ${adminPanelResult.message}`);
        
        const guideResult = await generateDeploymentGuidePage(fullSchema, outputDir);
        if (!guideResult.success) console.warn(`Guide Warning: ${guideResult.message}`); // Warning sahaja, bukan error

        console.log("Selesai menjana stack Laravel Filament.");
        return { success: true, message: "Aplikasi berjaya dijana sepenuhnya." };

    } catch (error) {
        console.error("Ralat Kritikal Orchestrator:", error);
        return { success: false, message: error.message };
    }
}

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
      webviewTag: true
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

    const phpPath = path.join(baseBinPath, 'php-8.4.12', 'php.exe');
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
