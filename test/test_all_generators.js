// test/test_all_generators.js
const path = require('path');
const fs = require('fs');
const { connectToDatabase, getFullProjectSchema } = require('./testUtils');

// =================================================================
// 1. IMPORT SEMUA GENERATORS
// =================================================================

// Admin Panel
const { generateAdminPanelProvider } = require('../src/generators/laravelAdminPanelGenerator');

// Database & Models
const { 
    generateFilamentModels, 
    generateFilamentUserModel, 
    generateLaravelMigrations, 
    generateLaravelFactories, 
    generateLaravelDatabaseSeeder 
} = require('../src/generators/laravelDatabaseGenerator');

// Resources (Pages & Managers)
const { 
    generateFilamentListPages, 
    generateFilamentCreatePages, 
    generateFilamentEditPages, 
    generateFilamentResources, 
    generateFilamentRelationManagers 
} = require('../src/generators/laravelResourcesGenerator');

// Tables & Schemas
const { generateFilamentTablesTable } = require('../src/generators/laravelTablesGenerator');
const { generateFilamentSchemasForm } = require('../src/generators/laravelSchemasGenerator');

// Import & Export
const { generateFilamentExports } = require('../src/generators/laravelExportsGenerator');
const { generateFilamentImporters } = require('../src/generators/laravelImportersGenerator');

// Documentation (Nyah-komen jika fail ini wujud)
// const { generateDeploymentGuidePage } = require('../src/generators/laravelDocsGenerator'); 

// =================================================================
// 2. KONFIGURASI
// =================================================================
const TEST_OUTPUT_DIR = path.join(__dirname, 'output_full_app');

// Bersihkan folder output lama
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
        // A. Dapatkan Data Projek
        const activeProject = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
        if (!activeProject) throw new Error("Tiada projek aktif dijumpai.");
        
        console.log(`📂 Projek: ${activeProject.app_title} (ID: ${activeProject.project_id})`);
        
        const fullSchema = await getFullProjectSchema(db, activeProject.project_id);
        console.log(`📊 Schema dimuatkan: ${Object.keys(fullSchema.database.table).length} jadual.`);

        // B. Senarai Tugasan Generator
        const tasks = [
            // 1. Database Layer
            { name: 'Migrations', func: generateLaravelMigrations },
            { name: 'Models', func: generateFilamentModels },
            { name: 'User Model', func: generateFilamentUserModel },
            { name: 'Factories', func: generateLaravelFactories },
            { name: 'Seeders', func: generateLaravelDatabaseSeeder },

            // 2. Filament Core
            { name: 'Admin Panel Provider', func: generateAdminPanelProvider },
            { name: 'Resources (Main Class)', func: generateFilamentResources },
            
            // 3. Resources Components
            { name: 'Tables (Table Class)', func: generateFilamentTablesTable },
            { name: 'Forms (Schema Class)', func: generateFilamentSchemasForm },
            { name: 'List Pages', func: generateFilamentListPages },
            { name: 'Create Pages', func: generateFilamentCreatePages },
            { name: 'Edit Pages', func: generateFilamentEditPages },
            { name: 'Relation Managers', func: generateFilamentRelationManagers },

            // 4. Features
            { name: 'Exports', func: generateFilamentExports },
            { name: 'Importers', func: generateFilamentImporters },
            
            // 5. Docs (Nyah-komen jika perlu)
            // { name: 'Deployment Guide', func: generateDeploymentGuidePage },
        ];

        // C. Jalankan Loop
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