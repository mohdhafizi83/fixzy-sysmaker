const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const spawn = require('cross-spawn');
const mysql = require('mysql2/promise'); // Diperlukan untuk Deploy

/**
 * Helper untuk menjalankan command shell/terminal.
 * Dikongsi oleh fungsi Deploy dan Update.
 * * @param {string} command - Perintah (cth: 'php', 'composer')
 * @param {string[]} args - Hujah perintah
 * @param {string} cwd - Direktori kerja (Current Working Directory)
 * @param {BrowserWindow} win - Tetingkap Electron untuk hantar log
 * @param {string} logChannel - Nama channel IPC untuk log ('deploy-log' atau 'update-log')
 */
function runCommand(command, args, cwd, win, logChannel) {
    return new Promise((resolve, reject) => {
        // Hantar log arahan yang dijalankan
        win.webContents.send(logChannel, `> ${command} ${args.join(' ')}`);

        const child = spawn(command, args, { cwd, shell: true });

        child.stdout.on('data', (data) => {
            const message = data.toString().trim();
            if (message) win.webContents.send(logChannel, message);
        });

        child.stderr.on('data', (data) => {
            const message = data.toString().trim();
            // Tapis amaran 'Deprecation' supaya tidak menakutkan pengguna
            if (message && !message.includes('Deprecation')) {
                win.webContents.send(logChannel, `[INFO/WARN]: ${message}`);
            }
        });

        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });
    });
}

/**
 * Fungsi untuk DEPLOY (Pemasangan Baru)
 */
async function deployApp(event, deployConfig) {
    const win = BrowserWindow.fromWebContents(event.sender);
    const LOG_CHANNEL = 'deploy-log';
    const STATUS_CHANNEL = 'deploy-status';
    
    const { 
        gitRepoUrl, 
        projectPath, 
        generatedPath, 
        dbConfig 
    } = deployConfig;

    try {
        win.webContents.send(STATUS_CHANNEL, { step: 1, message: 'Memuat turun Template...' });

        // --- LANGKAH 1: Git Clone ---
        if (fs.existsSync(projectPath)) {
            fs.rmSync(projectPath, { recursive: true, force: true });
        }
        const parentDir = path.dirname(projectPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
        
        await runCommand('git', ['clone', gitRepoUrl, projectPath], parentDir, win, LOG_CHANNEL);

        // --- LANGKAH 2: Salin Fail ---
        win.webContents.send(STATUS_CHANNEL, { step: 2, message: 'Menyalin fail janaan...' });
        fs.cpSync(generatedPath, projectPath, { recursive: true, force: true });

        // --- LANGKAH 3: Konfigurasi .env ---
        win.webContents.send(STATUS_CHANNEL, { step: 3, message: 'Konfigurasi .env...' });
        const envExamplePath = path.join(projectPath, '.env.example');
        const envPath = path.join(projectPath, '.env');

        if (fs.existsSync(envExamplePath)) {
            let envContent = fs.readFileSync(envExamplePath, 'utf8');
            envContent = envContent.replace(/^APP_URL=.*$/m, 'APP_URL=http://localhost');
            envContent = envContent.replace(/^DB_CONNECTION=.*$/m, 'DB_CONNECTION=mysql');
            envContent = envContent.replace(/^DB_DATABASE=.*$/m, `DB_DATABASE=${dbConfig.dbName}`);
            envContent = envContent.replace(/^DB_USERNAME=.*$/m, `DB_USERNAME=${dbConfig.user}`);
            envContent = envContent.replace(/^DB_PASSWORD=.*$/m, `DB_PASSWORD=${dbConfig.password}`);
            fs.writeFileSync(envPath, envContent);
        } else {
            throw new Error('.env.example tidak ditemui!');
        }

        // --- LANGKAH 4: Setup Database ---
        win.webContents.send(STATUS_CHANNEL, { step: 4, message: 'Mencipta Pangkalan Data...' });
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: dbConfig.rootPassword
        });
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.dbName}\`;`);
        await connection.query(`CREATE USER IF NOT EXISTS '${dbConfig.user}'@'localhost' IDENTIFIED BY '${dbConfig.password}';`);
        await connection.query(`GRANT ALL PRIVILEGES ON \`${dbConfig.dbName}\`.* TO '${dbConfig.user}'@'localhost';`);
        await connection.query(`FLUSH PRIVILEGES;`);
        await connection.end();

        // --- LANGKAH 5: Composer ---
        win.webContents.send(STATUS_CHANNEL, { step: 5, message: 'Install Composer & Key...' });
        await runCommand('composer', ['install', '--optimize-autoloader'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'key:generate'], projectPath, win, LOG_CHANNEL);

        // --- LANGKAH 6: Migrasi & Shield ---
        win.webContents.send(STATUS_CHANNEL, { step: 6, message: 'Migrasi Database...' });
        await runCommand('php', ['artisan', 'migrate', '--force'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'shield:generate', '--all', '--panel=admin', '--no-interaction'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'db:seed'], projectPath, win, LOG_CHANNEL);

        // --- LANGKAH 7: NPM ---
        win.webContents.send(STATUS_CHANNEL, { step: 7, message: 'Build Frontend Assets...' });
        await runCommand('npm', ['install'], projectPath, win, LOG_CHANNEL);
        await runCommand('npm', ['run', 'build'], projectPath, win, LOG_CHANNEL);

        // --- LANGKAH 8: Optimize ---
        win.webContents.send(STATUS_CHANNEL, { step: 8, message: 'Mengoptimumkan Aplikasi...' });
        await runCommand('php', ['artisan', 'storage:link'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'config:cache'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'route:cache'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'view:cache'], projectPath, win, LOG_CHANNEL);

        win.webContents.send(STATUS_CHANNEL, { step: 9, message: 'Selesai!', success: true });
        return { success: true };

    } catch (error) {
        console.error(error);
        win.webContents.send(LOG_CHANNEL, `ERROR: ${error.message}`);
        win.webContents.send(STATUS_CHANNEL, { step: 0, message: 'Gagal', success: false, error: error.message });
        return { success: false, message: error.message };
    }
}

/**
 * Fungsi untuk UPDATE (Kemaskini Projek Sedia Ada)
 */
async function updateApp(event, updateConfig) {
    const win = BrowserWindow.fromWebContents(event.sender);
    const LOG_CHANNEL = 'update-log';
    const STATUS_CHANNEL = 'update-status';

    const { 
        projectPath, 
        generatedPath 
    } = updateConfig;

    try {
        win.webContents.send(STATUS_CHANNEL, { step: 1, message: 'Memeriksa folder projek...' });

        // 1. Validasi
        if (!fs.existsSync(projectPath)) {
            throw new Error(`Folder projek tidak ditemui di: ${projectPath}`);
        }
        if (!fs.existsSync(path.join(projectPath, 'artisan'))) {
            throw new Error("Folder ini bukan projek Laravel yang sah.");
        }

        // 2. Mod Penyelenggaraan
        win.webContents.send(STATUS_CHANNEL, { step: 2, message: 'Mengaktifkan mod penyelenggaraan...' });
        try {
            await runCommand('php', ['artisan', 'down', '--render="errors::503"'], projectPath, win, LOG_CHANNEL);
        } catch (e) { console.warn("Gagal set mode down, meneruskan...", e); }

        // 3. Salin Fail Baru (Smart Overwrite)
        win.webContents.send(STATUS_CHANNEL, { step: 3, message: 'Menyalin fail kemaskini...' });
        fs.cpSync(generatedPath, projectPath, { 
            recursive: true, 
            force: true,
            filter: (src) => {
                // Jangan overwrite .env
                if (path.basename(src) === '.env') return false; 
                return true;
            }
        });

        // 4. Update Dependencies
        win.webContents.send(STATUS_CHANNEL, { step: 4, message: 'Mengemaskini Autoloader...' });
        await runCommand('composer', ['dump-autoload'], projectPath, win, LOG_CHANNEL);

        // 5. Migrasi Database
        win.webContents.send(STATUS_CHANNEL, { step: 5, message: 'Menjalankan Migrasi...' });
        try {
            await runCommand('php', ['artisan', 'migrate', '--force'], projectPath, win, LOG_CHANNEL);
        } catch (dbError) {
            win.webContents.send(LOG_CHANNEL, `[AMARAN DB]: ${dbError.message}`);
        }

        // 6. Filament Upgrade & Cache Clearing
        win.webContents.send(STATUS_CHANNEL, { step: 6, message: 'Mengoptimumkan Aset & Cache...' });
        await runCommand('php', ['artisan', 'filament:upgrade'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'optimize:clear'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'config:cache'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'route:cache'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'view:cache'], projectPath, win, LOG_CHANNEL);

        // 7. Matikan Mod Penyelenggaraan
        win.webContents.send(STATUS_CHANNEL, { step: 7, message: 'Membuka semula aplikasi...' });
        await runCommand('php', ['artisan', 'up'], projectPath, win, LOG_CHANNEL);

        win.webContents.send(STATUS_CHANNEL, { step: 8, message: 'Kemaskini Selesai!', success: true });
        return { success: true };

    } catch (error) {
        console.error(error);
        win.webContents.send(LOG_CHANNEL, `ERROR: ${error.message}`);
        win.webContents.send(STATUS_CHANNEL, { step: 0, message: 'Gagal', success: false, error: error.message });
        try { await runCommand('php', ['artisan', 'up'], projectPath, win, LOG_CHANNEL); } catch(e){}
        return { success: false, message: error.message };
    }
}

module.exports = { deployApp, updateApp };