// test/testUtils.js
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function connectToDatabase() {
    // 1. Tentukan Path Database
    // Sila pastikan path ini betul mengikut PC anda
    const appDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");
    const dbPath = path.join(appDataPath, 'FiziSysMaker', 'FiziSysMaker.db'); // <--- PASTIKAN FOLDER INI BETUL

    console.log(`🔌 Mencuba sambungan ke: ${dbPath}`);
    
    // 2. Semak Kewujudan Fail Secara Manual
    if (!fs.existsSync(dbPath)) {
        console.error("❌ RALAT KRITIKAL: Fail database TIDAK WUJUD di laluan tersebut!");
        console.error("   Sila semak folder AppData anda atau ubah path dalam testUtils.js");
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

function getFullProjectSchema(db, projectId) {
    try {
        console.log(`🔍 Mengambil schema untuk Project ID: ${projectId}...`);

        const project = db.prepare("SELECT * FROM projects WHERE project_id = ?").get(projectId);
        if (!project) {
            console.error("❌ Projek tidak dijumpai dalam DB.");
            return null;
        }

        // Debug Tables
        const tables = db.prepare("SELECT * FROM tables WHERE project_id = ? ORDER BY table_order, table_id").all(projectId);
        console.log(`📊 Jumpa ${tables.length} jadual dalam database.`);
        
        if (tables.length === 0) {
            console.warn("⚠️ AMARAN: Projek ini tiada jadual. Tiada apa untuk dijana.");
            return {
                project,
                database: { name: project.app_title, table: {}, relationships: [], unified_menu: [] },
            };
        }

        const tableIds = tables.map((t) => t.table_id);
        const placeholder = tableIds.map(() => "?").join(",");
        
        // Debug Fields
        const fields = db.prepare(`SELECT * FROM fields WHERE table_id IN (${placeholder}) ORDER BY field_order, field_id`).all(...tableIds);
        console.log(`📝 Jumpa ${fields.length} medan (fields) secara keseluruhan.`);

        const constraints = db.prepare(`SELECT * FROM table_constraints WHERE table_id IN (${placeholder})`).all(...tableIds);
        
        // Custom Views
        let customViews = db.prepare(`SELECT * FROM custom_views WHERE table_id IN (${placeholder}) ORDER BY view_order`).all(...tableIds);
        const viewIds = customViews.map(v => v.custom_view_id);
        let customViewFields = [];
        if (viewIds.length > 0) {
            const viewPlaceholder = viewIds.map(() => "?").join(",");
            customViewFields = db.prepare(`SELECT * FROM custom_view_fields WHERE custom_view_id IN (${viewPlaceholder}) ORDER BY display_order`).all(...viewIds);
        }
  
        // Validation Rules
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
      
        const allItems = db.prepare(`
            SELECT mi.*, t.table_name 
            FROM menu_items mi 
            LEFT JOIN tables t ON mi.table_id = t.table_id 
            WHERE mi.project_id = ? 
            ORDER BY mi.item_order
        `).all(projectId);
        
        const groups = db.prepare("SELECT * FROM menu_groups WHERE project_id = ? ORDER BY group_order").all(projectId);
        const unifiedMenu = [];
  
        groups.forEach(group => {
            const groupItems = allItems
                .filter(item => item.menu_group_id === group.menu_group_id)
                .map(item => ({ type: item.table_id ? 'table_item' : 'custom_item', ...item }));
  
            unifiedMenu.push({ 
                type: 'group', id: group.menu_group_id, name: group.group_name, items: groupItems
            });
        });
        
        allItems.forEach(item => {
            if (item.menu_group_id === null) {
                unifiedMenu.push({ 
                    type: item.table_id ? 'table_item' : 'custom_item', 
                    ...item 
                });
            }
        });
  
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