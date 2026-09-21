// main.js — Electron main process (Phase 5 slim).
//
// All IPC handler logic now lives in src/handlers/register.js (shared with the
// headless/web server). This file only wires Electron-specific context:
// window lifecycle, userData paths, dialogs, shell.

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { openStore } = require("./core/store");

// Electron keeps its historical userData location (existing installs upgrade
// in place). Same pragmas as before (WAL + busy_timeout).
const dbPath = path.join(app.getPath("userData"), "FiziSysMaker.db");
const dbExists = fs.existsSync(dbPath);
const db = openStore(dbPath);
if (!dbExists) {
    // openStore bootstraps from resources/schema.sql on first run.
    console.log("FiziSysMaker database created at", dbPath);
}

const registerIpcHandlers = require("./handlers/register");

registerIpcHandlers({
    ipcMain,
    db,
    getPath: (name) => app.getPath(name),
    getWindow: (event) => {
        try {
            return BrowserWindow.fromWebContents(event.sender);
        } catch {
            return null;
        }
    },
    dialog,
    shell,
    isPackaged: app.isPackaged,
    onQuit: (fn) => app.on("will-quit", fn),
});

// =================================================================
// Window lifecycle
// =================================================================

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, "./preload.js"),
            webviewTag: true,
        },
    });

    win.maximize();
    win.loadFile(path.join(__dirname, "./index.html"));
    win.on("ready-to-show", () => {
        win.show();
    });

    // DevTools gated (Phase 7.5): only with FSM_DEVTOOLS=1
    if (process.env.FSM_DEVTOOLS === "1") {
        win.webContents.openDevTools();
    }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
