// test/test_importers.js
const path = require('path');
const fs = require('fs');

// Import
const { generateFilamentImporters } = require('../src/generators/laravelImportersGenerator');
const { connectToDatabase, getFullProjectSchema } = require('./testUtils');

// Output
const testOutputDir = path.join(__dirname, 'output_importers_real');
if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
}
fs.mkdirSync(testOutputDir, { recursive: true });

async function runTest() {
    console.log("--- DEBUGGER UJIAN IMPORTER ---");
    
    // 1. Sambung DB
    const db = connectToDatabase();
    if (!db) return; // Berhenti jika DB gagal dibuka

    try {
        // 2. Cari Projek Aktif
        const activeProject = db.prepare("SELECT * FROM projects WHERE is_active = 1 LIMIT 1").get();
        if (!activeProject) {
            console.error("❌ Tiada projek aktif (is_active = 1) dijumpai dalam DB.");
            return;
        }
        console.log(`✅ Projek Aktif: ${activeProject.app_title} [ID: ${activeProject.project_id}]`);

        // 3. Dapatkan Schema
        const fullSchema = getFullProjectSchema(db, activeProject.project_id);
        if (!fullSchema) return;

        // 4. SEMAKAN KRITIKAL: Adakah table wujud dalam objek schema?
        const tableCount = Object.keys(fullSchema.database.table).length;
        console.log(`📊 Schema Table Count: ${tableCount}`);
        
        if (tableCount === 0) {
            console.error("❌ RALAT: Objek 'fullSchema.database.table' kosong.");
            console.error("   Punca: Projek wujud tetapi tiada jadual yang berkaitan dengan ID projek ini.");
            return;
        }

        // Senaraikan nama table untuk kepastian
        console.log("📋 Senarai Jadual:", Object.keys(fullSchema.database.table).join(", "));

        // 5. Panggil Generator
        console.log("\n🚀 Memanggil Generator...");
        const result = await generateFilamentImporters(fullSchema, testOutputDir);

        if (result.success) {
            console.log("\n✅ STATUS: SUCCESS");
            
            const importsDir = path.join(testOutputDir, 'app', 'Filament', 'Imports');
            if (fs.existsSync(importsDir)) {
                const files = fs.readdirSync(importsDir);
                console.log(`📂 Fail Dijana: ${files.length}`);
                
                if (files.length === 0) {
                    console.error("⚠️  Folder wujud tapi tiada fail. Ini pelik kerana tableCount > 0.");
                    console.error("   Sila semak 'Importer.template' path dalam generator.");
                } else {
                    files.forEach(f => console.log(`   - ${f}`));
                }
            } else {
                console.error("❌ Folder 'app/Filament/Imports' tidak dicipta oleh generator.");
            }
        } else {
            console.error("\n❌ STATUS: FAILED");
            console.error("   Mesej Ralat Generator:", result.message);
            
            if (result.message.includes('Template Importer missing')) {
                console.error("   💡 TIP: Sila semak fail 'src/templates/php/filament/app/Filament/Imports/Importer.template' wujud.");
            }
        }

    } catch (error) {
        console.error("\n❌ RALAT SYSTEM:", error);
    } finally {
        if (db && db.open) db.close();
    }
}

runTest();