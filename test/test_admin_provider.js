const path = require('path');
const fs = require('fs');

// 1. IMPORT FUNGSI GENERATOR
// Nota: Kita guna '../src' sebab fail ini kini berada dalam folder 'test'
const { generateAdminPanelProvider } = require('../src/generators/laravelAdminPanelGenerator');

// 2. MOCK DATA (Data Tipu untuk Ujian)
const mockFullSchema = {
    project: {
        app_title: 'Test App',
        module_log_audit: 1,       // 1 = Aktif, 0 = Tutup
        module_authorization: 1,   // 1 = Aktif (Shield), 0 = Tutup
        menu_orientation: 'top'    // 'top' atau 'side'
    },
    menu_groups: [
        { group_name: 'System Settings', group_order: 2 },
        { group_name: 'User Management', group_order: 1 },
        { group_name: 'Reports', group_order: 3 }
    ]
};

// 3. TENTUKAN FOLDER OUTPUT
// Kita letak output dalam folder 'test/output' supaya tidak bersepah
const testOutputDir = path.join(__dirname, 'output');

// Bersihkan folder output lama
if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
}
fs.mkdirSync(testOutputDir, { recursive: true });

// 4. JALANKAN UJIAN
async function runTest() {
    console.log("--- MULA UJIAN ADMIN PANEL ---");
    console.log("Lokasi Script:", __dirname);
    console.log("Input Data:", JSON.stringify(mockFullSchema, null, 2));

    try {
        const result = await generateAdminPanelProvider(mockFullSchema, testOutputDir);

        if (result.success) {
            console.log("\n✅ BERJAYA!");
            
            // Lokasi fail yang dijana
            const generatedFilePath = path.join(testOutputDir, 'app', 'Providers', 'Filament', 'AdminPanelProvider.php');
            
            if (fs.existsSync(generatedFilePath)) {
                const content = fs.readFileSync(generatedFilePath, 'utf8');
                console.log(`\n📄 Lokasi Fail Dijana: ${generatedFilePath}`);
                console.log("\n--- KANDUNGAN FAIL ---\n");
                console.log(content);
                console.log("\n----------------------");
            } else {
                console.error("❌ Ralat: Fail fizikal tidak dijumpai.");
            }

        } else {
            console.error("\n❌ GAGAL (Logic Error):", result.message);
        }

    } catch (error) {
        console.error("\n❌ RALAT SYSTEM (Crash):", error);
    }
}

runTest();