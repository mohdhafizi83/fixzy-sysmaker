// test/test_all_generators.js
const path = require('path');
const fs = require('fs');
const { connectToDatabase, getFullProjectSchema } = require('./testUtils');

// =================================================================
// 1. IMPORT SEMUA GENERATORS (MODULAR & CLEAN)
// =================================================================

// A. Admin & Database
const { generateAdminPanelProvider } = require('../src/generators/laravelAdminPanelGenerator');
const { 
    generateFilamentModels, 
    generateFilamentUserModel, 
    generateLaravelMigrations, 
    generateLaravelFactories, 
    generateLaravelDatabaseSeeder 
} = require('../src/generators/laravelDatabaseGenerator');

// B. Filament Resources (Standard & Custom Modules)
// Resource Shell (Induk)
const { 
    generateFilamentResources, 
    generateFilamentResourcesCustomModules // Fasa 3.1
} = require('../src/generators/laravelResourceGenerator');

// Components: Tables
const { 
    generateFilamentTablesTable, 
    generateFilamentTablesCustomModules // Fasa 3.2 (Added above)
} = require('../src/generators/laravelTablesGenerator');

// Components: Schemas (Forms)
const { 
    generateFilamentSchemasForm, 
    generateFilamentSchemasCustomModules // Fasa 3.3 (Added above)
} = require('../src/generators/laravelSchemasGenerator');

// Components: Pages (List, Create, Edit)
const { 
    generateFilamentListPages, 
    generateFilamentListCustomModules // Fasa 3.5
} = require('../src/generators/laravelListGenerator');

const { 
    generateFilamentCreatePages, 
    generateFilamentCreateCustomModules // Fasa 3.6
} = require('../src/generators/laravelCreateGenerator');

const { 
    generateFilamentEditPages, 
    generateFilamentEditCustomModules // Fasa 3.7
} = require('../src/generators/laravelEditGenerator');

// Components: Relation Managers
const { generateFilamentRelationManagers } = require('../src/generators/laravelRelationManagersGenerator');

// C. Features (Export/Import)
const { generateFilamentExports } = require('../src/generators/laravelExportsGenerator');
const { generateFilamentImporters } = require('../src/generators/laravelImportersGenerator');


// =================================================================
// 2. KONFIGURASI OUTPUT
// =================================================================
const TEST_OUTPUT_DIR = path.join(__dirname, 'output_full_app');

if (fs.existsSync(TEST_OUTPUT_DIR)) {
    console.log("🧹 Membersihkan folder output lama...");
    fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });


// =================================================================
// 3. FUNGSI UJIAN UTAMA
// =================================================================
async function runFullTest() {
    console.log("🚀 MULA: Menjana Keseluruhan Aplikasi Filament (Test Mode)");
    console.time("⏱️ Tempoh Masa");

    const db = connectToDatabase();
    if (!db) return;

    try {
        const activeProject = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
        if (!activeProject) throw new Error("Tiada projek aktif dijumpai.");
        
        console.log(`📂 Projek: ${activeProject.app_title} (ID: ${activeProject.project_id})`);
        
        const fullSchema = await getFullProjectSchema(db, activeProject.project_id);
        console.log(`📊 Schema dimuatkan: ${Object.keys(fullSchema.database.table).length} jadual.`);

        // ▼▼▼ DEBUG: DUMP FULL SCHEMA KE FAIL ▼▼▼
        const debugFilePath = path.join(__dirname, 'debug_schema_output.json');
        console.log(`\n🔍 [DEBUG] Menyimpan fullSchema ke fail untuk semakan:`);
        console.log(`   📂 ${debugFilePath}`);
        
        // Simpan sebagai JSON yang cantik (indented)
        fs.writeFileSync(debugFilePath, JSON.stringify(fullSchema, null, 4));
        
        // Cetak ringkasan ringkas di console untuk pengesahan pantas
        if (fullSchema.database.unified_menu) {
            console.log(`   ✅ Unified Menu: Ditemui (${fullSchema.database.unified_menu.length} item peringkat atasan)`);
            // Paparkan sampel item pertama untuk memastikan struktur 'type' wujud
            if (fullSchema.database.unified_menu.length > 0) {
                 console.log("   👉 Sampel Menu Item Pertama:", fullSchema.database.unified_menu[0]);
            }
        } else {
            console.error("   ❌ Unified Menu: TIDAK DITEMUI!");
        }
        
        // Semak sepintas lalu jika validation wujud
        let validationCount = 0;
        Object.values(fullSchema.database.table).forEach(t => {
            Object.values(t.fields).forEach(f => {
                if (f.validations && f.validations.length > 0) validationCount++;
            });
        });
        console.log(`   ✅ Validations: Ditemui pada ${validationCount} medan.`);
        console.log("--------------------------------------------------\n");
        // ▲▲▲ TAMAT DEBUG ▲▲▲
        // ============================================================
        // SENARAI TUGASAN (URUTAN PELAKSANAAN)
        // ============================================================
        const tasks = [
            // 1. Database Layer
            { name: 'Migrations', func: generateLaravelMigrations },
            { name: 'Models', func: generateFilamentModels },
            { name: 'User Model', func: generateFilamentUserModel },
            { name: 'Factories', func: generateLaravelFactories },
            { name: 'Seeders', func: generateLaravelDatabaseSeeder },

            // 2. Filament Core
            { name: 'Admin Panel Provider', func: generateAdminPanelProvider },
            
            // 3. Resources STANDARD (Original CRUD)
            { name: 'Standard: Tables', func: generateFilamentTablesTable },     // Tables dahulu
            { name: 'Standard: Forms', func: generateFilamentSchemasForm },      // Forms dahulu
            { name: 'Standard: List Pages', func: generateFilamentListPages },
            { name: 'Standard: Create Pages', func: generateFilamentCreatePages },
            { name: 'Standard: Edit Pages', func: generateFilamentEditPages },
            { name: 'Standard: Relation Managers', func: generateFilamentRelationManagers },
            { name: 'Standard: Resources (Main)', func: generateFilamentResources }, // Akhir sekali sebab ia 'link' semua

            // 4. Custom Modules (FASA 3)
            // Nota: Custom Modules menggunakan semula Relation Manager standard, jadi tiada generator khas untuk itu.
            { name: 'Custom Modules: Tables', func: generateFilamentTablesCustomModules },
            { name: 'Custom Modules: Forms', func: generateFilamentSchemasCustomModules },
            { name: 'Custom Modules: List Pages', func: generateFilamentListCustomModules },
            { name: 'Custom Modules: Create Pages', func: generateFilamentCreateCustomModules },
            { name: 'Custom Modules: Edit Pages', func: generateFilamentEditCustomModules },
            { name: 'Custom Modules: Resources (Main)', func: generateFilamentResourcesCustomModules },

            // 5. Features
            { name: 'Exports', func: generateFilamentExports },
            { name: 'Importers', func: generateFilamentImporters },
        ];

        console.log("\n--- 🛠️ MULA MENJANA KOD ---");
        let successCount = 0;
        let failCount = 0;

        for (const task of tasks) {
            process.stdout.write(`⏳ Menjana ${task.name}... `);
            try {
                // Panggil fungsi generator
                const result = await task.func(fullSchema, TEST_OUTPUT_DIR);
                
                if (result && result.success) {
                    console.log("✅ OK");
                    successCount++;
                } else {
                    console.log("❌ GAGAL");
                    console.error(`   -> Ralat: ${result ? result.message : 'Unknown error'}`);
                    failCount++;
                }
            } catch (err) {
                console.log("🔥 EXCEPTION");
                console.error(`   -> ${err.message}`);
                failCount++;
            }
        }

        // D. Rumusan
        console.log("\n--- 🏁 LAPORAN AKHIR ---");
        console.log(`Jumlah Modul: ${tasks.length}`);
        console.log(`Berjaya: ${successCount}`);
        console.log(`Gagal:   ${failCount}`);
        console.log(`Folder Output: ${TEST_OUTPUT_DIR}`);
        console.timeEnd("⏱️ Tempoh Masa");

        if (failCount === 0) {
            console.log("\n✨ UJIAN LULUS SEPENUHNYA ✨");
        } else {
            console.log("\n⚠️  UJIAN TAMAT DENGAN AMARAN");
        }

    } catch (error) {
        console.error("\n❌ RALAT KRITIKAL:", error);
    } finally {
        if (db && db.open) db.close();
    }
}

runFullTest();