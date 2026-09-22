// test/testUtils.js
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function connectToDatabase() {
    // 1. Tentukan Path Database
    // Make sure this path is correct for your PC
    const appDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
    const dbPath = path.join(appDataPath, 'Fixzy SysMaker', 'Fixzy SysMaker.db'); // <--- PASTIKAN FOLDER INI BETUL

    console.log(`🔌 Mencuba sambungan ke: ${dbPath}`);
    
    // 2. Semak Kewujudan Fail Secara Manual
    if (!fs.existsSync(dbPath)) {
        console.error("❌ RALAT KRITIKAL: Fail database TIDAK WUJUD di laluan tersebut!");
        console.error("   Check your AppData folder or change the path in testUtils.js");
        return null;
    }

    try {
        // 3. Sambung dengan option fileMustExist
        const db = new Database(dbPath, { fileMustExist: true }); 
        db.pragma('journal_mode = WAL');
        console.log("✅ Sambungan Database Berjaya.");
        return db;
    } catch (error) {
        console.error("❌ Gagal membuka database:", error.message);
        return null;
    }
}

// test/testUtils.js

function getFullProjectSchema(db, projectId) {
    try {
        console.log(`🔍 Fetching schema for Project ID: ${projectId}...`);

        const project = db.prepare("SELECT * FROM projects WHERE project_id = ?").get(projectId);
        if (!project) {
            console.error("❌ Project not found in the DB.");
            return null;
        }

        const tables = db.prepare("SELECT * FROM tables WHERE project_id = ? ORDER BY table_order, table_id").all(projectId);
        console.log(`📊 Found ${tables.length} tables in the database.`);
        
        if (tables.length === 0) {
            console.warn("⚠️ WARNING: This project has no tables. Nothing to generate.");
            return {
                project,
                database: { name: project.app_title, table: {}, relationships: [], unified_menu: [] },
            };
        }

        const tableIds = tables.map((t) => t.table_id);
        const placeholder = tableIds.map(() => "?").join(",");
        
        const fields = db.prepare(`SELECT * FROM fields WHERE table_id IN (${placeholder}) ORDER BY field_order, field_id`).all(...tableIds);
        console.log(`📝 Found ${fields.length} fields overall.`);

        const constraints = db.prepare(`SELECT * FROM table_constraints WHERE table_id IN (${placeholder})`).all(...tableIds);
        
        // Custom Modules
        let customViews = db.prepare(`SELECT * FROM custom_modules WHERE table_id IN (${placeholder}) ORDER BY module_order`).all(...tableIds);
        const viewIds = customViews.map(v => v.module_id);
        let customViewFields = [];
        if (viewIds.length > 0) {
            const viewPlaceholder = viewIds.map(() => "?").join(",");
            customViewFields = db.prepare(`SELECT * FROM custom_module_fields WHERE module_id IN (${viewPlaceholder}) ORDER BY display_order`).all(...viewIds);
        }
  
        // Validation Rules (existing correct logic - preserved)
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
  
        let relationships = db.prepare(
            `SELECT r.*, p.table_name as parent_table_name, c.table_name as child_table_name
             FROM parent_child_relationships r
             JOIN tables p ON r.parent_table_id = p.table_id
             JOIN tables c ON r.child_table_id = c.table_id
             WHERE r.parent_table_id IN (${placeholder}) OR r.child_table_id IN (${placeholder})`
          ).all(...tableIds, ...tableIds);
      
        // ▼▼▼ KEMAS KINI MENU: Menggunakan logik dari Production Main.js ▼▼▼
        const allItems = db.prepare(`
            SELECT mi.*, t.table_name 
            FROM menu_items mi 
            LEFT JOIN tables t ON mi.table_id = t.table_id 
            WHERE mi.project_id = ? 
            ORDER BY mi.item_order
        `).all(projectId);
        
        const groups = db.prepare("SELECT * FROM menu_groups WHERE project_id = ? ORDER BY group_order").all(projectId);
        const unifiedMenu = [];

        // Process groups
        groups.forEach(group => {
            const groupItems = allItems
                .filter(item => item.menu_group_id === group.menu_group_id)
                .map(item => {
                    // More precise item type determination logic
                    let itemType = 'custom_item';
                    if (item.table_id) itemType = 'table_item';
                    else if (item.module_id) itemType = 'custom_view_item';
                    
                    return { type: itemType, ...item };
                });

            unifiedMenu.push({ 
                type: 'group', 
                id: group.menu_group_id, 
                order: group.group_order, 
                name: group.group_name, 
                items: groupItems
            });
        });
        
        // Proses item peringkat atasan (loose items)
        allItems.forEach(item => {
            if (item.menu_group_id === null) {
                let itemType = 'custom_item';
                if (item.table_id) itemType = 'table_item';
                else if (item.module_id) itemType = 'custom_view_item';

                unifiedMenu.push({ 
                    type: itemType, 
                    order: item.item_order,
                    ...item 
                });
            }
        });

        // Re-sort the entire list by 'order' (IMPORTANT!)
        unifiedMenu.sort((a, b) => a.order - b.order);
        // ▲▲▲ TAMAT KEMAS KINI MENU ▲▲▲
  
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
        console.error("❌ Ralat logik getFullProjectSchema:", error.message);
        return null;
    }
}

module.exports = { connectToDatabase, getFullProjectSchema };