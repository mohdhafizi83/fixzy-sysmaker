const path = require('path');
const fs = require('fs');

// 1. IMPORT FUNGSI GENERATOR
// Pastikan path ini betul relatif kepada folder 'test'
const { generateFilamentExports } = require('../src/generators/laravelExportsGenerator');

// 2. MOCK DATA (Data Tipu untuk Ujian Menyeluruh)
const mockFullSchema = {
    tables: [
        {
            table_id: 101,
            table_name: 'pelajar_sekolah', // Test Rule 1 & 3: "PelajarSekolah", "pelajar sekolah"
        }
    ],
    table_columns: [
        // KES 1: Column Biasa (Rule 2.5)
        {
            table_id: 101,
            column_name: 'no_matrik',
            data_type: 'varchar',
            tv_text_limit: null,
            lookup_parent_table: null
        },

        // KES 2: Text Limit (Rule 2.3)
        {
            table_id: 101,
            column_name: 'catatan_guru',
            data_type: 'text',
            tv_text_limit: 50, // Test limit value
            lookup_parent_table: null
        },

        // KES 3: JSON Field (Rule 2.4)
        {
            table_id: 101,
            column_name: 'senarai_subjek',
            data_type: 'json', // Test JSON handling
            tv_text_limit: null,
            lookup_parent_table: null
        },

        // KES 4: Foreign Key - Caption 1 Sahaja (Rule 2.1)
        {
            table_id: 101,
            column_name: 'kelas_id',
            data_type: 'int',
            lookup_parent_table: 'senarai_kelas', // Test camelCase conversion -> senaraiKelas
            lookup_caption_1: 'nama_kelas',
            lookup_caption_2: null // Test empty caption 2
        },

        // KES 5: Foreign Key - Caption 1 & 2 (Rule 2.2)
        {
            table_id: 101,
            column_name: 'guru_kelas_id',
            data_type: 'int',
            lookup_parent_table: 'guru_bertugas', // Test camelCase -> guruBertugas
            lookup_caption_1: 'nama',
            lookup_caption_2: 'kod_pekerja' // Test combination -> nama_kod_pekerja
        }
    ],
    // table_relationships tidak diperlukan untuk logik baru ini kerana kita guna lookup properties column
    table_relationships: [] 
};

// 3. TENTUKAN FOLDER OUTPUT
const testOutputDir = path.join(__dirname, 'output');

// Bersihkan folder output lama
if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
}
fs.mkdirSync(testOutputDir, { recursive: true });

// 4. JALANKAN UJIAN
async function runTest() {
    console.log("--- MULA UJIAN EXPORTS GENERATOR ---");
    console.log("Input Data (Mock):", JSON.stringify(mockFullSchema, null, 2));

    try {
        const result = await generateFilamentExports(mockFullSchema, testOutputDir);

        if (result.success) {
            console.log("\n✅ BERJAYA DIJANA!");
            
            // Semak Fail Terjana (Rule 4: PascalCase + Exporter.php)
            const expectedFileName = 'PelajarSekolahExporter.php';
            const generatedFilePath = path.join(testOutputDir, 'app', 'Filament', 'Exports', expectedFileName);
            
            if (fs.existsSync(generatedFilePath)) {
                const content = fs.readFileSync(generatedFilePath, 'utf8');
                console.log(`\n📄 Lokasi Fail: ${generatedFilePath}`);
                console.log("\n--- KANDUNGAN FAIL (Sila Semak Logic) ---\n");
                console.log(content);
                console.log("\n-----------------------------------------");
                
                // VALIDASI PANTAS (Assertion)
                console.log("\n--- KEPUTUSAN VALIDASI ---");
                
                // Rule 1 Check
                check(content.includes('class PelajarSekolahExporter'), "Rule 1 (Class Name PascalCase)");
                
                // Rule 2.1 Check (Foreign Key 1 Caption)
                check(content.includes("ExportColumn::make('senaraiKelas.nama_kelas')"), "Rule 2.1 (FK Single Caption)");
                
                // Rule 2.2 Check (Foreign Key 2 Captions)
                check(content.includes("ExportColumn::make('guruBertugas.nama_kod_pekerja')"), "Rule 2.2 (FK Double Caption)");

                // Rule 2.3 Check (Limit)
                check(content.includes("->limit(50)"), "Rule 2.3 (Text Limit)");

                // Rule 2.4 Check (JSON)
                check(content.includes("->listAsJson()"), "Rule 2.4 (JSON Type)");
                
                // Rule 3 Check (Phrase)
                check(content.includes("Your pelajar sekolah export"), "Rule 3 (Notification Phrase)");

            } else {
                console.error(`❌ Ralat: Fail ${expectedFileName} tidak dijumpai.`);
            }

        } else {
            console.error("\n❌ GAGAL (Generator Error):", result.message);
        }

    } catch (error) {
        console.error("\n❌ RALAT SYSTEM (Crash):", error);
    }
}

// Helper untuk print pass/fail
function check(condition, testName) {
    if (condition) console.log(`✅ PASS: ${testName}`);
    else console.log(`❌ FAIL: ${testName}`);
}

runTest();