/**
 * Resolve a window-like object for progress broadcasting.
 * In Electron: real BrowserWindow. In headless/web mode (no sender or no
 * electron module): a console-logging stub so the deploy pipeline still runs.
 */
function resolveWindow(event) {
    try {
        if (event && event.sender) {
            const { BrowserWindow } = require('electron');
            const win = resolveWindow(event);
            if (win) return win;
        }
    } catch {
        // electron not available (headless/CLI/web mode)
    }
    return {
        webContents: {
            send: (channel, data) => console.log(`[${channel}]`, typeof data === 'string' ? data : JSON.stringify(data)),
        },
    };
}
const path = require('path');
const fs = require('fs');
const spawn = require('cross-spawn');
const mysql = require('mysql2/promise'); // Required for Deploy

/**
 * Helper to run a shell/terminal command.
 * Shared by the Deploy and Update functions.
 * * @param {string} command - Command (e.g. 'php', 'composer')
 * @param {string[]} args - Command arguments
 * @param {string} cwd - Working directory (Current Working Directory)
 * @param {BrowserWindow} win - Electron window to send logs to
 * @param {string} logChannel - IPC channel name for logs ('deploy-log' or 'update-log')
 */
function runCommand(command, args, cwd, win, logChannel) {
    return new Promise((resolve, reject) => {
        // Send a log of the command being run
        win.webContents.send(logChannel, `> ${command} ${args.join(' ')}`);

        const child = spawn(command, args, { cwd, shell: true });

        child.stdout.on('data', (data) => {
            const message = data.toString().trim();
            if (message) win.webContents.send(logChannel, message);
        });

        child.stderr.on('data', (data) => {
            const message = data.toString().trim();
            // Filter out 'Deprecation' warnings so users are not scared
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
 * Register feature providers declared in fixzy-manifest.json into the
 * target app's bootstrap/providers.php (idempotent). Used by deploy and
 * update so generated providers (SSO/LDAP, real-time) actually boot.
 */
function registerManifestProviders(projectPath, win, logChannel) {
    const manifestPath = path.join(projectPath, 'fixzy-manifest.json');
    if (!fs.existsSync(manifestPath)) return;
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const providers = Array.isArray(manifest.providers) ? manifest.providers : [];
        if (providers.length === 0) return;

        const providersFile = path.join(projectPath, 'bootstrap', 'providers.php');
        if (!fs.existsSync(providersFile)) {
            win.webContents.send(logChannel, 'WARNING: bootstrap/providers.php not found; feature providers not registered.');
            return;
        }
        let contents = fs.readFileSync(providersFile, 'utf8');
        for (const prov of providers) {
            const shortName = prov.split('\\').pop();
            if (!contents.includes(shortName)) {
                contents = contents.replace(
                    /return\s*\[/,
                    `return [\n    ${prov}::class,`
                );
                win.webContents.send(logChannel, `Registered provider: ${prov}`);
            }
        }
        fs.writeFileSync(providersFile, contents);
    } catch (e) {
        win.webContents.send(logChannel, `WARNING: Could not register manifest providers: ${e.message}`);
    }
}

/**
 * Function to DEPLOY (New Installation)
 */
async function deployApp(event, deployConfig) {
    const win = resolveWindow(event);
    const LOG_CHANNEL = 'deploy-log';
    const STATUS_CHANNEL = 'deploy-status';
    
    const { 
        gitRepoUrl, 
        projectPath, 
        generatedPath, 
        dbConfig 
    } = deployConfig;
    // DB support Tier 1+2: engine comes from the project's stack_database
    // (normalized via src/core/dbSupport.js). Unknown engines throw loud.
    const { normalizeEngine } = require('./core/dbSupport');
    const dbEngine = normalizeEngine(dbConfig && dbConfig.engine);

    try {
        win.webContents.send(STATUS_CHANNEL, { step: 1, message: 'Downloading Template...' });

        // --- STEP 1: Git Clone ---
        if (fs.existsSync(projectPath)) {
            fs.rmSync(projectPath, { recursive: true, force: true });
        }
        const parentDir = path.dirname(projectPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
        
        await runCommand('git', ['clone', gitRepoUrl, projectPath], parentDir, win, LOG_CHANNEL);

        // --- STEP 2: Copy Files ---
        win.webContents.send(STATUS_CHANNEL, { step: 2, message: 'Copying generated files...' });
        fs.cpSync(generatedPath, projectPath, { recursive: true, force: true });

        // Register generated feature providers (SSO/LDAP, real-time) in
        // bootstrap/providers.php. The staging folder has no providers.php,
        // so the generator declares them in the manifest instead.
        registerManifestProviders(projectPath, win, LOG_CHANNEL);

        // --- STEP 3: Configure .env ---
        win.webContents.send(STATUS_CHANNEL, { step: 3, message: 'Configuring .env...' });
        const envExamplePath = path.join(projectPath, '.env.example');
        const envPath = path.join(projectPath, '.env');

        if (fs.existsSync(envExamplePath)) {
            let envContent = fs.readFileSync(envExamplePath, 'utf8');
            envContent = envContent.replace(/^APP_URL=.*$/m, 'APP_URL=http://localhost');
            // Engine-aware .env (Tier 1+2). Cloud Postgres presets get SSL.
            const { envLines } = require('./core/dbSupport');
            const lines = envLines(dbConfig.engine || 'sqlite', {
                dbName: dbConfig.dbName,
                user: dbConfig.user,
                password: dbConfig.password,
                host: dbConfig.host || '127.0.0.1',
                port: dbConfig.port,
                sslmode: dbConfig.sslmode,
            });
            const setEnv = (key, value) => {
                const re = new RegExp(`^${key}=.*$`, 'm');
                if (re.test(envContent)) envContent = envContent.replace(re, `${key}=${value}`);
                else envContent += `\n${key}=${value}`;
            };
            for (const line of lines) {
                if (line.startsWith('#')) continue;
                const [key, ...rest] = line.split('=');
                setEnv(key, rest.join('='));
            }
            // sqlite: drop stale host/port/user/pass so Laravel uses the file
            if (dbEngine === 'sqlite') {
                for (const k of ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD']) {
                    envContent = envContent.replace(new RegExp(`^${k}=.*\\n`, 'm'), '');
                }
            }
            fs.writeFileSync(envPath, envContent);
        } else {
            throw new Error('.env.example not found!');
        }

        // --- STEP 4: Database Setup ---
        if (dbEngine === 'sqlite') {
            win.webContents.send(STATUS_CHANNEL, { step: 4, message: 'Preparing SQLite database file...' });
            const dbFile = path.join(projectPath, 'database', 'database.sqlite');
            fs.mkdirSync(path.dirname(dbFile), { recursive: true });
            if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, '');
        } else if (dbEngine === 'mysql') {
            win.webContents.send(STATUS_CHANNEL, { step: 4, message: 'Creating MySQL database...' });
            const connection = await mysql.createConnection({
                host: dbConfig.host || 'localhost',
                port: dbConfig.port ? Number(dbConfig.port) : 3306,
                user: dbConfig.superuser || 'root',
                password: dbConfig.rootPassword
            });
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.dbName}\`;`);
            await connection.query(`CREATE USER IF NOT EXISTS '${dbConfig.user}'@'localhost' IDENTIFIED BY '${dbConfig.password}';`);
            await connection.query(`GRANT ALL PRIVILEGES ON \`${dbConfig.dbName}\`.* TO '${dbConfig.user}'@'localhost';`);
            await connection.query(`FLUSH PRIVILEGES;`);
            await connection.end();
        } else {
            // pgsql (incl. cloud Postgres presets). Provisioning uses the
            // postgres superuser credentials supplied in dbConfig; for
            // managed/cloud databases the DB usually already exists, so a
            // failure here is a warning, not fatal (migrations will still
            // run against the configured DB).
            win.webContents.send(STATUS_CHANNEL, { step: 4, message: 'Preparing PostgreSQL database...' });
            try {
                const { Client } = require('pg');
                const client = new Client({
                    host: dbConfig.host || '127.0.0.1',
                    port: dbConfig.port ? Number(dbConfig.port) : 5432,
                    user: dbConfig.superuser || 'postgres',
                    password: dbConfig.rootPassword || '',
                    database: 'postgres',
                    ssl: dbConfig.sslmode ? { rejectUnauthorized: false } : undefined,
                });
                await client.connect();
                const exists = await client.query(
                    'SELECT 1 FROM pg_database WHERE datname = $1', [dbConfig.dbName]);
                if (exists.rowCount === 0) {
                    await client.query(`CREATE DATABASE "${dbConfig.dbName}"`);
                }
                await client.end();
            } catch (e) {
                win.webContents.send(LOG_CHANNEL,
                    `WARNING: Could not auto-create PostgreSQL database `
                    + `'${dbConfig.dbName}' (${e.message}). If it already `
                    + 'exists (typical for managed/cloud Postgres), you can ignore this.');
            }
        }

        // --- STEP 5: Composer ---
        win.webContents.send(STATUS_CHANNEL, { step: 5, message: 'Install Composer & Key...' });
        await runCommand('composer', ['install', '--optimize-autoloader'], projectPath, win, LOG_CHANNEL);

        // Plug & play: install feature packages chosen at design time
        // (Google SSO / LDAP), as declared in the generated manifest.
        const manifestPath = path.join(projectPath, 'fixzy-manifest.json');
        if (fs.existsSync(manifestPath)) {
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                for (const pkg of (manifest.composer || [])) {
                    win.webContents.send(STATUS_CHANNEL, { step: 5, message: `Installing ${pkg}...` });
                    await runCommand('composer', ['require', pkg, '--no-interaction'], projectPath, win, LOG_CHANNEL);
                }
                for (const ext of (manifest.php_extensions || [])) {
                    const hasExt = await new Promise((resolve) => {
                        const probe = spawn('php', ['-m']);
                        let out = '';
                        probe.stdout.on('data', (d) => { out += d; });
                        probe.on('close', () => resolve(out.toLowerCase().includes(ext.toLowerCase())));
                        probe.on('error', () => resolve(false));
                    });
                    if (!hasExt) {
                        win.webContents.send(LOG_CHANNEL, `WARNING: PHP extension '${ext}' is not installed. Install it (e.g. apt install php-${ext} / php-${ext}-ldap) before using LDAP sign-in.`);
                    }
                }
                // Frontend feature packages (real-time module: pusher-js,
                // laravel-echo). Installed before the npm install/build step.
                for (const pkg of (manifest.npm || [])) {
                    win.webContents.send(STATUS_CHANNEL, { step: 5, message: `Installing npm package ${pkg}...` });
                    try {
                        await runCommand('npm', ['install', pkg, '--save'], projectPath, win, LOG_CHANNEL);
                    } catch (e) {
                        win.webContents.send(LOG_CHANNEL, `WARNING: npm install ${pkg} failed: ${e.message}. Real-time JS may fall back to CDN builds.`);
                    }
                }
            } catch (e) {
                win.webContents.send(LOG_CHANNEL, `WARNING: Could not read fixzy-manifest.json: ${e.message}`);
            }
        }

        await runCommand('php', ['artisan', 'key:generate'], projectPath, win, LOG_CHANNEL);

        // --- STEP 6: Migration & Shield ---
        win.webContents.send(STATUS_CHANNEL, { step: 6, message: 'Migrating Database...' });
        await runCommand('php', ['artisan', 'migrate', '--force'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'shield:generate', '--all', '--panel=admin', '--no-interaction'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'db:seed'], projectPath, win, LOG_CHANNEL);

        // --- STEP 7: NPM ---
        win.webContents.send(STATUS_CHANNEL, { step: 7, message: 'Build Frontend Assets...' });
        await runCommand('npm', ['install'], projectPath, win, LOG_CHANNEL);
        await runCommand('npm', ['run', 'build'], projectPath, win, LOG_CHANNEL);

        // --- STEP 8: Optimize ---
        win.webContents.send(STATUS_CHANNEL, { step: 8, message: 'Optimizing Application...' });
        await runCommand('php', ['artisan', 'storage:link'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'config:cache'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'route:cache'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'view:cache'], projectPath, win, LOG_CHANNEL);

        win.webContents.send(STATUS_CHANNEL, { step: 9, message: 'Done!', success: true });
        return { success: true };

    } catch (error) {
        console.error(error);
        win.webContents.send(LOG_CHANNEL, `ERROR: ${error.message}`);
        win.webContents.send(STATUS_CHANNEL, { step: 0, message: 'Failed', success: false, error: error.message });
        return { success: false, message: error.message };
    }
}

/**
 * Function to UPDATE (Refresh an Existing Project)
 */
async function updateApp(event, updateConfig) {
    const win = resolveWindow(event);
    const LOG_CHANNEL = 'update-log';
    const STATUS_CHANNEL = 'update-status';

    const { 
        projectPath, 
        generatedPath 
    } = updateConfig;

    try {
        win.webContents.send(STATUS_CHANNEL, { step: 1, message: 'Checking project folder...' });

        // 1. Validation
        if (!fs.existsSync(projectPath)) {
            throw new Error(`Project folder not found at: ${projectPath}`);
        }
        if (!fs.existsSync(path.join(projectPath, 'artisan'))) {
            throw new Error("This folder is not a valid Laravel project.");
        }

        // 2. Maintenance Mode
        win.webContents.send(STATUS_CHANNEL, { step: 2, message: 'Enabling maintenance mode...' });
        try {
            await runCommand('php', ['artisan', 'down', '--render="errors::503"'], projectPath, win, LOG_CHANNEL);
        } catch (e) { console.warn("Failed to set down mode, continuing...", e); }

        // 3. Copy New Files (Smart Overwrite)
        win.webContents.send(STATUS_CHANNEL, { step: 3, message: 'Copying update files...' });
        fs.cpSync(generatedPath, projectPath, { 
            recursive: true, 
            force: true,
            filter: (src) => {
                // Do not overwrite .env
                if (path.basename(src) === '.env') return false; 
                return true;
            }
        });

        // 3b. Register any new feature providers from the manifest (idempotent).
        registerManifestProviders(projectPath, win, LOG_CHANNEL);

        // 4. Update Dependencies
        win.webContents.send(STATUS_CHANNEL, { step: 4, message: 'Updating Autoloader...' });
        await runCommand('composer', ['dump-autoload'], projectPath, win, LOG_CHANNEL);

        // 5. Database Migration
        win.webContents.send(STATUS_CHANNEL, { step: 5, message: 'Running Migration...' });
        try {
            await runCommand('php', ['artisan', 'migrate', '--force'], projectPath, win, LOG_CHANNEL);
        } catch (dbError) {
            win.webContents.send(LOG_CHANNEL, `[DB WARNING]: ${dbError.message}`);
        }

        // 6. Filament Upgrade & Cache Clearing
        win.webContents.send(STATUS_CHANNEL, { step: 6, message: 'Optimizing Assets & Cache...' });
        await runCommand('php', ['artisan', 'filament:upgrade'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'optimize:clear'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'config:cache'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'route:cache'], projectPath, win, LOG_CHANNEL);
        await runCommand('php', ['artisan', 'view:cache'], projectPath, win, LOG_CHANNEL);

        // 7. Turn Off Maintenance Mode
        win.webContents.send(STATUS_CHANNEL, { step: 7, message: 'Reopening application...' });
        await runCommand('php', ['artisan', 'up'], projectPath, win, LOG_CHANNEL);

        win.webContents.send(STATUS_CHANNEL, { step: 8, message: 'Update Complete!', success: true });
        return { success: true };

    } catch (error) {
        console.error(error);
        win.webContents.send(LOG_CHANNEL, `ERROR: ${error.message}`);
        win.webContents.send(STATUS_CHANNEL, { step: 0, message: 'Failed', success: false, error: error.message });
        try { await runCommand('php', ['artisan', 'up'], projectPath, win, LOG_CHANNEL); } catch(e){}
        return { success: false, message: error.message };
    }
}

module.exports = { deployApp, updateApp };
