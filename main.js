// main.js
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// IMPORTANT: Import the new function from steam.js
import { getAllCasePricesFromSearchPage, getCasePrice } from './steam.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC Communication from Renderer to Main ---

// IPC handler for single case price fetching (can be removed if not used)
ipcMain.handle('fetch-case-price', async (event, caseName) => {
    try {
        // You might want to get this from the cached search results if available,
        // or keep individual scraping if needed. For now, it calls the old one.
        const price = await getCasePrice(caseName);
        return { success: true, price: price };
    } catch (error) {
        console.error(`Error fetching price for ${caseName} in main process:`, error);
        return { success: false, error: error.message };
    }
});

// IPC handler for batch price fetching (NOW CALLS THE NEW SEARCH SCRAPER)
ipcMain.handle('fetch-all-case-prices', async (event, caseNames) => {
    // caseNames parameter is now largely ignored by getAllCasePricesFromSearchPage,
    // as it scrapes all available cases from the search page.
    const allPrices = await getAllCasePricesFromSearchPage();
    return allPrices; // Returns the object { "Case Name": price, ... }
});