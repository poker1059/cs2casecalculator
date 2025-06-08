// main.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { fetchAllCasePrices } = require('./steam.cjs'); // <--- CHANGE THIS LINE
const fs = require('node:fs/promises');
const fssync = require('node:fs');

const plannerDataPath = path.join(app.getPath('userData'), 'planner-data.json');
const keyQuantityPath = path.join(app.getPath('userData'), 'key-quantity.json');


function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'), // <--- CHANGE THIS LINE
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    win.loadFile('index.html');
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    // IPC Handler for fetching all case prices
    ipcMain.handle('fetch-all-case-prices', async () => {
        try {
            console.log("Main process: Fetching all case prices...");
            const data = await fetchAllCasePrices();
            console.log(`Main process: Fetched ${data.length} cases.`);
            return data;
        } catch (error) {
            console.error('Error in fetch-all-case-prices IPC:', error);
            throw error; // Re-throw to be caught by renderer
        }
    });

    // IPC handler for normalizing case names (asynchronous version for ipcRenderer.invoke)
    ipcMain.handle('normalize-case-name', (event, name) => {
        if (!name) return '';
        let normalized = name.toLowerCase();
        normalized = normalized.replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric characters
        return normalized;
    });

    // IPC handler for normalizing case names (synchronous version for ipcRenderer.sendSync)
    ipcMain.on('normalize-case-name-sync', (event, name) => {
        if (!name) {
            event.returnValue = '';
            return;
        }
        let normalized = name.toLowerCase();
        normalized = normalized.replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric characters
        event.returnValue = normalized; // Set the return value for sendSync
    });

    // IPC Handlers for planner data saving/loading (ensure these are also present if you use them)
    ipcMain.handle('save-planner-data', async (event, data) => {
        try {
            await fs.writeFile(plannerDataPath, JSON.stringify(data));
            return { success: true };
        } catch (error) {
            console.error('Error saving planner data:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('load-planner-data', async () => {
        try {
            const data = await fs.readFile(plannerDataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return []; // File not found, return empty array
            }
            console.error('Error loading planner data:', error);
            throw error;
        }
    });

    // IPC Handlers for key quantity saving/loading (ensure these are also present if you use them)
    ipcMain.handle('save-key-quantity', async (event, quantity) => {
        try {
            await fs.writeFile(keyQuantityPath, JSON.stringify(quantity));
            return { success: true };
        } catch (error) {
            console.error('Error saving key quantity:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('load-key-quantity', async () => {
        try {
            const data = await fs.readFile(keyQuantityPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return 0; // File not found, return 0
            }
            console.error('Error loading key quantity:', error);
            throw error;
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});