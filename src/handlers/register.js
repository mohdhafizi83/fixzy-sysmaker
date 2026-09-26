/**
 * IPC handler registry (Phase 5.3).
 *
 * Extracted from Electron main.js so BOTH the Electron app and the headless
 * web server register the same handlers. Electron-specific touchpoints come
 * through `ctx`:
 *   ctx.ipcMain    - real ipcMain (Electron) or shim registry (web) with
 *                    .handle(name, fn) / .on(name, fn)
 *   ctx.db         - better-sqlite3 handle
 *   ctx.getPath    - (name) => directory (userData equivalent)
 *   ctx.getWindow  - (event) => BrowserWindow or null (web mode)
 *   ctx.dialog     - Electron dialog or web stub
 *   ctx.shell      - { openExternal }
 *   ctx.isPackaged - boolean
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { Parser } = require('node-sql-parser');
const pluralize = require('pluralize');

// IMPORT HELPER FUNCTIONS FROM UTILS
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
} = require('../utils');

// =================================================================
// IMPORT GENERATORS (NEW MODULAR STRUCTURE)
// =================================================================

// 1. Resources Induk
const { 
    generateFilamentResources, 
    generateFilamentResourcesCustomModules 
} = require('../generators/laravelResourceGenerator');

// 2. List Pages
const { 
    generateFilamentListPages, 
    generateFilamentListCustomModules 
} = require('../generators/laravelListGenerator');

// 3. Create Pages
const { 
    generateFilamentCreatePages, 
    generateFilamentCreateCustomModules 
} = require('../generators/laravelCreateGenerator');

// 4. Edit Pages
const { 
    generateFilamentEditPages, 
    generateFilamentEditCustomModules 
} = require('../generators/laravelEditGenerator');

// 5. Relation Managers
const { 
    generateFilamentRelationManagers 
} = require('../generators/laravelRelationManagersGenerator');

// 6. Tables
const { 
    generateFilamentTablesTable, 
    generateFilamentTablesCustomModules 
} = require('../generators/laravelTablesGenerator');

// 7. Forms (Schemas)
const { 
    generateFilamentSchemasForm, 
    generateFilamentSchemasCustomModules 
} = require('../generators/laravelSchemasGenerator');

// 8. Database Layer (Remains the Same)
const { 
    generateFilamentModels,
    generateFilamentUserModel,
    generateLaravelUserMigration,
    generateLaravelMigrations, 
    generateLaravelFactories, 
    generateLaravelDatabaseSeeder,
    generateNativeAuditFiles
} = require('../generators/laravelDatabaseGenerator');

const { generateFilamentExports } = require('../generators/laravelExportsGenerator');

const { generateFilamentImporters } = require('../generators/laravelImportersGenerator');

const { generateAdminPanelProvider } = require('../generators/laravelAdminPanelGenerator');
const { generateWorkflowHooks } = require('../generators/laravelWorkflowGenerator');
const { generateAuthIntegrations } = require('../generators/laravelAuthIntegrationsGenerator');
const { renderTemplate } = require('../render/engine');

const { deployApp, updateApp } = require('../deploymentHandler');

const { generateDeploymentGuidePage } = require('../generators/laravelDocsGenerator');

// Full-stack orchestrator (extracted to module so headless tests/CLI can run it without Electron)
const { generateLaravelFilamentStack } = require('../generators/laravelFilamentStack');

module.exports = function registerIpcHandlers(ctx) {
    const ipcMain = ctx.ipcMain;
    const db = ctx.db;

    // Module-level state (was top-level in main.js)
    let previewServerProcess = null;
    let previewServerPort = null;
    let lastGeneratedSchema = null;
    let lastPreviewScenario = 0;
    const parser = new Parser();

    // Find a free TCP port for the preview server (8080 may be taken by other
    // local services; hardcoding it caused instant-preview to hang forever).
    const net = require('net');
    function findFreePort(startPort = 8080, tries = 20) {
        return new Promise((resolve, reject) => {
            const tryPort = (p, left) => {
                const srv = net.createServer();
                srv.once('error', () => {
                    if (left <= 0) return reject(new Error(`No free port found in ${startPort}..${startPort + tries - 1}`));
                    tryPort(p + 1, left - 1);
                });
                srv.once('listening', () => srv.close(() => resolve(p)));
                srv.listen(startPort === p ? p : p, '127.0.0.1');
            };
            tryPort(startPort, tries);
        });
    }

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
                await fs.promises.copyFile(srcPath, destPath); // Actual physical copy
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
//  // 2. ADD THIS LINE before creating the window
//  Menu.setApplicationMenu(null);
//  
//  createWindow();
//});
// =================================================================
// ▼▼▼ ALL IPC HANDLERS GROUPED HERE FOR CONSISTENCY ▼▼▼
// =================================================================

ipcMain.handle('database:batch-update', async (event, queue) => {
    if (!queue) return { success: false, message: 'Queue is empty.' };

    const transaction = db.transaction(() => {
        // Update Project
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

        // Update Table (IMPROVED WITH MENU UPDATE LOGIC)
if (queue.tables && Object.keys(queue.tables).length > 0) {
    for (const id in queue.tables) {
        const fieldsToUpdate = queue.tables[id];
        const newTableName = fieldsToUpdate.table_name;
        let oldTableName = null;

        // Check if the table name is being updated
        if (newTableName) {
            const tableInfo = db.prepare('SELECT table_name FROM tables WHERE table_id = ?').get(id);
            if (tableInfo) {
                oldTableName = tableInfo.table_name;
            }
        }

        // Build and execute the update for the 'tables' table
        const setClause = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
        const values = Object.values(fieldsToUpdate);
        if (setClause) {
            db.prepare(`UPDATE tables SET ${setClause} WHERE table_id = ?`).run(...values, id);
        }

        // ▼▼▼ THIS AREA HAS BEEN IMPROVED ▼▼▼
        // If the table name was changed, also update 'menu_items'
        if (oldTableName && newTableName && oldTableName !== newTableName) {
            const newUrl = `${newTableName} Module`;

            // IMPROVED UPDATE: Update label and URL based on table_id,
            // regardless of their old values. This ensures consistency.
            db.prepare(
                'UPDATE menu_items SET item_label = ?, item_detail = ? WHERE table_id = ?'
            ).run(newTableName, newUrl, id);
        }
        // ▲▲▲ END OF IMPROVEMENT AREA ▲▲▲
    }
}
        // Update Field
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
        
        // Update Parent/Child Relationship
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
        
        // Create/Update Relationship (Upsert)
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

        // Delete Relationship
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
        console.error("Error during batch update:", error);
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

            // ... (existing code to get nextOrder unchanged) ...
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
        console.error("Failed to save menu item:", error);
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
        console.error("Failed to update individual menu order:", error);
        return { success: false, message: error.message };
    }
});


ipcMain.handle('menu:delete-group', async (event, { groupId }) => {
    if (!groupId) {
        return { success: false, message: "Group ID is required." };
    }
    try {
        const transaction = db.transaction(() => {
            // Delete all items belonging to this group
            db.prepare('DELETE FROM menu_items WHERE menu_group_id = ?').run(groupId);
            // Delete the group itself
            db.prepare('DELETE FROM menu_groups WHERE menu_group_id = ?').run(groupId);
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error("Failed to delete menu group:", error);
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
        console.error("Failed to create menu group:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('sql:parse-calculation-query', (event, sql) => {
    // ▼▼▼ ADD THESE TWO LINES FOR DIAGNOSIS ▼▼▼
    console.log("--- SQL received by backend parser ---");
    //console.log(sql);
    // ▲▲▲ END OF ADDITION ▲▲▲

    if (!sql) {
        return { success: false, error: 'Empty query string.' };
    }
    try {
        const ast = parser.astify(sql, { database: 'MySQL' });
        // Send the syntax tree (AST) back to the frontend
        return { success: true, data: ast };
    } catch (error) {
        // Send error message if translation fails
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
        console.error("Failed to update table order:", error);
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
        console.error("Failed to update field order:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('field:delete', async (event, { fieldId, tableName, fieldName }) => {
    // 1. SECURITY FILTER (PROTECTED FIELDS)
    const protectedFields = ['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by'];
    
    if (protectedFields.includes(fieldName)) {
        console.warn(`[Security] Attempt to delete system field detected: ${fieldName}`);
        return { success: false, message: "Access Denied: This core system field cannot be deleted because it is essential for core Laravel Filament operations." };
    }

    try {
        const transaction = db.transaction(() => {
            // Get the child table ID
            const childTable = db.prepare('SELECT table_id FROM tables WHERE table_name = ?').get(tableName);
            if (!childTable) return;

            // 1. Delete relationships where this field is a foreign key
            db.prepare('DELETE FROM parent_child_relationships WHERE child_table_id = ? AND fk_child_field = ?')
              .run(childTable.table_id, fieldName);

            // 2. Clear 'lookup_caption' references that use this field
            db.prepare("UPDATE fields SET lookup_caption_1 = '' WHERE lookup_caption_1 = ?")
              .run(fieldName);
            db.prepare("UPDATE fields SET lookup_caption_2 = '' WHERE lookup_caption_2 = ?")
              .run(fieldName);

            // 3. Finally, delete the field itself
            db.prepare('DELETE FROM fields WHERE field_id = ?').run(fieldId);
        });

        transaction();
        return { success: true };
    } catch (error){
        console.error("Failed to delete field:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('field:create', async (event, tableId) => {
    try {
        const settings = db.prepare("SELECT setting_name, setting_value FROM fixzy_settings WHERE setting_name IN ('field_default_type', 'field_default_length')").all();
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

            // ▼▼▼ MODIFY 'INSERT' HERE ▼▼▼
            const info = db.prepare(
                `INSERT INTO fields (
                    table_id, field_name, caption, data_type, length, field_order, 
                    enable_global_filter, enable_individual_filter, enable_range_filter, allow_sorting
                 ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, 1)`
            ).run(tableId, newName, newName, defaultType, defaultLength, targetOrder, isRangeFilterDefault);
            // ▲▲▲ END OF MODIFICATION ▲▲▲

            return info.lastInsertRowid;
        });

        const newFieldId = transaction();
        return db.prepare('SELECT * FROM fields WHERE field_id = ?').get(newFieldId);

    } catch (error) {
        console.error("Failed to create new field:", error);
        return null;
    }
});

ipcMain.handle('table:delete', async (event, { projectId, tableNamesToDelete }) => {
    try {
        if (!projectId || !tableNamesToDelete || tableNamesToDelete.length === 0) {
            throw new Error("Project ID or table name not supplied.");
        }

        const transaction = db.transaction(() => {
            const getTableId = db.prepare('SELECT table_id FROM tables WHERE project_id = ? AND table_name = ?');
            
            // ▼▼▼ START CHANGES ▼▼▼
            const deleteMenuItem = db.prepare('DELETE FROM menu_items WHERE table_id = ?');
            // ▲▲▲ END CHANGES ▲▲▲
            
            const deleteTable = db.prepare('DELETE FROM tables WHERE table_id = ?');

            for (const tableName of tableNamesToDelete) {
                const table = getTableId.get(projectId, tableName);
                if (table) {
                    // ▼▼▼ START NEW LOGIC ▼▼▼
                    // 1. Delete the menu item first
                    deleteMenuItem.run(table.table_id);
                    // 2. Then, drop the table (will trigger ON DELETE CASCADE for fields, etc.)
                    deleteTable.run(table.table_id);
                    // ▲▲▲ END NEW LOGIC ▲▲▲
                }
            }
        });

        transaction();
        return { success: true };

    } catch (error) {
        console.error("Failed to delete table:", error);
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

            // New tables inherit the global layout defaults (Preferences >
            // Layout defaults). No-op when the user never changed them.
            const gDefaults = getGlobalLayoutDefaults();
            db.prepare('UPDATE tables SET tv_template = ?, card_columns = ?, form_layout_config = ? WHERE table_id = ?')
                .run(gDefaults.tv_template, gDefaults.card_columns, gDefaults.form_layout_config, tableId);

// Add `hide_in_tv` and `hide_in_dv` to the column list
            const insertFieldStmt = db.prepare(`
                INSERT INTO fields (table_id, field_name, caption, data_type, length, primary_key, auto_increment, unsigned, read_only, field_order, hide_in_tv, hide_in_dv)
                VALUES (@table_id, @field_name, @caption, @data_type, @length, @primary_key, @auto_increment, @unsigned, @read_only, @field_order, @hide_in_tv, @hide_in_dv)
            `);

            // 1a. Create the 'id' field (Hide from TV and DV)
            insertFieldStmt.run({
                table_id: tableId, field_name: 'id', caption: 'ID', data_type: 'INT',
                length: 11, primary_key: 1, auto_increment: 1, unsigned: 1, read_only: 1, field_order: 0, hide_in_tv: 1, hide_in_dv: 1
            });

            // 1b. Create Timestamps & Userstamps fields (Blameable)
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
                    unsigned: sysFld.type === 'BIGINT' ? 1 : 0, // Unsigned for User ID
                    read_only: 1, // Userstamps are read_only
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
        console.error("Failed to create new table:", error);
        return null;
    }
});

ipcMain.handle("project:get-full-schema", async (event, projectId) => {
    // This call will now use the more powerful function above
    return getFullProjectSchema(projectId);
});


ipcMain.handle('menu:save-unified-structure', async (event, { projectId, menuStructure }) => {
    if (!projectId || !Array.isArray(menuStructure)) {
        return { success: false, message: "Invalid data." };
    }
    
    const transaction = db.transaction(() => {
        const updateGroupStmt = db.prepare('UPDATE menu_groups SET group_name = ?, group_order = ? WHERE menu_group_id = ?');
        const updateItemStmt = db.prepare('UPDATE menu_items SET item_order = ?, menu_group_id = ? WHERE item_id = ?');

        // Set all items as top-level first to handle items moved out of groups.
        db.prepare('UPDATE menu_items SET menu_group_id = NULL WHERE project_id = ?').run(projectId);
        
        // ▼▼▼ START FIX LOGIC ▼▼▼
        // Use a single index (topIndex) for BOTH tables.
        menuStructure.forEach((topLevelItem, topIndex) => {
            if (topLevelItem.type === 'group') {
                // Use 'topIndex' for group_order
                updateGroupStmt.run(topLevelItem.name, topIndex, topLevelItem.id);

                // Update items inside the group (internal order)
                topLevelItem.items.forEach((childItem, childIndex) => {
                    updateItemStmt.run(childIndex, topLevelItem.id, childItem.id);
                });
            } else { // type 'table_item' or 'custom_item'
                // Use 'topIndex' for item_order
                updateItemStmt.run(topIndex, null, topLevelItem.id);
            }
        });
        // ▲▲▲ END FIX LOGIC ▲▲▲
    });

    try {
        transaction();
        return { success: true };
    } catch (error) {
        console.error("Failed to save integrated menu structure:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle("project:get-active", async () => {
  return db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
});

ipcMain.handle("project:create", async (event, projectName) => {
  try {
    const createProjectTransaction = db.transaction(() => {
        // 1. Set all other projects as inactive
        db.prepare("UPDATE projects SET is_active = 0").run();

        // 2. Create the new project record
        const projectInfo = db.prepare("INSERT INTO projects (app_title, is_active) VALUES (?, 1)").run(projectName);
        const projectId = projectInfo.lastInsertRowid;

        // ▼▼▼ START NEW LOGIC: Automatically create the 'users' table ▼▼▼

        // 3. Create the record for the 'users' table
        const tableInfo = db.prepare(
            'INSERT INTO tables (project_id, table_name, module_name, table_view_title, table_order) VALUES (?, ?, ?, ?, ?)'
        ).run(projectId, 'users', 'Users', 'Users', 0);
        const tableId = tableInfo.lastInsertRowid;

        // 4. Create the menu item for the 'users' table
        const menuUrl = 'users Module';
        db.prepare(
            'INSERT INTO menu_items (project_id, table_id, item_label, item_detail, item_order) VALUES (?, ?, ?, ?, ?)'
        ).run(projectId, tableId, 'Users', menuUrl, 0);

        // 5. Define and create all fields for the 'users' table
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
        // ▲▲▲ END NEW LOGIC ▲▲▲

        return projectId;
    });

    const newProjectId = createProjectTransaction();
    return db.prepare("SELECT * FROM projects WHERE project_id = ?").get(newProjectId);

  } catch (error) {
    console.error("Failed to create project:", error);
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
    return { success: true, message: "Old schema deleted successfully." };
  } catch (error) {
    console.error("Failed to delete schema:", error);
    return { success: false, message: `Error: ${error.message}` };
  }
});

ipcMain.handle("tables:get-by-project", async (event, projectId) => {
  try {
    return db
      .prepare("SELECT * FROM tables WHERE project_id = ? ORDER BY table_name")
      .all(projectId);
  } catch (error) {
    console.error("Failed to get table list:", error);
    return [];
  }
});

ipcMain.handle("tables:check-exists", async (event, projectId) => {
  return db
    .prepare("SELECT COUNT(*) as count FROM tables WHERE project_id = ?")
    .get(projectId);
});

ipcMain.handle("sql:import-file", async (event, { projectId, dialect }) => {
  const win = ctx.getWindow(event);
  const { canceled, filePaths } = await ctx.dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "SQL Files", extensions: ["sql"] }],
  });

  if (canceled || filePaths.length === 0) {
    return { success: false, message: "Import cancelled by user." };
  }

  const sqlContent = fs.readFileSync(filePaths[0], "utf8");
  
  // New pre-flight logic
  const canProceed = await handleImportPreflight(win, projectId, sqlContent);
  if (!canProceed) {
      return { success: false, message: "Import cancelled by user." };
  }

  win?.webContents.send('show-overlay');
  return importSchema(sqlContent, projectId, dialect);
});

ipcMain.handle("sql:import-text", async (event, { sql, projectId, dialect }) => {
  const win = ctx.getWindow(event);

  // New pre-flight logic
  const canProceed = await handleImportPreflight(win, projectId, sql);
  if (!canProceed) {
      return { success: false, message: "Import cancelled by user." };
  }
  
  win?.webContents.send('show-overlay');
  return importSchema(sql, projectId, dialect);
});

ipcMain.handle("open-url", (event, url) => {
  // Only allow http/https — block file://, custom schemes, and protocol hijacks
  let parsed;
  try { parsed = new URL(String(url)); } catch { return { success: false }; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    console.warn('Blocked open-url with protocol:', parsed.protocol);
    return { success: false };
  }
  ctx.shell.openExternal(url);
  return { success: true };
});

ipcMain.handle("settings:get-all", async () => {
  try {
    const settingsArray = db.prepare("SELECT * FROM fixzy_settings").all();
    // Convert array of objects into a single key-value object for easy access
    // Cth: { check_updates: '1', autosave_interval: '15', ... }
    const settingsObject = settingsArray.reduce((acc, setting) => {
      acc[setting.setting_name] = setting.setting_value;
      return acc;
    }, {});
    return settingsObject;
  } catch (error) {
    console.error("Failed to get Fixzy SysMaker settings:", error);
    return null;
  }
});

ipcMain.handle('projects:get-all', async () => {
    try {
        return db.prepare('SELECT project_id, app_title, is_active FROM projects ORDER BY app_title').all();
    } catch (error) {
        console.error("Failed to get project list:", error);
        return [];
    }
});

ipcMain.handle('project:set-active', async (event, projectId) => {
    try {
        const setActiveTransaction = db.transaction(() => {
            db.prepare('UPDATE projects SET is_active = 0').run(); // Set all as inactive
            db.prepare('UPDATE projects SET is_active = 1 WHERE project_id = ?').run(projectId); // Activate the selected one
        });
        setActiveTransaction();
        return db.prepare('SELECT * FROM projects WHERE project_id = ?').get(projectId);
    } catch (error) {
        console.error(`Failed to set active project (ID: ${projectId}):`, error);
        return null;
    }
});

ipcMain.handle('project:update', async (event, data) => {
    try {
        const { project_id, ...fieldsToUpdate } = data;
        if (!project_id) {
            throw new Error("Project ID not supplied.");
        }

        const allowedColumns = [
            'app_title', 'date_order', 'separator', 'char_encoding', 'language_select',
            'timezone_select', 'use_24hr_format', 'enforce_mysql_encoding', 'theme_select',
            'use_3d_effects', 'rtl', 'compact', 'menu_orientation', 'menu_at_homepage',
            'tables_per_row', 'extra_wide', 'panel_height', 'hide_login', 'allow_sql_tool',
            'allow_server_status', 'admins_group_access', 'allow_table_view_sql',
            'copy_children_async', 'allow_pwa_install', 'url', 'project_hook_workflow', 'stack_base', 'stack_database',
			'stack_theme', 'module_auth_email_2fa', 'auth_2fa_mode', 'module_auth_email_captcha', 'auth_captcha_mode', 'module_auth_ldap',
            'module_auth_google_sso', 'module_authorization', 'module_log_audit', 'module_log_activity', 'data_delete_type', 'module_fake_data', 'tenancy_type', 'tenant_table', 'debug_mode',
            'module_realtime', 'realtime_backend', 'module_google_sheets', 'module_scheduler', 'backup_config'
        ];

        const setClause = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => `${key} = ?`)
            .join(', ');

        if (!setClause) {
            return { success: true, message: 'No valid fields to update.' };
        }

        const values = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => fieldsToUpdate[key]);

        const stmt = db.prepare(`UPDATE projects SET ${setClause} WHERE project_id = ?`);
        stmt.run(...values, project_id);

        return { success: true };
    } catch (error) {
        console.error("Failed to update project:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('table:update', async (event, data) => {
    try {
        const { table_id, ...fieldsToUpdate } = data;
        if (!table_id) {
            throw new Error("Table ID not supplied.");
        }

        // ▼▼▼ START CHANGES ▼▼▼
        const transaction = db.transaction(() => {
            let oldTableName = null;

            // If the table name is to be changed, validate and prepare for the menu update
            if (fieldsToUpdate.hasOwnProperty('table_name')) {
                const newTableName = fieldsToUpdate.table_name;
                
                // Get the old table name BEFORE it is updated
                const tableInfo = db.prepare('SELECT table_name, project_id FROM tables WHERE table_id = ?').get(table_id);
                if (!tableInfo) {
                    throw new Error(`Table with ID ${table_id} not found.`);
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

            // Build the SET clause for the 'tables' table
            const allowedColumns = [
                'table_name', 'module_name', 'table_view_title', 'table_view_title_ms', 'table_description', 'show_quick_search', 'allow_pagination', 'pagination_type', 'default_sort_by', 'sort_descending', 'allow_csv_export', 'allow_csv_import', 'allow_print_view', 'allow_mass_delete', 'show_edit_button', 'show_delete_button', 'allow_restore_delete', 'allow_force_delete', 'tv_template', 'card_columns', 'card_columns_tablet', 'hide_field_captions', 'use_first_field_as_title', 'table_view_classes_input', 'detail_view_classes_input', 'detail_view_title', 'record_owner', 'default_focus', 'redirect_after_insert', 'enable_detail_view', 'delete_with_children', 'dv_allow_print_view', 'dv_separate_page', 'dv_hide_save_as_copy', 'dv_sticky_buttons', 'dv_allow_add_from_homepage', 'column_grid_type', 'static_grid_columns', 'table_hook_workflow', 'feature_source', 'google_sync_enabled', 'grid_column_manager', 'grid_sticky_header', 'grid_row_density', 'grid_inline_edit', 'grid_default_per_page', 'grid_per_page_options', 'grid_group_by', 'grid_group_direction', 'grid_summaries', 'grid_row_click', 'grid_empty_heading', 'grid_empty_icon', 'grid_empty_description', 'grid_row_striping', 'grid_border_style', 'grid_content_width', 'grid_sticky_toolbar', 'grid_sticky_footer', 'grid_column_groups', 'grid_multi_view', 'grid_view_default', 'grid_split_view', 'grid_calendar_enabled', 'grid_calendar_config', 'grid_tree_enabled', 'grid_tree_config', 'grid_kanban_enabled', 'grid_kanban_config', 'form_layout_config', 'approval_enabled', 'approval_config', 'scheduler_config', 'attachments_enabled', 'public_form_enabled', 'public_form_config', 'numbering_enabled', 'numbering_config', 'import_enabled', 'import_config', 'api_enabled', 'api_config'
            ];

            // Google Sheets sync is only allowed on user-defined (custom) tables.
            // Core/system tables (users, tenancy pivots, feature-generated
            // tables) are rejected server-side so the UI can't be bypassed.
            if (fieldsToUpdate.hasOwnProperty('google_sync_enabled') && Number(fieldsToUpdate.google_sync_enabled) === 1) {
                const target = db.prepare("SELECT table_name, feature_source FROM tables WHERE table_id = ?").get(table_id);
                const CORE_SYNC_BLOCKED = ['users', 'sessions', 'jobs', 'failed_jobs', 'cache', 'password_reset_tokens', 'permissions', 'roles'];
                if (!target || CORE_SYNC_BLOCKED.includes(target.table_name) || (target.feature_source && target.feature_source.trim() !== '')) {
                    throw new Error("Google Sheets sync can only be enabled on custom tables.");
                }
            }

            // Approval config must be valid JSON with the expected shape.
            if (fieldsToUpdate.hasOwnProperty('approval_config') && fieldsToUpdate.approval_config) {
                let cfg = null;
                try {
                    cfg = JSON.parse(fieldsToUpdate.approval_config);
                } catch (e) {
                    throw new Error("Approval configuration is not valid JSON.");
                }
                if (!cfg || !Array.isArray(cfg.statuses) || cfg.statuses.length < 2) {
                    throw new Error("Approval configuration needs at least 2 statuses.");
                }
                if (typeof cfg.statusField !== 'string' || !/^[a-z][a-z0-9_]*$/i.test(cfg.statusField || '')) {
                    throw new Error("Approval status field must be a valid column name.");
                }
                const keys = cfg.statuses.map(s => s && s.key).filter(k => typeof k === 'string' && /^[a-z][a-z0-9_]*$/.test(k));
                if (keys.length !== cfg.statuses.length || new Set(keys).size !== keys.length) {
                    throw new Error("Approval status keys must be unique lowercase identifiers.");
                }
                if (!keys.includes(cfg.initial)) {
                    throw new Error("Approval initial status must be one of the defined statuses.");
                }
                const transitions = Array.isArray(cfg.transitions) ? cfg.transitions : [];
                for (const t of transitions) {
                    if (!keys.includes(t.from) || !keys.includes(t.to)) {
                        throw new Error("Approval transition references an unknown status.");
                    }
                }
                if (!transitions.some(t => !cfg.statuses.find(s => s.key === t.from && s.final))) {
                    throw new Error("Approval config needs at least one transition out of a non-final status.");
                }
            }

            // Form layout config must be valid JSON with the expected shape.
            // (Invalid content is normalised away at generation time, but we
            // reject obviously broken payloads here so the UI gets feedback.)
            if (fieldsToUpdate.hasOwnProperty('form_layout_config') && fieldsToUpdate.form_layout_config) {
                const { FORM_STYLES } = require('../generators/formLayoutConfig');
                let cfg = null;
                try {
                    cfg = JSON.parse(fieldsToUpdate.form_layout_config);
                } catch (e) {
                    throw new Error("Form layout configuration is not valid JSON.");
                }
                if (!cfg || typeof cfg !== 'object') {
                    throw new Error("Form layout configuration must be an object.");
                }
                if (cfg.style && !FORM_STYLES.includes(cfg.style)) {
                    throw new Error("Unknown form layout style: " + cfg.style);
                }
                if (cfg.groups && !Array.isArray(cfg.groups)) {
                    throw new Error("Form layout groups must be an array.");
                }
                if (Array.isArray(cfg.groups)) {
                    const seen = new Set();
                    for (const g of cfg.groups) {
                        if (!g || typeof g !== 'object' || typeof g.key !== 'string' || !/^[a-z][a-z0-9_]*$/.test(g.key)) {
                            throw new Error("Form group keys must be lowercase identifiers (a-z, 0-9, _).");
                        }
                        if (seen.has(g.key)) {
                            throw new Error("Duplicate form group key: " + g.key);
                        }
                        seen.add(g.key);
                    }
                }
            }

            const setClause = Object.keys(fieldsToUpdate) 
                .filter(key => allowedColumns.includes(key))
                .map(key => `${key} = ?`)
                .join(', ');

            if (setClause) {
                const values = Object.keys(fieldsToUpdate)
                    .filter(key => allowedColumns.includes(key))
                    .map(key => fieldsToUpdate[key]);
                // 1. Update the 'tables' table
                db.prepare(`UPDATE tables SET ${setClause} WHERE table_id = ?`).run(...values, table_id);
            }
console.log(setClause);
            // 2. If the table name changed, also update 'menu_items'
            if (oldTableName && fieldsToUpdate.table_name) {
                const newTableName = fieldsToUpdate.table_name;
                const newUrl = `${newTableName} Module`;
                const oldUrl = `${oldTableName} Module`;

                // Update the label ONLY if it matches the old table name
                db.prepare(
                    'UPDATE menu_items SET item_label = ? WHERE table_id = ? AND item_label = ?'
                ).run(newTableName, table_id, oldTableName);
                
                // Update the URL ONLY if it matches the old 'Module' format
                db.prepare(
                    'UPDATE menu_items SET item_detail = ? WHERE table_id = ? AND item_detail = ?'
                ).run(newUrl, table_id, oldUrl);
            }
        });

        transaction();
        return { success: true };
        // ▲▲▲ END CHANGES ▲▲▲

    } catch (error) {
        console.error("Failed to update table:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('field:update', async (event, data) => {
    try {
		//console.log('Data received from frontend:', data);
        const { field_id, ...fieldsToUpdate } = data;
        if (!field_id) {
            throw new Error("Field ID not supplied.");
        }

if (fieldsToUpdate.hasOwnProperty('field_name')) {
            // 1. Trim whitespace at the start and end of the word (IMPORTANT!)
            const newFieldName = fieldsToUpdate.field_name.trim();
            fieldsToUpdate.field_name = newFieldName; // Store the cleaned value back
            
            let isNameValid = true;
            let errorMessage = "";

            // 2. Check if null or empty
            if (!newFieldName || newFieldName === '') {
                isNameValid = false;
                errorMessage = "Field name cannot be empty.";
            }
            // 3. Check if it contains invalid characters
            else if (!/^[a-zA-Z_]+$/.test(newFieldName)) {
                isNameValid = false;
                errorMessage = "Field name may only contain letters and underscores (_). Spaces are not allowed.";
            }
            // 4. Check if the name already exists in the same table
            else {
                const tableInfo = db.prepare('SELECT table_id FROM fields WHERE field_id = ?').get(field_id);
                if (tableInfo) {
                    const existingField = db.prepare(
                        'SELECT field_id FROM fields WHERE table_id = ? AND field_name = ? AND field_id != ?'
                    ).get(tableInfo.table_id, newFieldName, field_id);
                    
                    if (existingField) {
                        isNameValid = false;
                        errorMessage = `Field name '${newFieldName}' already exists in this table!`;
                    }
                }
            }
            
            // ▼▼▼ MAIN CHANGE: Don't delete silently. Raise an error! ▼▼▼
            if (!isNameValid) {
                // Return immediately so your UI SaveManager receives this error and can display it in the console/warning
                return { success: false, message: errorMessage };
            }
        }
		
        // List of columns allowed to be updated in the 'fields' table
        const allowedColumns = [
		    'field_name', 'caption', 'caption_ms', 'description', 'data_type', 'length', 'precision', 'alignment', 'default_value', 'read_only', 'helper_text', 'placeholder', 'min_length', 'max_length', 'min_value', 'max_value', 'primary_key', 'zero_fill', 'required', 'display_type', 'auto_increment', 'unique', 'not_null', 'is_indexed', 'show_sum', 'show_avg_summary', 'show_count_summary', 'show_range_summary', 'allow_sorting', 'tv_wrap_header', 'tv_wrap_text', 'tv_enable_toggle', 'tv_description_tooltips', 'tv_text_limit', 'tv_text_size', 'tv_font_weight', 'tv_date_time_format', 'tv_alignment', 'tv_text_color', 'tv_icon', 'tv_icon_color', 'tv_currency_code', 'unsigned', 'enable_global_filter', 'enable_individual_filter', 'enable_range_filter', 'binary', 'hide_in_tv', 'editable_in_tv', 'hide_in_dv', 'media_type', 'media_link_behavior', 'media_link_display_as', 'media_link_other_field', 'allow_image_uploads', 'image_storage_provider', 'max_file_size', 'delete_image_server', 'dont_rename_image', 'tv_thumb_shape', 'tv_thumb_width', 'tv_thumb_height', 'tv_enable_zooming', 'tv_show_full_size', 'dv_thumb_shape', 'dv_thumb_width', 'dv_thumb_height', 'dv_enable_zooming', 'dv_show_full_size', 'allow_file_uploads', 'file_storage_provider', 'file_types', 'file_max_size', 'attach_max_files', 'attach_types', 'attach_max_size', 'delete_file_server', 'dont_rename_file', 'file_behavior', 'file_display_as', 'file_other_field', 'display_gmap', 'gmap_type', 'gmap_tv_width', 'gmap_tv_height', 'gmap_dv_height', 'accept_video_url', 'youtube_tv_width', 'youtube_tv_height', 'youtube_dv_width', 'youtube_dv_height', 'lookup_parent_table', 'lookup_caption_1', 'lookup_separator', 'lookup_caption_2', 'lookup_display_as', 'lookup_inherit_permissions', 'lookup_link_behavior', 'lookup_searchable', 'lookup_preload', 'options_list_values', 'options_display', 'options_quick_list', 'boolean_label_true', 'boolean_label_false', 'format_as', 'format_mask', 'off_autocomplete', 'column_span_full', 'repeater_simple_display_as', 'repeater_simple_format_as', 'repeater_simple_list_values', 'repeater_1_display_as', 'repeater_1_format_as', 'repeater_1_list_values', 'repeater_2_display_as', 'repeater_2_format_as', 'repeater_2_list_values', 'repeater_3_display_as', 'repeater_3_format_as', 'repeater_3_list_values', 'repeater_simple_required', 'repeater_1_required', 'repeater_2_required', 'repeater_3_required', 'prefix', 'suffix', 'suffix_icon', 'suffix_icon_color', 'calculated_enable', 'calculated_query', 'lookup_custom_query', 'algorithm_enable', 'algorithm_logic', 'calculation_builder_state', 'hook_functions', 'label_display', 'form_group', 'visible_if', 'required_if_state', 'depends_on'
        ];
 
        const setClause = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => `"${key}" = ?`) // Use double quotes for the 'unique' keyword
            .join(', ');

        if (!setClause) {
            return { success: true, message: 'No valid fields to update.' };
        }

        const values = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => fieldsToUpdate[key]);

        const stmt = db.prepare(`UPDATE fields SET ${setClause} WHERE field_id = ?`);
        stmt.run(...values, field_id);

        return { success: true };
    } catch (error) {
        console.error("Failed to update field:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('settings:save-all', async (event, settingsData) => {
    try {
        const updateStmt = db.prepare('UPDATE fixzy_settings SET setting_value = ? WHERE setting_name = ?');
        
        const saveTransaction = db.transaction(() => {
            for (const [key, value] of Object.entries(settingsData)) {
                updateStmt.run(value, key);
            }
        });

        saveTransaction();
        return { success: true, message: 'Settings saved successfully.' };
    } catch (error) {
        console.error("Failed to save Fixzy SysMaker settings:", error);
        return { success: false, message: error.message };
    }
});

// --- GLOBAL LAYOUT DEFAULTS (2026-09-26) ------------------------------------
// Reads the global table-view / form-layout defaults from fixzy_settings and
// normalises them. New tables inherit these automatically (table:create);
// existing tables only change when the user explicitly applies them via
// 'layout:apply-global' (Apply button in the Preferences modal).
function getGlobalLayoutDefaults() {
    const get = (name) => {
        const row = db.prepare('SELECT setting_value FROM fixzy_settings WHERE setting_name = ?').get(name);
        return row ? row.setting_value : null;
    };
    const { FORM_STYLES } = require('../generators/formLayoutConfig');

    let tvTemplate = String(get('global_tv_template') || 'horizontal');
    if (!['horizontal', 'vertical_1', 'vertical_2', 'left_image', 'right_image', 'card'].includes(tvTemplate)) {
        tvTemplate = 'horizontal';
    }
    let cardColumns = parseInt(get('global_card_columns'), 10);
    if (!Number.isInteger(cardColumns) || cardColumns < 1 || cardColumns > 6) cardColumns = 3;

    // Normalise the form layout JSON through the same IR helper the
    // generators use, so a broken stored payload can never reach tables.
    let formLayoutConfig = '';
    const rawForm = get('global_form_layout_config');
    if (rawForm) {
        let cfg = null;
        try { cfg = JSON.parse(rawForm); } catch (e) { cfg = null; }
        if (cfg && typeof cfg === 'object') {
            if (!FORM_STYLES.includes(String(cfg.style || 'default'))) cfg.style = 'default';
            let cols = parseInt(cfg.columns, 10);
            if (!Number.isInteger(cols) || cols < 0 || cols > 3) cols = 0;
            formLayoutConfig = JSON.stringify({ style: String(cfg.style || 'default'), columns: cols });
        }
    }

    return { tv_template: tvTemplate, card_columns: cardColumns, form_layout_config: formLayoutConfig };
}

// Child relation layout defaults (2026-09-26). '' / 0 means "inherit the
// child table's own layout" — the legacy behaviour. These are the fallback
// for relations whose own tv_template/card_columns/form_style are unset.
function getGlobalChildLayoutDefaults() {
    const get = (name) => {
        const row = db.prepare('SELECT setting_value FROM fixzy_settings WHERE setting_name = ?').get(name);
        return row ? row.setting_value : null;
    };
    const { FORM_STYLES } = require('../generators/formLayoutConfig');

    let tvTemplate = String(get('global_child_tv_template') || '').trim();
    if (tvTemplate && !['horizontal', 'vertical_1', 'vertical_2', 'left_image', 'right_image', 'card'].includes(tvTemplate)) {
        tvTemplate = '';
    }
    let cardColumns = parseInt(get('global_child_card_columns'), 10);
    if (!Number.isInteger(cardColumns) || cardColumns < 0 || cardColumns > 6) cardColumns = 0;
    let formStyle = String(get('global_child_form_style') || '').trim();
    // Conversational is per-table chat copy; never a global child default.
    if (formStyle && !FORM_STYLES.includes(formStyle)) formStyle = '';

    return { tv_template: tvTemplate, card_columns: cardColumns, form_style: formStyle };
}

// Apply the global layout defaults to every eligible table in a project.
// Skips: the core 'users' table and feature-generated tables (feature_source
// set) — those have generator-owned layouts. Custom-module overrides live in
// settings_override and are untouched, so per-module overrides still win.
ipcMain.handle('layout:apply-global', async (event, { projectId, applyTableView, applyFormLayout, applyChildLayout }) => {
    if (!projectId) return { success: false, message: 'Project ID not supplied.' };
    try {
        const defaults = getGlobalLayoutDefaults();
        const tables = db.prepare(
            'SELECT table_id, table_name, feature_source FROM tables WHERE project_id = ?'
        ).all(projectId);

        const CORE_TABLES = ['users', 'sessions', 'jobs', 'failed_jobs', 'cache', 'password_reset_tokens', 'permissions', 'roles'];
        const setClauses = [];
        const params = [];
        if (applyTableView) { setClauses.push('tv_template = ?'); params.push(defaults.tv_template); }
        if (applyFormLayout) { setClauses.push('form_layout_config = ?'); params.push(defaults.form_layout_config); }
        if (setClauses.length === 0 && !applyChildLayout) return { success: false, message: 'Nothing selected to apply.' };

        const applyStmt = setClauses.length
            ? db.prepare(`UPDATE tables SET ${setClauses.join(', ')} WHERE table_id = ?`)
            : null;
        let updated = 0, skipped = 0;
        const tx = db.transaction(() => {
            if (applyStmt) {
                for (const t of tables) {
                    if (CORE_TABLES.includes(t.table_name) || (t.feature_source && String(t.feature_source).trim() !== '')) {
                        skipped++;
                        continue;
                    }
                    applyStmt.run(...params, t.table_id);
                    updated++;
                }
            }
            // Child relation defaults: stamp the global child layout onto every
            // relation whose own override is still unset (per-relation overrides
            // already chosen by the user are never overwritten).
            if (applyChildLayout) {
                const childDefaults = getGlobalChildLayoutDefaults();
                const rels = db.prepare(`
                    SELECT r.relationship_id FROM parent_child_relationships r
                    JOIN tables p ON r.parent_table_id = p.table_id
                    WHERE p.project_id = ?
                `).all(projectId);
                const stampStmt = db.prepare(`
                    UPDATE parent_child_relationships
                    SET tv_template = COALESCE(NULLIF(tv_template, ''), ?),
                        card_columns = CASE WHEN card_columns IS NULL OR card_columns = 0 THEN ? ELSE card_columns END,
                        form_style = COALESCE(NULLIF(form_style, ''), ?)
                    WHERE relationship_id = ?
                `);
                for (const r of rels) {
                    stampStmt.run(childDefaults.tv_template, childDefaults.card_columns, childDefaults.form_style, r.relationship_id);
                    updated++;
                }
            }
        });
        tx();
        return { success: true, updated, skipped };
    } catch (error) {
        console.error('Failed to apply global layout defaults:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('menu:save-structure', async (event, { projectId, menuData }) => {
    if (!projectId) {
        return { success: false, message: 'Project ID not supplied.' };
    }
    try {
        const deleteItemsStmt = db.prepare('DELETE FROM menu_items WHERE menu_group_id IN (SELECT menu_group_id FROM menu_groups WHERE project_id = ?)');
        const deleteGroupsStmt = db.prepare('DELETE FROM menu_groups WHERE project_id = ?');
        const insertGroupStmt = db.prepare('INSERT INTO menu_groups (project_id, group_name, group_order) VALUES (?, ?, ?)');
        const insertItemStmt = db.prepare('INSERT INTO menu_items (menu_group_id, table_id, item_order) VALUES (?, (SELECT table_id FROM tables WHERE table_name = ? AND project_id = ?), ?)');

        const transaction = db.transaction(() => {
            // Delete all old menu data for this project
            deleteItemsStmt.run(projectId);
            deleteGroupsStmt.run(projectId);

            // Re-insert the new data
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
        console.error("Failed to save menu structure:", error);
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
        console.error("Failed to save menu order:", error);
        return { success: false, message: error.message };
    }
});


ipcMain.handle('relationship:update', async (event, data) => {
    try {
		// LOG #1: Show full data received from frontend
        //console.log('--- RELATIONSHIP UPDATE: Data Received ---', data);
		
        const { relationship_id, ...fieldsToUpdate } = data;
        if (!relationship_id) {
            throw new Error("Relationship ID not supplied.");
        }
		
        // LOG #2: Show relationship_id and data to be updated
        //console.log(`--- RELATIONSHIP UPDATE: ID Sasaran: ${relationship_id} ---`, fieldsToUpdate);

        const allowedColumns = [
                    'show_tab', 'show_icon', 'autoclose_modal', 'tab_title', 'copy_records',
                    'show_link_above', 'show_count_in_tv', 'allow_add_from_tv',
                    'tv_template', 'card_columns', 'form_style', // child relation layout overrides (2026-09-26)
                    'on_delete', 'on_update' // <--- ADD THESE TWO FIELDS
                ];

        const setClause = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => `${key} = ?`)
            .join(', ');

        if (!setClause) {
            //console.log('--- RELATIONSHIP UPDATE: No valid fields to update. Operation halted.');
            return { success: true, message: 'No valid fields to update.' };
        }

        // LOG #3: Show the built SQL SET clause
        //console.log('--- RELATIONSHIP UPDATE: Built SET clause ---', setClause);
		
        const values = Object.keys(fieldsToUpdate)
            .filter(key => allowedColumns.includes(key))
            .map(key => fieldsToUpdate[key]);

        // LOG #4: Show the values to be used in the query
        //console.log('--- RELATIONSHIP UPDATE: Values to be inserted ---', values);

        const stmt = db.prepare(`UPDATE parent_child_relationships SET ${setClause} WHERE relationship_id = ?`);
        stmt.run(...values, relationship_id);

        // LOG #5: Confirmation after the run() operation
        //console.log(`--- RELATIONSHIP UPDATE: UPDATE operation for relationship_id ${relationship_id} executed.`);

        return { success: true };
    } catch (error) {
        console.error("Failed to update relationship:", error);
        return { success: false, message: error.message };
    }
});

// HANDLER FOR UPSERT RELATIONSHIP
ipcMain.handle('relationship:upsert', async (event, data) => {
    console.log("--- [MAIN] Received Upsert Relationship Request ---", data);
    
    try {
        const { parentTableName, childTableName, fk_child_field } = data;
        
        // 1. Validasi Input
        if (!parentTableName || !childTableName || !fk_child_field) {
             return { success: false, message: "Incomplete data." };
        }

        // 2. Get Table ID & Module Name
        const parentTable = db.prepare("SELECT table_id FROM tables WHERE table_name = ?").get(parentTableName);
        
        // We also fetch 'module_name' for the Child Table
        const childTable = db.prepare("SELECT table_id, module_name FROM tables WHERE table_name = ?").get(childTableName);

        if (!parentTable || !childTable) {
            return { success: false, message: `Table not found.` };
        }

        // 3. Find Existing Relationship
        const existingRel = db.prepare(`
            SELECT relationship_id FROM parent_child_relationships 
            WHERE fk_child_field = ? AND child_table_id = ?
        `).get(fk_child_field, childTable.table_id);

        const transaction = db.transaction(() => {
            if (existingRel) {
                // UPDATE: Only update parent_table_id. 
                // We do NOT update tab_title here to avoid overwriting the user's custom title.
                console.log(`--- [MAIN] Updating Relationship ID: ${existingRel.relationship_id}`);
                db.prepare(`
                    UPDATE parent_child_relationships 
                    SET parent_table_id = ? 
                    WHERE relationship_id = ?
                `).run(parentTable.table_id, existingRel.relationship_id);
            } else {
                // INSERT: Title Case logic here
                console.log("--- [MAIN] Creating New Relationship");
                
                // Find parent field
                const pkField = db.prepare(`
                    SELECT field_name FROM fields 
                    WHERE table_id = ? AND primary_key = 1 
                    LIMIT 1
                `).get(parentTable.table_id);
                const parentFieldName = pkField ? pkField.field_name : 'id';

                // Generate tab_title from module_name (or table_name if module_name is missing)
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
        console.error("--- [MAIN] SQL Error:", error);
        return { success: false, message: error.message };
    }
});

// HANDLER FOR DELETE RELATIONSHIP
ipcMain.handle('relationship:delete', async (event, data) => {
    try {
        const { childTableName, fk_child_field } = data;
        const deleteStmt = db.prepare(`
            DELETE FROM parent_child_relationships 
            WHERE fk_child_field = ? 
            AND child_table_id = (SELECT table_id FROM tables WHERE table_name = ?)
        `);
        deleteStmt.run(fk_child_field, childTableName);
        
        // Optional: Clear lookup settings on that field
        // db.prepare("UPDATE fields SET lookup_parent_table = NULL, lookup_caption_1 = NULL WHERE field_name = ? AND table_id = (SELECT table_id FROM tables WHERE table_name = ?)").run(fk_child_field, childTableName);
        
        return { success: true };
    } catch (error) {
        console.error("Failed to delete relationship:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('custom-module:save', async (event, data) => {
    // 1. Destructuring - we capture project_id and settings_override
    const { project_id, module_id, table_id, module_name, menu_icon, filter_rules, included_relations, fields, settings_override } = data;
    
    if (!table_id || !module_name) {
        return { success: false, message: 'Table ID and Module Name are required.' };
    }

    const transaction = db.transaction(() => {
        let viewId = module_id;
        let isNewView = false;

        if (viewId) { // Update existing module
            // COALESCE: when a caller (e.g. the Create/Edit modal) omits
            // filter_rules / included_relations / settings_override, keep the
            // stored values instead of wiping them with NULL.
            db.prepare(
                `UPDATE custom_modules SET module_name = ?, menu_icon = ?,
                 filter_rules = COALESCE(?, filter_rules),
                 included_relations = COALESCE(?, included_relations),
                 settings_override = COALESCE(?, settings_override)
                 WHERE module_id = ?`
            ).run(module_name, menu_icon, filter_rules ?? null, included_relations ?? null, settings_override ?? null, viewId);
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
        
        // Get the statement to find field ID by name
        const getFieldIdStmt = db.prepare('SELECT field_id FROM fields WHERE table_id = ? AND field_name = ?');
        
        const insertFieldStmt = db.prepare(
            `INSERT INTO custom_module_fields (module_id, field_id, is_readonly, settings_override, display_order) 
             VALUES (?, ?, ?, ?, ?)`
        );

if (fields && Array.isArray(fields)) {
            fields.forEach((field, index) => {
                let actualFieldId = field.field_id;
                
                // If data comes from the UI (Create Modal), it has no field_id but has sourceName
                if (!actualFieldId && (field.sourceName || field.field_source_name)) {
                    const fData = getFieldIdStmt.get(table_id, field.sourceName || field.field_source_name);
                    if (fData) actualFieldId = fData.field_id;
                }

                if (actualFieldId) {
                    // Capture the format from RAM (Auto-Save) or the format from the UI (Create)
                    const isReadonly = field.isReadonly !== undefined ? (field.isReadonly ? 1 : 0) : (field.is_readonly ? 1 : 0);
                    
                    let finalSettingsOverride = field.settings_override || "{}";
                    // If from the UI (has label), we build the JSON override
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
        
// Create menu item if it is a new module
        let newMenuItemObj = null; // Variable to hold the new menu data

        if (isNewView) {
            const tableInfo = db.prepare('SELECT table_name, project_id FROM tables WHERE table_id = ?').get(table_id);
            if (tableInfo) {
                const maxMenuOrderResult = db.prepare(
                    'SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL'
                ).get(tableInfo.project_id);
                const nextMenuOrder = (maxMenuOrderResult?.max_order ?? -1) + 1;
                
                // Create menu item if it is a new module
                const menuLabel = module_name; 
                const menuUrl = `${tableInfo.table_name} Custom Module`;

                // WE USE module_id TO MATCH THE FRONTEND
                const menuInfo = db.prepare(
                    `INSERT INTO menu_items (project_id, module_id, item_label, item_detail, item_order) VALUES (?, ?, ?, ?, ?)`
                ).run(tableInfo.project_id, viewId, menuLabel, menuUrl, nextMenuOrder);
                
                // Get the menu record that was just created
                newMenuItemObj = db.prepare('SELECT * FROM menu_items WHERE item_id = ?').get(menuInfo.lastInsertRowid);
            }
        }
        
// 1. WE RETURN BOTH FROM INSIDE THE TRANSACTION
        return { viewId, newMenuItemObj };
    });

    try {
        // 2. CAPTURE BOTH OUTSIDE THE TRANSACTION
        const { viewId, newMenuItemObj } = transaction();
        
        const savedView = db.prepare('SELECT * FROM custom_modules WHERE module_id = ?').get(viewId);
        return { success: true, view: savedView, newMenuItem: newMenuItemObj };
    } catch (error) {
        console.error("Failed to save custom module:", error);
        return { success: false, message: error.message };
    }
});

// ---------------------------------------------------------
    // 1. FIX: Save the Field Override - Fix "no such column: id"
    // ---------------------------------------------------------
    ipcMain.handle('custom-module:save-field-override', async (event, data) => {
        try {
            const { module_id, field_id, settings_override } = data;
            
            // Check existence using the composite key (module_id + field_id)
            // We don't use 'SELECT id' to avoid errors if the id column is missing
            const check = db.prepare("SELECT count(*) as count FROM custom_module_fields WHERE module_id = ? AND field_id = ?").get(module_id, field_id);

            if (check.count > 0) {
                // UPDATE: Use module_id and field_id as the condition
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
    // 2. ADD: Save the Table Override - For Bug 1 & 2
    // ---------------------------------------------------------
    ipcMain.handle('custom-module:save-table-override', async (event, data) => {
        try {
            const { module_id, settings_override } = data;
            
            // We store the table override in the 'settings_override' column of the 'custom_modules' table
            // Make sure this column exists. If not, we just try to update.
            
            const stmt = db.prepare("UPDATE custom_modules SET settings_override = ? WHERE module_id = ?");
            const info = stmt.run(settings_override, module_id);

            if (info.changes === 0) {
                return { success: false, message: "Module ID not found." };
            }

            return { success: true };
        } catch (err) {
            // If the "no such column: settings_override" error occurs
            if (err.message.includes('no such column: settings_override')) {
                // Auto-fix: Add the column (SQLite)
                try {
                    db.prepare("ALTER TABLE custom_modules ADD COLUMN settings_override TEXT").run();
                    // Try saving again
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
            // Delete the related menu item first
            db.prepare('DELETE FROM menu_items WHERE module_id = ?').run(viewId);
            // Then delete the custom view (will delete custom_module_fields via CASCADE)
            db.prepare('DELETE FROM custom_modules WHERE module_id = ?').run(viewId);
        });
        transaction();
        return { success: true };
    } catch (error) {
        console.error("Failed to delete custom view:", error);
        return { success: false, message: error.message };
    }
});

// ---------------------------------------------------------
// STARTER PACKS (presets): list / preview / install
// ---------------------------------------------------------
const { installPreset, checkCollisions, loadBundledPresets, presetSummary } = require('../core/presetInstaller');

function bundledPresets() {
    return loadBundledPresets(path.join(__dirname, '..', 'presets'));
}

ipcMain.handle('preset:list', async () => {
    try {
        return { success: true, presets: bundledPresets().map((p) => presetSummary(p.manifest)) };
    } catch (error) {
        console.error('Failed to list presets:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('preset:preview', async (event, slug) => {
    try {
        const found = bundledPresets().find((p) => p.manifest.slug === slug);
        if (!found) return { success: false, message: `Unknown preset: ${slug}` };
        const active = db.prepare('SELECT project_id FROM projects WHERE is_active = 1').get();
        const conflicts = active ? checkCollisions(db, active.project_id, found.manifest) : { tables: [], modules: [] };
        return { success: true, manifest: found.manifest, conflicts };
    } catch (error) {
        console.error('Failed to preview preset:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('preset:install', async (event, slug) => {
    try {
        const found = bundledPresets().find((p) => p.manifest.slug === slug);
        if (!found) return { success: false, message: `Unknown preset: ${slug}` };
        const active = db.prepare('SELECT project_id FROM projects WHERE is_active = 1').get();
        if (!active) return { success: false, message: 'No active project. Create or open a project first.' };
        const result = installPreset(db, active.project_id, found.manifest);
        if (result.success) {
            console.log(`Starter pack '${slug}' installed into project ${active.project_id}`);
        }
        return result;
    } catch (error) {
        console.error('Failed to install preset:', error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('project:get-initial-status', async (event, projectId) => {
  try {
    const tables = db.prepare('SELECT table_name FROM tables WHERE project_id = ?').all(projectId);

    // Show the tutorial if there are no tables, OR if there is only 1 table named 'users'
    if (tables.length === 0 || (tables.length === 1 && tables[0].table_name === 'users')) {
      return { showTutorial: true };
    }

    return { showTutorial: false };
  } catch (error) {
    console.error("Failed to get initial project status:", error);
    return { showTutorial: false };
  }
});

//ipcMain.handle('generate-app', async () => {
//    const win = BrowserWindow.getFocusedWindow();
//    try {
//        // 1. Get Active Project
//        const activeProject = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
//        if (!activeProject) throw new Error("No active project found.");
//
//        const projectId = activeProject.project_id;
//        
//        // Get the Full Schema
//        const fullSchema = await getFullProjectSchema(projectId);
//        if (!fullSchema) throw new Error("Failed to get full project schema.");
//
//        // Determine the Chosen Stack (Based on your HTML <select>)
//        // Default to 'core_php' per schema, but we handle fallback to laravel if needed
//        const selectedStack = activeProject.stack_base || 'core_php';
//        
//        console.log(`Starting generation for Project ID: ${projectId} | Stack: ${selectedStack}`);
//        win?.webContents.send('show-overlay', { message: `Generating app (${selectedStack})...` });
//
//        // 2. Determine the Temporary Folder (Staging Area)
//        const tempBasePath = getGeneratedFolderPath(); 
//        // Unique staging folder name to avoid conflicts
//        const stagingFolderName = `${activeProject.app_title.replace(/[^a-zA-Z0-9_-]/g, '_')}_staging`;
//        const stagingPath = path.join(tempBasePath, stagingFolderName);
//
//        // Clean the staging folder (Reset)
//        if (fs.existsSync(stagingPath)) {
//            fs.rmSync(stagingPath, { recursive: true, force: true });
//        }
//        fs.mkdirSync(stagingPath, { recursive: true });
//
//        // 3. GENERATOR LOGIC SWITCH (Dispatcher)
//        let generateResult;
//
//        switch (selectedStack) {
//            case 'laravel_filament':
//                // Call the Laravel Filament Orchestrator
//                generateResult = await generateLaravelFilamentStack(fullSchema, stagingPath);
//                break;
//
//            case 'laravel_backpack':
//                generateResult = { success: false, message: "Laravel Backpack generator not yet available." };
//                break;
//            
//            case 'core_php':
//                generateResult = { success: false, message: "Core PHP generator under development." };
//                break;
//
//            case 'ci4':
//            case 'ci3':
//                generateResult = { success: false, message: "CodeIgniter generator coming soon." };
//                break;
//            
//            case 'django':
//            case 'flask':
//                generateResult = { success: false, message: "Python generator not yet available." };
//                break;
//
//            // ... Add other cases based on your HTML (aspnet_core, ror, java_spring, mean, etc.) ...
//
//            default:
//                // Safety fallback
//                console.warn(`Stack '${selectedStack}' unknown. Trying Laravel Filament as default.`);
//                generateResult = await generateLaravelFilamentStack(fullSchema, stagingPath);
//                break;
//        }
//
//        // If generation FAILS at the staging stage, stop here.
//        if (!generateResult.success) {
//            throw new Error(generateResult.message);
//        }
//
//        // 4. MOVE-TO-DOC_ROOT LOGIC (Deployment)
//        let finalPath = stagingPath; 
//        
//        // Baca setting doc_root
//        const docRootSetting = db.prepare("SELECT setting_value FROM fixzy_settings WHERE setting_name = 'doc_root'").get();
//
//        if (docRootSetting && docRootSetting.setting_value && docRootSetting.setting_value.trim() !== '') {
//            const docRoot = docRootSetting.setting_value;
//            // Sanitize the project folder name
//            const appFolderName = activeProject.app_title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
//            const destinationPath = path.join(docRoot, appFolderName);
//
//            console.log(`Moving files to Doc Root: ${destinationPath}`);
//            win?.webContents.send('show-overlay', { message: 'Moving files to the server folder...' });
//
//            try {
//                if (!fs.existsSync(destinationPath)) {
//                    fs.mkdirSync(destinationPath, { recursive: true });
//                }
//                
//                // Copy from Staging to Doc Root (Overwrite)
//                fs.cpSync(stagingPath, destinationPath, { recursive: true, force: true });
//                
//                // Set finalPath to the actual location to be opened by the frontend
//                finalPath = destinationPath;
//
//            } catch (moveError) {
//                console.error("Failed to move files:", moveError);
//                // Don't throw an error here, so the user can still access files in the temp folder
//                ctx.dialog.showErrorBox("Move Warning", `App generated successfully but failed to copy to Doc Root.\nPlease check folder permissions.\nFile location: ${stagingPath}`);
//            }
//        }
//
//        return { 
//            success: true, 
//            message: 'App generated successfully!',
//            folderPath: finalPath // This is important for the "Open Folder" button in the frontend
//        };
//
//    } catch (error) {
//        console.error('Generation Process Error:', error);
//        return { success: false, message: error.message };
//    } finally {
//        win?.webContents.send('hide-overlay');
//    }
//});

ipcMain.handle('generate-app', async (event) => { // Note 'event' added here
    const win = ctx.getWindow(event);
    try {
        // 1. Get Project Data & Schema
        const activeProject = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
        if (!activeProject) throw new Error("No active project found.");

        const fullSchema = await getFullProjectSchema(activeProject.project_id);
        if (!fullSchema) throw new Error("Failed to get full project schema.");

        // IR validation (Phase 1): export + validate before generating.
        // Non-fatal during migration: warns but proceeds (legacy data may have
        // edge shapes). Becomes a hard gate in Phase 2 once generators read IR.
        try {
            const { exportIR } = require('./ir/exporter');
            const { validateIR } = require('./ir/validate');
            const ir = exportIR(fullSchema);
            const { valid, errors } = validateIR(ir);
            if (!valid) {
                console.warn(`[IR] ${errors.length} validation issue(s):`);
                for (const e of errors.slice(0, 10)) console.warn(`  ${e.path}: ${e.message}`);
            } else {
                console.log('[IR] schema exported and validated OK');
            }
        } catch (irErr) {
            console.warn('[IR] export/validation failed (non-fatal):', irErr.message);
        }

        const selectedStack = activeProject.stack_base || 'core_php';

        win?.webContents.send('show-overlay', { message: `Generating app files (${selectedStack})...` });

        // 2. PHASE 1: GENERATE SCRIPT TO THE STAGING FOLDER (AppData)
        const tempBasePath = getGeneratedFolderPath(); 
        const stagingFolderName = `${activeProject.app_title.replace(/[^a-zA-Z0-9_-]/g, '_')}_staging`;
        const stagingPath = path.join(tempBasePath, stagingFolderName);

        // Clean the staging folder
        if (fs.existsSync(stagingPath)) {
            fs.rmSync(stagingPath, { recursive: true, force: true });
        }
        fs.mkdirSync(stagingPath, { recursive: true });

        // Run the Generator based on the Stack
        let generateResult;
        switch (selectedStack) {
            case 'laravel_filament':
                generateResult = await generateLaravelFilamentStack(fullSchema, stagingPath);
                break;
            case 'laravel_backpack':
                generateResult = { success: false, message: "Laravel Backpack generator not yet available." };
                break;
            
            case 'core_php':
                generateResult = { success: false, message: "Core PHP generator under development." };
                break;

            case 'ci4':
            case 'ci3':
                generateResult = { success: false, message: "CodeIgniter generator coming soon." };
                break;
            
            case 'django':
            case 'flask':
                generateResult = { success: false, message: "Python generator not yet available." };
                break;            default:
                console.warn(`Stack '${selectedStack}' not fully supported yet. Using Laravel Filament.`);
                generateResult = await generateLaravelFilamentStack(fullSchema, stagingPath);
                break;
        }

        if (!generateResult.success) {
            throw new Error(`Generation Error: ${generateResult.message}`);
        }

        // 3. PHASE 2: DETERMINE THE ACTUAL PROJECT LOCATION (DOC_ROOT)
        // Get the global settings
        const settings = db.prepare("SELECT setting_name, setting_value FROM fixzy_settings").all();
        const config = settings.reduce((acc, curr) => ({ ...acc, [curr.setting_name]: curr.setting_value }), {});

        const docRoot = config.doc_root;
        
        // If doc_root is not set, we can only provide the staging folder
        if (!docRoot || docRoot.trim() === '') {
            return { 
                success: true, 
                message: 'App generated successfully in the temporary folder (Doc Root not set).',
                folderPath: stagingPath 
            };
        }

        // Determine the destination path
        const appFolderName = activeProject.app_title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        const destinationPath = path.join(docRoot, appFolderName);

        // Phase 5.4: in web/serve mode, destinations must stay inside the
        // configured output roots (FSM_OUTPUT_ROOTS). Electron desktop keeps
        // its historical unrestricted doc_root behaviour.
        if (ctx.enforceOutputRoots) {
            const { validateOutputPath } = require('../core/pathGuard');
            const guard = validateOutputPath(destinationPath, { env: process.env });
            if (!guard.ok) {
                throw new Error(`Doc Root rejected (path allowlist): ${guard.reason}`);
            }
        }
        
        let finalActionMessage = "";

        // 4. PHASE 3: CHECK PROJECT EXISTENCE & EXECUTE THE FUNCTION
        if (fs.existsSync(destinationPath)) {
            // ========================================================
            // CASE A: FOLDER EXISTS -> RUN UPDATE
            // ========================================================
            console.log(`Project detected at ${destinationPath}. Running UPDATE...`);
            win?.webContents.send('show-overlay', { message: 'Updating existing app...' });

            const updateConfig = {
                projectPath: destinationPath,
                generatedPath: stagingPath
            };

            // Call the function from deploymentHandler.js
            // We pass 'event' so it can send logs to the UI
            const updateResult = await updateApp(event, updateConfig);
            
            if (!updateResult.success) throw new Error(updateResult.message);
            finalActionMessage = "App updated successfully!";

        } else {
            // ========================================================
            // CASE B: FOLDER MISSING -> RUN DEPLOY
            // ========================================================
            console.log(`Project does not exist yet at ${destinationPath}. Running DEPLOY...`);
            win?.webContents.send('show-overlay', { message: 'Starting new installation (Deploy)...' });

            // Prepare the Deploy configuration
            const dbName = `db_${appFolderName}`;
            const dbUser = `user_${appFolderName.substring(0, 10)}`; // Limit the user name length
            const dbPass = 'password123'; // IDEALLY: Generate a random password or take it from settings

            const deployConfig = {
                gitRepoUrl: config.git_repo_url || 'https://github.com/mohdhafizi83/Fixzy SysMaker-Laravel-Filament-Boilerplate.git', // Default if no setting exists
                projectPath: destinationPath,
                generatedPath: stagingPath,
                dbConfig: {
                    host: 'localhost',
                    user: dbUser,
                    password: dbPass,
                    dbName: dbName,
                    rootPassword: config.db_root_password || '' // IMPORTANT: Required for creating the DB
                }
            };

            const deployResult = await deployApp(event, deployConfig);

            if (!deployResult.success) throw new Error(deployResult.message);
            finalActionMessage = "New app installed successfully!";
        }

        return { 
            success: true, 
            message: finalActionMessage,
            folderPath: destinationPath 
        };

    } catch (error) {
        console.error('Generate App Error:', error);
        return { success: false, message: error.message };
    } finally {
        win?.webContents.send('hide-overlay');
    }
});

// Handler for opening a folder (usually called after a successful generate)
ipcMain.on('open-folder', (event, folderPath) => {
    if (folderPath && fs.existsSync(folderPath)) {
        shell.openPath(folderPath);
    } else {
        console.error(`Failed to open folder: ${folderPath} does not exist.`);
    }
});

// "View files" button: open (or report) the most recent generated app folder.
ipcMain.handle('generated:open-latest', async () => {
    try {
        const generatedRoot = getGeneratedFolderPath();
        const entries = fs.readdirSync(generatedRoot, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => ({ name: e.name, mtime: fs.statSync(path.join(generatedRoot, e.name)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);
        if (entries.length === 0) {
            return { success: false, message: 'No generated application yet. Generate one first.' };
        }
        const latest = path.join(generatedRoot, entries[0].name);
        if (ctx.shell && typeof ctx.shell.openPath === 'function') {
            const err = await ctx.shell.openPath(latest);
            if (err) return { success: false, message: err };
        }
        return { success: true, folderPath: latest };
    } catch (error) {
        return { success: false, message: error.message };
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
            // 1. Save the new constraint definition
            const columnsJson = JSON.stringify(columns);
            db.prepare(
                `INSERT INTO table_constraints (table_id, constraint_type, columns) VALUES (?, ?, ?)`
            ).run(table_id, constraint_type, columnsJson);

            // 2. Update the 'unique' status for each involved field
            const updateStmt = db.prepare(`UPDATE fields SET "unique" = 1 WHERE table_id = ? AND field_name = ?`);
            for (const fieldName of columns) {
                updateStmt.run(table_id, fieldName);
            }
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error("Failed to save table constraints:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('table:delete-constraint', async (event, { constraint_id }) => {
    if (!constraint_id) {
        return { success: false, message: 'Constraint ID is required.' };
    }
    
    try {
        const transaction = db.transaction(() => {
            // 1. Get constraint info before deleting
            const constraint = db.prepare('SELECT * FROM table_constraints WHERE constraint_id = ?').get(constraint_id);
            if (!constraint) {
                throw new Error('Constraint not found.');
            }
            const { table_id, columns: columnsJson } = constraint;
            const columns = JSON.parse(columnsJson);

            // 2. Delete the constraint itself
            db.prepare('DELETE FROM table_constraints WHERE constraint_id = ?').run(constraint_id);

            // 3. Re-check each involved field
            const checkStmt = db.prepare('SELECT 1 FROM table_constraints WHERE table_id = ? AND columns LIKE ? LIMIT 1');
            const updateStmt = db.prepare(`UPDATE fields SET "unique" = 0 WHERE table_id = ? AND field_name = ?`);
            
            for (const fieldName of columns) {
                // Check if this field is still part of ANOTHER UNIQUE CONSTRAINT
                const isStillUnique = checkStmt.get(table_id, `%"${fieldName}"%`);
                
                // If not, remove the 'unique' status from it
                if (!isStillUnique) {
                    updateStmt.run(table_id, fieldName);
                }
            }
        });

        transaction();
        return { success: true };
    } catch (error) {
        console.error("Failed to delete table constraints:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('field:update-index', async (event, { field_id, is_indexed }) => {
    try {
        db.prepare('UPDATE fields SET is_indexed = ? WHERE field_id = ?').run(is_indexed ? 1 : 0, field_id);
        return { success: true };
    } catch (error) {
        console.error("Failed to update field index:", error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('app:deploy', deployApp);
ipcMain.handle('app:update', updateApp);

// =================================================================
// BUILT-IN PREVIEW SERVER FUNCTIONS
// =================================================================

ipcMain.handle('preview:start', async (event, projectPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Determine the PHP path (Same as runComposer)
            const baseBinPath = ctx.isPackaged 
                ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin')
                : path.join(__dirname, '../../bin');
            const phpPath = require('../core/phpResolver').resolvePhpBinary(baseBinPath);

            // 2. Kill the existing server if it is running
            if (previewServerProcess) {
                previewServerProcess.kill();
                previewServerProcess = null;
                console.log("Previous preview server has been stopped.");
            }

            const port = await findFreePort();
            previewServerPort = port;
            // 3. Make sure the database.sqlite file exists (Avoid Laravel prompt)
            const dbPath = path.join(projectPath, 'database', 'database.sqlite');
            if (!fs.existsSync(dbPath)) {
                fs.writeFileSync(dbPath, ''); // Create an empty file
            }

            console.log(`Preparing the database at: ${projectPath}`);

            // 4. Run Migrate & Seed (Build tables and insert test data)
            const migrateProcess = spawn(phpPath, ['artisan', 'migrate:fresh', '--seed', '--force'], {
                cwd: projectPath,
                stdio: 'pipe' // Ignore output to speed things up
            });

            migrateProcess.on('close', (code) => {
                if (code !== 0) {
                    return resolve({ success: false, message: "Error while running database migration." });
                }

                console.log("Migration successful! Starting Laravel server...");

                // 5. Start the PHP Built-in Server (dynamic free port)
                previewServerProcess = spawn(phpPath, ['artisan', 'serve', `--port=${port}`], {
                    cwd: projectPath,
                    stdio: 'pipe'
                });

                previewServerProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    console.log(`[Server]: ${output}`);
                    
                    // If the server starts successfully, Laravel will display "Server running on..."
                    if (output.includes('running') || output.includes('127.0.0.1')) {
                        resolve({ success: true, url: `http://127.0.0.1:${port}/admin` });
                    }
                });

                previewServerProcess.stderr.on('data', (data) => {
                    console.error(`[Server Error]: ${data.toString()}`);
                });

                previewServerProcess.on('error', (err) => {
                    resolve({ success: false, message: `Failed to start server: ${err.message}` });
                });
            });

        } catch (error) {
            resolve({ success: false, message: error.message });
        }
    });
});

// Function to stop the server (Can be called when the user closes Fixzy SysMaker)
ipcMain.handle('preview:stop', () => {
    if (previewServerProcess) {
        previewServerProcess.kill();
        previewServerProcess = null;
        console.log("Preview server has been stopped by the user.");
        return true;
    }
    return false;
});

// =================================================================
// CHANGE DETECTION SYSTEM (DIFF CHECKER) FOR HOT RELOAD
// =================================================================

/**
 * Compares the Old and New Schemas to determine the Preview Scenario
 * Returns:
 * 1 = No Changes (Just reopen the modal)
 * 2 = UI/Settings Changes (Generate UI code + Clear Cache)
 * 3 = Database Changes (Regenerate everything + Migrate DB)
 * 4 = Limited Database Changes (options_list / array type choice)
 * Returned Object: { scenario: 1|2|3|4, targets: ['table_name'] }
 */
function analyzeSchemaDiff(oldSchema, newSchema) {
    if (!oldSchema) {
        console.log("[Diff Checker] No old memory. Force Scenario 3 (First Run).");
        return { scenario: 3, targets: [] }; 
    }

    const oldStr = JSON.stringify(oldSchema);
    const newStr = JSON.stringify(newSchema);
    
    if (oldStr === newStr) {
        console.log("[Diff Checker] Schemas 100% identical. Entering Scenario 1.");
        return { scenario: 1, targets: [] };
    }

    // Scenario 3 Test (Database Changes)
    const isDbChanged = checkDatabaseChanges(oldSchema, newSchema);
    if (isDbChanged) {
        console.log("[Diff Checker] Database structure change detected. Entering Scenario 3.");
        return { scenario: 3, targets: [] };
    }

    // ▼▼▼ START: SCENARIO 4 TEST (TARGETED REFRESH FOR OPTIONS LIST & ARRAY) ▼▼▼
    let targetedTables = [];
    const oldTables = oldSchema.database.table;
    const newTables = newSchema.database.table;

    for (const tableName in newTables) {
        const newTable = newTables[tableName];
        const oldTable = oldTables[tableName] || { fields: {} };
        
        let requiresFakeDataRefresh = false;
        
        for (const fieldName in newTable.fields) {
            const newField = newTable.fields[fieldName];
            const oldField = oldTable.fields[fieldName] || {};

            const oldOptions = oldField.options_list_values || '';
            const newOptions = newField.options_list_values || '';
            
            // 1. Did the display type change?
            const isDisplayTypeChanged = oldField.display_type !== newField.display_type;
            
            // 2. Does it involve options_list (either FROM or TO)?
            const involvesOptionsList = oldField.display_type === 'options_list' || newField.display_type === 'options_list';
            
            // 3. Does it involve Array/JSON components?
            const arrayTypes = ['multiple_select', 'checkbox_list', 'tags_input', 'repeater', 'repeater_simple'];
            const involvesArrayType = arrayTypes.includes(oldField.display_type) || arrayTypes.includes(newField.display_type);

            // SCENARIO 4 TRIGGER LOGIC:
            if (
                // Case A: Switch FROM or TO options_list/array_type
                (isDisplayTypeChanged && (involvesOptionsList || involvesArrayType)) ||
                
                // Case B: Stays options_list, but its values (options_list_values) changed
                (newField.display_type === 'options_list' && oldOptions !== newOptions)
            ) {
                requiresFakeDataRefresh = true;
                break; // One changed field is enough; we refresh this table
            }
        }
        
        if (requiresFakeDataRefresh) {
            targetedTables.push(tableName);
        }
    }

    if (targetedTables.length > 0) {
        console.log(`[Diff Checker] UI data format change detected. Entering Scenario 4 for tables: ${targetedTables.join(', ')}`);
        return { scenario: 4, targets: targetedTables };
    }
    // ▲▲▲ END SCENARIO 4 TEST ▲▲▲

    console.log("[Diff Checker] Only UI/Settings changes detected. Entering Scenario 2.");
    return { scenario: 2, targets: [] };
}

/**
 * Helper function to check only the physical characteristics of the Database
 */
function checkDatabaseChanges(oldS, newS) {
    // A. Check the number or names of tables
    const oldTables = Object.keys(oldS.database.table);
    const newTables = Object.keys(newS.database.table);
    if (oldTables.length !== newTables.length) return true;

    for (const tName of newTables) {
        if (!oldS.database.table[tName]) return true; // New table added

        const oldFields = oldS.database.table[tName].fields;
        const newFields = newS.database.table[tName].fields;

        // B. Check the number or names of fields
        const oldFieldNames = Object.keys(oldFields);
        const newFieldNames = Object.keys(newFields);
        if (oldFieldNames.length !== newFieldNames.length) return true;

        for (const fName of newFieldNames) {
            if (!oldFields[fName]) return true; // New field added

            const oF = oldFields[fName];
            const nF = newFields[fName];

            // C. Check the PHYSICAL characteristics of fields (If changed, DB migration is mandatory)
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

    // D. Check changes to Relationships (One-to-Many, etc.)
    // Relationship changes involve Foreign Keys in the DB; migration is mandatory
    if (JSON.stringify(oldS.database.relationships) !== JSON.stringify(newS.database.relationships)) {
        return true;
    }

    return false; // No changes to the physical DB footprint
}

// =================================================================
// BUILT-IN PREVIEW SERVER FUNCTIONS (SMART REBUILD / HOT RELOAD)
// =================================================================
ipcMain.handle('preview:instant-run', async (event) => { 
    const win = ctx.getWindow(event); 
    return new Promise(async (resolve, reject) => {
        try {
            // Template resolution (download-on-first-run): dev checkout uses
            // resources/preview_env; packaged apps use ~/.fixzy/preview_env
            // (downloaded by the setup wizard / setup:binaries).
            const { resolvePreviewTemplate } = require('../core/setupRunner');
            const templatePreviewPath = resolvePreviewTemplate(
                ctx.isPackaged ? process.resourcesPath : path.join(__dirname, '../..'));
            const userDataPath = ctx.getPath('userData'); 
            const workingPreviewPath = path.join(userDataPath, 'preview_env');

            // 1. FIRST-TIME COPY (Physical)
            if (!fs.existsSync(workingPreviewPath)) {
                if (!fs.existsSync(path.join(templatePreviewPath, 'artisan'))) return resolve({ success: false, message: `Preview template not found at ${templatePreviewPath}. Run Setup (or \`npm run setup:binaries\`) to download it first.` });

                const { response } = await ctx.dialog.showMessageBox(win, {
                    type: 'info', buttons: ['OK', 'Cancel'], title: 'Preview Environment Setup',
                    message: 'First-Time Installation',
                    detail: 'This is your first time using the Show Preview feature.\nThis process involves copying the base system files and may take 1 to 3 minutes.\n\nDo you want to continue?'
                });

                if (response !== 0) return resolve({ success: false, message: 'Cancelled by user.' });

                win?.webContents.send('show-overlay', { message: 'Counting system files. Please wait...', progress: 0 });
                await copyDirWithProgress(templatePreviewPath, workingPreviewPath, (copied, total, percentage) => {
                    win?.webContents.send('show-overlay', { message: `Preparing environment (Copying files ${copied}/${total})...`, progress: Math.round(percentage * 0.90) });
                });
            } else {
                win?.webContents.send('show-overlay', { message: 'Checking schema changes...', progress: 90 });
            }

            const previewPath = workingPreviewPath;
            const baseBinPath = ctx.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin') : path.join(__dirname, '../../bin'); 
            const phpPath = require('../core/phpResolver').resolvePhpBinary(baseBinPath);
            // Reuse the live preview port if our server is still up; else pick a free one.
            const port = (previewServerProcess && previewServerPort)
                ? previewServerPort
                : await findFreePort();
            previewServerPort = port;

            // ========================================================
            // 2. GET THE LATEST SCHEMA DATA & LOAD FROM THE PHYSICAL DISK (HARD DISK)
            // ========================================================
            const activeProject = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
            if (!activeProject) return resolve({ success: false, message: "No active project found." });

            const fullSchema = await getFullProjectSchema(activeProject.project_id);
            if (!fullSchema) return resolve({ success: false, message: "Failed to get project schema." });
            
// --- START: UPDATE PROJECT NAME & SETTINGS IN .ENV ---
            const envPath = path.join(previewPath, '.env');
            let envChanged = false;
            
            if (fs.existsSync(envPath)) {
                // envContent is declared here (inside the 'if' scope)
                let envContent = fs.readFileSync(envPath, 'utf8');
                
                // 1. APP_NAME Update Logic
                const rawAppName = activeProject.app_title || 'Fixzy SysMakerApp';
                const safeAppName = rawAppName.includes(' ') ? `"${rawAppName}"` : rawAppName;
                const currentAppNameMatch = envContent.match(/^APP_NAME=(.*)$/m);
                const currentAppName = currentAppNameMatch ? currentAppNameMatch[1] : null;

                if (currentAppName !== safeAppName) {
                    envContent = envContent.replace(/^APP_NAME=.*$/m, `APP_NAME=${safeAppName}`);
                    envContent = envContent.replace(/^VITE_APP_NAME=.*$/m, `VITE_APP_NAME=${safeAppName}`);
                    envChanged = true;
                    console.log(`[Preview] APP_NAME updated to: ${safeAppName}`);
                }

                // 2. APP_DEBUG & DEBUGBAR_ENABLED Update Logic
                // Uses activeProject.debug_mode (from the Checkbox UI)
                const isDebugEnabled = activeProject.debug_mode == 1 || activeProject.debug_mode === 'true';
                const targetDebugMode = isDebugEnabled ? 'true' : 'false'; 
                
                // A. Update APP_DEBUG (Detailed errors)
                const currentAppDebugMatch = envContent.match(/^APP_DEBUG=(.*)$/m);
                const currentAppDebug = currentAppDebugMatch ? currentAppDebugMatch[1].trim() : null;

                if (currentAppDebug !== targetDebugMode) {
                    envContent = envContent.replace(/^APP_DEBUG=.*$/m, `APP_DEBUG=${targetDebugMode}`);
                    envChanged = true;
                    console.log(`[Preview] APP_DEBUG updated to: ${targetDebugMode}`);
                }

                // B. Update or Add DEBUGBAR_ENABLED (Red Bar at the bottom of the screen)
                const currentDebugbarMatch = envContent.match(/^DEBUGBAR_ENABLED=(.*)$/m);
                
                if (currentDebugbarMatch) {
                    const currentDebugbar = currentDebugbarMatch[1].trim();
                    if (currentDebugbar !== targetDebugMode) {
                        envContent = envContent.replace(/^DEBUGBAR_ENABLED=.*$/m, `DEBUGBAR_ENABLED=${targetDebugMode}`);
                        envChanged = true;
                        console.log(`[Preview] DEBUGBAR_ENABLED updated to: ${targetDebugMode}`);
                    }
                } else {
                    envContent += `\nDEBUGBAR_ENABLED=${targetDebugMode}\n`;
                    envChanged = true;
                    console.log(`[Preview] DEBUGBAR_ENABLED newly injected as: ${targetDebugMode}`);
                }

                // 3. Save the file if there were any changes
                if (envChanged) {
                    fs.writeFileSync(envPath, envContent, 'utf8');
                }
            }
            // --- END: UPDATE .ENV ---

            // START IMPROVEMENT: Read from Hard Disk if RAM is empty (App just opened)
            const schemaCachePath = path.join(userDataPath, 'last_schema_cache.json');
            if (!lastGeneratedSchema && fs.existsSync(schemaCachePath)) {
                try {
                    lastGeneratedSchema = JSON.parse(fs.readFileSync(schemaCachePath, 'utf8'));
                    console.log("[Preview] Schema memory from the previous session loaded successfully from disk.");
                } catch (e) {
                    console.warn("[Preview] Failed to read schema cache, treating it as a new session.");
                }
            }

            // ========================================================
            // 3. ANALISIS HOT RELOAD (DIFF CHECKER)
            // ========================================================
            const diffResult = analyzeSchemaDiff(lastGeneratedSchema, fullSchema);
            let scenario = diffResult.scenario;
            let targetedTables = diffResult.targets;
            
            // If .env changed, force the system into Scenario 2 so the 'optimize:clear' command clears the Laravel cache
            if (scenario === 1 && envChanged) {
                scenario = 2;
                console.log("[Preview] Forcing Scenario 2 (Clear Cache) because APP_NAME was updated.");
            }
            
            // Force Scenario 3 if the database.sqlite file is missing (manually deleted by the user)
            const dbSqlitePath = path.join(previewPath, 'database', 'database.sqlite');
            if (!fs.existsSync(dbSqlitePath)) {
                scenario = 3;
                console.log("[Preview] SQLite database missing. Forcing Scenario 3.");
            }

            // Helper function to start the server uniformly
            const startServerAndResolve = () => {
                win?.webContents.send('show-overlay', { message: 'Starting Local Server...', progress: 99 });
                previewServerProcess = spawn(phpPath, ['artisan', 'serve', `--port=${port}`], { cwd: previewPath });
                previewServerProcess.on('error', (err) => { previewServerProcess = null; previewServerPort = null; resolve({ success: false, message: `Failed to start server: ${err.message}` }); });
                previewServerProcess.on('exit', (code) => {
                    // Server died (before or after resolve) — clear stale state so
                    // the next call re-spawns instead of trusting a dead process.
                    previewServerProcess = null; previewServerPort = null;
                    resolve({ success: false, message: `Preview server exited unexpectedly (code ${code}). Check PHP/preview_env health.` });
                });
                previewServerProcess.stdout.on('data', (data) => {
                    if (data.toString().includes('running') || data.toString().includes('127.0.0.1')) {
                        win?.webContents.send('show-overlay', { message: 'Preview Ready!', progress: 100 });
                        setTimeout(() => resolve({ success: true, url: `http://127.0.0.1:${port}/admin` }), 500);
                    }
                });
            };

            // --- SCENARIO 1: NO CHANGES ---
            if (scenario === 1) {
                console.log("[Preview] Scenario 1: No schema changes.");
                // Verify the tracked process is actually alive (a crashed spawn
                // leaves a stale object; kill(pid,0) probes liveness).
                let alive = false;
                if (previewServerProcess) {
                    try { process.kill(previewServerProcess.pid, 0); alive = true; } catch (e) { alive = false; }
                }
                if (!alive) { previewServerProcess = null; previewServerPort = null; }
                if (previewServerProcess) {
                    // Server is already running, just open it
                    win?.webContents.send('show-overlay', { message: 'Preview Ready!', progress: 100 });
                    return setTimeout(() => resolve({ success: true, url: `http://127.0.0.1:${port}/admin` }), 300);
                } else {
                    // App just opened, server is dead. Just start the server.
                    return startServerAndResolve();
                }
            }

            // Kill the old server IF scenario 3 (to release the DB lock file)
            if (scenario === 3 && previewServerProcess) {
                if (process.platform === 'win32') spawn('taskkill', ['/pid', previewServerProcess.pid, '/f', '/t']);
                else previewServerProcess.kill();
                previewServerProcess = null;
            }

            // ========================================================
            // 4. SMART FOLDER CLEANUP
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
            // 5. GENERATOR TRIGGER
            // ============================================================
            console.log(`[Preview] Generating files for Scenario ${scenario}...`);
            
            if (scenario === 3) {
                await generateLaravelUserMigration(fullSchema, previewPath);
                await generateLaravelMigrations(fullSchema, previewPath);
                await generateLaravelDatabaseSeeder(fullSchema, previewPath);
                await generateFilamentUserModel(fullSchema, previewPath);
                // Native audit files (trait/model/observer/migration) — template
                // User.php references HasAudits, so these MUST exist when
                // module_log_audit=1, else boot fatals with "Trait not found".
                await generateNativeAuditFiles(fullSchema, previewPath);
            }
            
            // Factory must be regenerated for Scenario 3 AND Scenario 4
            if (scenario === 3 || scenario === 4) {
                await generateLaravelFactories(fullSchema, previewPath);
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

            // Workflow hooks + SSO/LDAP integrations (live preview parity
            // with the full-stack generator).
            await generateWorkflowHooks(fullSchema, previewPath);
            await generateAuthIntegrations(fullSchema, previewPath);

            // Combined login page referenced by AdminPanelProvider when
            // captcha or LDAP is enabled. auth_captcha_mode selects basic
            // (arithmetic) vs Google reCAPTCHA v2 (replaces the arithmetic check).
            const authConfig = require('../generators/authConfig');
            const captchaOn = Number((fullSchema.project || {}).module_auth_email_captcha) === 1;
            const recaptcha = authConfig.isRecaptcha(fullSchema.project);
            const captcha = captchaOn && !recaptcha;
            const ldapOn = Number((fullSchema.project || {}).module_auth_ldap) === 1;
            if (captcha || recaptcha || ldapOn) {
                const authDir = path.join(previewPath, 'app', 'Filament', 'Auth');
                fs.mkdirSync(authDir, { recursive: true });
                fs.writeFileSync(
                    path.join(authDir, 'FixzyLogin.php'),
                    renderTemplate('app/Filament/Auth/FixzyLogin.php.njk', { captcha, recaptcha, ldap: ldapOn })
                );
            }
            if (recaptcha) {
                const viewsDir = path.join(previewPath, 'resources', 'views', 'filament');
                fs.mkdirSync(viewsDir, { recursive: true });
                fs.writeFileSync(
                    path.join(viewsDir, 'fixzy-recaptcha-widget.blade.php'),
                    renderTemplate('resources/views/filament/fixzy-recaptcha-widget.blade.php.njk', {})
                );
            }

            // Save the schema memory after code is successfully generated to RAM and Hard Disk
            lastGeneratedSchema = JSON.parse(JSON.stringify(fullSchema));
            fs.writeFileSync(schemaCachePath, JSON.stringify(lastGeneratedSchema), 'utf8');

            // The template's vendor/composer classmap was built at template time
            // and still maps deleted classes (e.g. old Resources/Policies).
            // Filament's discovery reads the classmap -> "Class not found".
            // Regenerate the autoloader (no deps install) after generation.
            // NOTE: optimize:clear is NOT run here — its cache-store flush needs
            // the DB tables and aborts before reaching the filament panel cache
            // on a fresh (unmigrated) env. The clear happens post-migration.
            const composerPhar = path.join(baseBinPath, 'composer.phar');
            const composerCmd = fs.existsSync(composerPhar) ? phpPath : 'composer';
            const composerArgs = fs.existsSync(composerPhar) ? [composerPhar, 'dump-autoload', '-q'] : ['dump-autoload', '-q'];
            await new Promise((r) => {
                const dumpProc = spawn(composerCmd, composerArgs, { cwd: previewPath });
                dumpProc.on('close', r);
                dumpProc.on('error', r);
            });

            // Also drop the bundled Filament panel cache directly via fs:
            // artisan optimize:clear aborts at its DB cache-store flush on a
            // fresh (unmigrated) env, leaving this file stale. Filament
            // re-discovers and rebuilds it on next boot.
            fs.rmSync(path.join(previewPath, 'bootstrap', 'cache', 'filament'), { recursive: true, force: true });

            // ============================================================
            // --- SCENARIO 4: TARGETED REFRESH (SPECIFICALLY FOR OPTIONS LIST & ARRAY) ---
            // ============================================================
            if (scenario === 4) {
                console.log(`[Preview] Scenario 4: Flushing cache & rebuilding fake data for ${targetedTables.join(', ')}...`);
                win?.webContents.send('show-overlay', { message: 'Flushing system cache...', progress: 93 });
                
                // STEP 1: Flush the Cache First (Same as Scenario 2)
                const cacheProcess = spawn(phpPath, ['artisan', 'optimize:clear'], { cwd: previewPath });
                
                cacheProcess.on('close', () => {
                    win?.webContents.send('show-overlay', { message: 'Regenerating test data for the involved tables...', progress: 96 });
                    
                    // STEP 2: Build the PHP code for Tinker (Delete old records & Create new records)
                    let tinkerCode = `\\Illuminate\\Support\\Facades\\Schema::disableForeignKeyConstraints(); `;
                    
                    targetedTables.forEach(tableName => {
                        const modelName = typeof getModelClassName === 'function' ? getModelClassName(tableName, fullSchema.database.table) : tableName;
                        
                        tinkerCode += `
                            try {
                                $model = '\\\\App\\\\Models\\\\${modelName}';
                                $model::query()->delete();
                                $model::factory()->count(20)->create();
                            } catch (\\Exception $e) {}
                        `;
                    });
                    
                    tinkerCode += ` \\Illuminate\\Support\\Facades\\Schema::enableForeignKeyConstraints();`;

                    // Run the Tinker command in the background
                    const tinkerProcess = spawn(phpPath, ['artisan', 'tinker', '--execute', tinkerCode], { cwd: previewPath });
                    
                    tinkerProcess.on('close', () => {
                        if (previewServerProcess) {
                            win?.webContents.send('show-overlay', { message: 'Interface & Data updated successfully!', progress: 100 });
                            setTimeout(() => resolve({ success: true, url: `http://127.0.0.1:${port}/admin` }), 500);
                        } else {
                            startServerAndResolve();
                        }
                    });
                });
                return; // End the process because Scenario 4 is complete!
            }
            
            // ============================================================
            // 6. --- SENARIO 2: HOT RELOAD (CLEAR CACHE) ---
            // ============================================================
            if (scenario === 2) {
                console.log(`[Preview] Scenario 2: Updating Cache...`);
                win?.webContents.send('show-overlay', { message: 'Updating Interface (Regenerating Cache)...', progress: 96 });
                
                const cacheProcess = spawn(phpPath, ['artisan', 'optimize:clear'], { cwd: previewPath });
                cacheProcess.on('close', () => {
                    if (previewServerProcess) {
                        win?.webContents.send('show-overlay', { message: 'Preview Updated!', progress: 100 });
                        setTimeout(() => resolve({ success: true, url: `http://127.0.0.1:${port}/admin` }), 500);
                    } else {
                        // If the server died during S2 (because the app just opened), we start it after the cache is flushed
                        startServerAndResolve();
                    }
                });
                return;
            }

            // ============================================================
            // 7. --- SENARIO 3: SETUP DB & START SERVER ---
            // ============================================================
            if (!fs.existsSync(dbSqlitePath)) fs.writeFileSync(dbSqlitePath, ''); 

            console.log(`[Preview] Running Migration & Seeder...`);
            let currentProgress = 90;
            win?.webContents.send('show-overlay', { message: 'Starting Database Migration...', progress: currentProgress });

            const migrateProcess = spawn(phpPath, ['artisan', 'migrate:fresh', '--seed', '--force'], { cwd: previewPath });
            let migrateLog = '';
            
            migrateProcess.stdout.on('data', (data) => { 
                migrateLog += data.toString(); 
                if (currentProgress < 95) {
                    currentProgress += 1; 
                    win?.webContents.send('show-overlay', { message: 'Building tables and test data (Seeder)...', progress: currentProgress });
                }
            });
            migrateProcess.stderr.on('data', (data) => { migrateLog += data.toString(); });
            migrateProcess.on('error', (err) => { resolve({ success: false, message: `Failed to find PHP file: ${err.message}` }); });

            migrateProcess.on('close', (code) => {
                if (code !== 0) return resolve({ success: false, message: `Failed to run database migration.\n\nTerminal Log:\n...${migrateLog.slice(-1000)}` });

                win?.webContents.send('show-overlay', { message: 'Generating Security Policy & Access Rights...', progress: 96 });

                const shieldProcess = spawn(phpPath, ['artisan', 'shield:generate', '--all', '--panel=admin', '--no-interaction'], { cwd: previewPath });
                let shieldLog = '';
                shieldProcess.stdout.on('data', (data) => { shieldLog += data.toString(); });
                shieldProcess.stderr.on('data', (data) => { shieldLog += data.toString(); });

                shieldProcess.on('close', (shieldCode) => {
                    if (shieldCode !== 0 || shieldLog.toLowerCase().includes('error') || shieldLog.toLowerCase().includes('exception')) {
                        return resolve({ success: false, message: `Failed to generate Shield Policy!\n\nError Reason:\n${shieldLog.trim()}` });
                    }
                    startServerAndResolve();
                }); 
            }); 

        } catch (error) {
            console.error('Instant Preview Error:', error);
            resolve({ success: false, message: error.message });
        }
    });
});

// Make sure the server is killed when the app closes
if (typeof ctx.onQuit === 'function') ctx.onQuit(() => {
    if (previewServerProcess) {
        previewServerProcess.kill();
    }
});

// Added this to kill the preview server at the root!
ipcMain.on('stop-preview-server', () => {
    if (typeof previewServerProcess !== 'undefined' && previewServerProcess !== null) {
        
        // Check if the user's OS is Windows
        if (process.platform === 'win32') {
            const { spawn } = require('child_process');
            // /pid = Process ID, /f = Force kill, /t = Kill whole tree (Induk & Anak)
            spawn('taskkill', ['/pid', previewServerProcess.pid, '/f', '/t']);
        } else {
            // For Mac/Linux users, a plain .kill() is enough to kill the tree
            previewServerProcess.kill(); 
        }

        previewServerProcess = null;
        console.log('[Preview] PHP server and its children have been fully terminated.');
    }
});

// =================================================================
// ▼▼▼ VALIDATION HANDLERS (BETTER-SQLITE3 COMPATIBLE) ▼▼▼
// =================================================================

// Load validations for a specific column
ipcMain.handle('get-field-validations', (event, columnId) => {
    try {
        // Use .all() for better-sqlite3
        return db.prepare("SELECT * FROM field_validations WHERE column_id = ?").all(columnId);
    } catch (error) {
        console.error("Failed to get validations:", error);
        return [];
    }
});

// Save validations (Delete old, insert new for bulk update)
ipcMain.handle('save-field-validations', (event, { columnId, validations }) => {
    try {
        // Use a Transaction for better-sqlite3 (faster & safer)
        const saveTransaction = db.transaction(() => {
            // 1. Delete old records
            db.prepare("DELETE FROM field_validations WHERE column_id = ?").run(columnId);

            // 2. Insert new records if any
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
        console.error("Failed to save validations:", error);
        return { success: false, message: error.message };
    }
});

// ==========================================
// IPC: PENGURUSAN WIDGET DASHBOARD
// ==========================================

// 1. Save or Update Widget
ipcMain.handle('widget:save', (event, data) => {
    try {
        let savedData;
        
        if (data.id) {
            // Update - Add 5 new fields
            const stmt = db.prepare(`
                UPDATE project_widgets 
                SET title = ?, widget_type = ?, target_table = ?, aggregate_type = ?, target_field = ?, width_span = ?, color = ?, icon = ?,
    chart_label_column = ?, filter_field = ?, filter_operator = ?, filter_value = ?, timeframe_range = ?, advanced_query = ?
WHERE id = ? AND project_id = ?
            `);
            stmt.run(
                data.chart_label_column, data.filter_field, data.filter_operator, data.filter_value, data.timeframe_range, data.advanced_query,
data.id, data.project_id
            );
            
            savedData = { ...data, id: parseInt(data.id) };
        } else {
            // Create New (Insert) - Add 5 new fields
            const orderStmt = db.prepare(`SELECT MAX(sort_order) as max_order FROM project_widgets WHERE project_id = ?`);
            const orderResult = orderStmt.get(data.project_id);
            const nextOrder = (orderResult && orderResult.max_order !== null) ? orderResult.max_order + 1 : 1;

            const stmt = db.prepare(`
                INSERT INTO project_widgets (
                    project_id, title, widget_type, target_table, aggregate_type, target_field, width_span, color, icon, sort_order,
                    chart_label_column, filter_field, filter_operator, filter_value, timeframe_range, advanced_query
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const info = stmt.run(
                data.project_id, data.title, data.widget_type, data.target_table, data.aggregate_type, data.target_field, data.width_span, data.color, data.icon, nextOrder,
                data.chart_label_column, data.filter_field, data.filter_operator, data.filter_value, data.timeframe_range, data.advanced_query
            );
            
            savedData = { ...data, id: info.lastInsertRowid, sort_order: nextOrder };
        }
        
        return { success: true, data: savedData };
    } catch (error) {
        console.error('widget:save error:', error);
        return { success: false, message: error.message };
    }
});

// 2. Delete Widget
ipcMain.handle('widget:delete', (event, id) => {
    try {
        const stmt = db.prepare("DELETE FROM project_widgets WHERE id = ?");
        stmt.run(id);
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

async function getFullProjectSchema(projectId) {
  try {
    const project = db
      .prepare("SELECT * FROM projects WHERE project_id = ?")
      .get(projectId);
    if (!project)
      throw new Error(`Project with ID ${projectId} not found.`);

    // Child relation layout: expose the live global child layout defaults so
    // the RelationManager generator can resolve per-relation inheritance
    // without a separate IPC round-trip.
    project.fixzy_global_child_layout = getGlobalChildLayoutDefaults();

    // ▼▼▼ NEW ADDITION: Fetch Dashboard Widgets Data ▼▼▼
    const widgets = db
      .prepare("SELECT * FROM project_widgets WHERE project_id = ? ORDER BY sort_order ASC")
      .all(projectId);
    // ▲▲▲ END OF ADDITION ▲▲▲

    const tables = db
      .prepare("SELECT * FROM tables WHERE project_id = ? ORDER BY table_order, table_id")
      .all(projectId);
    const tableIds = tables.map((t) => t.table_id);

    if (tableIds.length === 0) {
        return {
            project,
            // Update: Insert widgets even if the table doesn't exist yet
            database: { name: project.app_title, table: {}, relationships: [], unified_menu: [], widgets: widgets },
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

    // Field Validations (From Test)
    const validations = db.prepare(`
        SELECT fv.*, f.table_id, f.field_name 
        FROM field_validations fv
        JOIN fields f ON fv.column_id = f.field_id
        WHERE f.table_id IN (${placeholder}) AND fv.is_active = 1
    `).all(...tableIds);

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
        field.validations = validations.filter(v => v.column_id === field.field_id);
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
    
    // Unified Menu Logic
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
        // ▼▼▼ NEW ADDITION: Insert widgets into the final JSON payload ▼▼▼
        widgets: widgets,
        // ▲▲▲ END OF ADDITION ▲▲▲
      },
    };
  } catch (error) {
    console.error("Failed to fetch full schema:", error);
    return null;
  }
}

/**
 * Handles the pre-import check: warns the user and deletes old tables if needed.
 * @param {BrowserWindow} win - The app's main window to attach ctx.dialog to.
 * @param {number} projectId - The current project ID.
 * @param {string} sqlContent - The full content of the SQL script to be imported.
 * @returns {Promise<boolean>} - Returns 'true' if the import can proceed, 'false' if cancelled.
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

  // ▼▼▼ START CHANGE: Replace the native dialog with a custom modal system ▼▼▼
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
  // ▲▲▲ END CHANGES ▲▲▲

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
    console.error("Failed to delete old schema:", error);
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
            // Replace snake_case (e.g. school_bus) and kebab-case (e.g. school-bus) with spaces
            .replace(/[_-]/g, ' ')
            // Insert spaces for camelCase (e.g. schoolBus -> school Bus)
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            // Capitalize the first letter of every word
            .replace(/\b\w/g, char => char.toUpperCase());
    };
    
    const getConstraintName = (rule) => {
        let name = rule.index || rule.constraint;
        if (name && typeof name === 'object') {
            name = name.value;
        }
        return (name || '').trim() || null;
    };

    // ▼▼▼ DATA TYPE TRANSLATION / NORMALIZATION MAP ▼▼▼
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
    // ▲▲▲ END TRANSLATION MAP ▲▲▲
	
    let tableOrder = 0;

    const transaction = db.transaction((ast) => {
        const insertConstraintStmt = db.prepare('INSERT INTO table_constraints (table_id, constraint_name, constraint_type, columns) VALUES (?, ?, ?, ?)');
        const getMaxMenuOrderStmt = db.prepare('SELECT MAX(item_order) as max_order FROM menu_items WHERE project_id = ? AND menu_group_id IS NULL');
        const insertMenuItemStmt = db.prepare('INSERT INTO menu_items (project_id, table_id, item_label, item_detail, item_order, menu_group_id) VALUES (?, ?, ?, ?, ?, NULL)');
        // Inside the importSchema function
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
                    
                    // ▼▼▼ START DATA TYPE NORMALIZATION LOGIC ▼▼▼
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
                    // ▲▲▲ END NORMALIZATION LOGIC ▲▲▲
                    
                    const fieldData = {
                        table_id: tableId,
                        field_name: fieldName,
                        caption: caption,
                        field_order: index,
                        data_type: normalizedDataType,
                        length: definition.definition.length || null,
                        precision: definition.definition.scale || null,
                        required: 0, auto_increment: 0, unsigned: 0, zero_fill: 0, primary_key: 0, "unique": 0,
                        not_null: 0, // <--- ADD THIS
                        is_indexed: 0, read_only: 0, default_value: null,
                    };
                    
                    if (definition.auto_increment || definition.autoincrement || isSerial) fieldData.auto_increment = 1;
                    const isNotNull = 
                        (definition.nullable?.type && definition.nullable.type.toLowerCase() === "not null") || 
                        (definition.nullable?.value && definition.nullable.value.toLowerCase() === "not null") ||
                        (Array.isArray(definition.nullable) && definition.nullable.includes("not null"));

                    if (isNotNull) {
                        fieldData.not_null = 1;
                        // If not auto_increment, we treat it as required (must be filled in the form)
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
                                fieldData.not_null = 1; // <--- Add this
                            }
                    });
                    
// Set hide_in_tv = 1, hide_in_dv = 1, and read_only = 1 by default for system fields
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

            // ... (rest of the code below unchanged) ...
            
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
                        // Extract ON DELETE and ON UPDATE from the AST
                        let onDelete = 'NO ACTION';
                        let onUpdate = 'NO ACTION';

                if (ref.on_action) {
                            ref.on_action.forEach(action => {
                                const type = action.type.toLowerCase();
                                
                                // FIX: Check the data type of 'value' before using .toUpperCase()
                                let valStr = 'NO ACTION';
                                if (typeof action.value === 'string') {
                                    valStr = action.value;
                                } else if (action.value && typeof action.value === 'object' && action.value.value) {
                                    // Sometimes the parser wraps it in an object { type: 'origin', value: 'CASCADE' }
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
                            onDelete: onDelete, // Save this data
                            onUpdate: onUpdate  // Save this data
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
        
        // Add hide_in_tv and hide_in_dv to the SQL statement
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
            finalMessage += "\n\nAdditionally, the following fields were automatically added for standardization purposes required by Fixzy SysMaker:" + 
                            Object.entries(standardizationLog).map(([tbl, flds]) => `\n- ${tbl}: ${flds.join(', ')}`).join('');
        }
        return { success: true, message: finalMessage };
    } catch (error) {
        console.error("SQL PARSING FAILED! The script may contain syntax incompatible with the parser for the selected dialect.");
        console.error("Full parser error:", error);
        return { success: false, message: `SQL Parsing Error: ${error.message}. Please check the console for more details.` };
    }
}
function getGeneratedFolderPath() {
  // This path will differ for each user and OS, e.g.:
  // Windows: C:\Users\YourName\AppData\Roaming\fixzy-sysmaker
  const userDataPath = ctx.getPath('userData');
  
  const generatedPath = path.join(userDataPath, 'generated');

  // Make sure this folder exists. If not, create it.
  if (!fs.existsSync(generatedPath)) {
    fs.mkdirSync(generatedPath, { recursive: true });
  }

  return generatedPath;
}
async function runComposerInstall(projectPath) {
  return new Promise((resolve, reject) => {
    // Determine the path to PHP and Composer based on the app mode
    const isPackaged = ctx.isPackaged;
    const baseBinPath = isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin')
      : path.join(__dirname, '../../bin'); // Exit from src/main

    const phpPath = require('../core/phpResolver').resolvePhpBinary(baseBinPath);
    const composerPath = path.join(baseBinPath, 'composer.phar');

    console.log(`Running composer in: ${projectPath}`);
    console.log(`Using PHP: ${phpPath}`);

    // Use spawn for better control
    const composerProcess = spawn(phpPath, [composerPath, 'install'], {
      cwd: projectPath, // Set the working directory to the generated project folder
      stdio: 'pipe' // Tangkap output
    });

    // Listen to the output for display (e.g., in the console or send to the UI)
    composerProcess.stdout.on('data', (data) => {
      console.log(`Composer: ${data.toString()}`);
      // Here you can send progress to the UI window
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

// =================================================================
// SETUP WIZARD (GUI-first installation)
// =================================================================
// setup:check  -> fast environment probe (no side effects)
// setup:run    -> provisions PHP/composer/preview_env, streams log lines
//                via window.webContents.send('setup-log', line)
ipcMain.handle('setup:check', async () => {
    try {
        const { checkSetup } = require('../core/setupRunner');
        const status = checkSetup();
        // Renderer needs the OS to show the right install instructions
        // (contextIsolation hides process.platform from the UI).
        status.platform = process.platform;
        return status;
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('setup:run', async (event) => {
    const { runSetup } = require('../core/setupRunner');
    const win = ctx.getWindow ? ctx.getWindow(event) : null;
    const onLog = (line) => {
        const text = String(line).replace(/\s+$/, '');
        if (!text) return;
        console.log('[setup] ' + text);
        if (win && win.webContents && !win.webContents.isDestroyed()) {
            win.webContents.send('setup-log', text);
        }
    };
    try {
        const result = await runSetup({ onLog });
        return { success: result.ok, failed: result.failed };
    } catch (e) {
        onLog('ERROR: ' + e.message);
        return { success: false, failed: ['exception'] };
    }
});
};
