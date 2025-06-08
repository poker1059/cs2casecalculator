// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    fetchAllCasePrices: () => ipcRenderer.invoke('fetch-all-case-prices'),
    
    // Expose both async and sync normalization functions
    normalizeCaseName: (name) => ipcRenderer.invoke('normalize-case-name', name),
    normalizeCaseNameSync: (name) => ipcRenderer.sendSync('normalize-case-name-sync', name),

    // Existing planner functions (ensure these are also present if you have them)
    savePlannerData: (data) => ipcRenderer.invoke('save-planner-data', data),
    loadPlannerData: () => ipcRenderer.invoke('load-planner-data'),
    saveKeyQuantity: (quantity) => ipcRenderer.invoke('save-key-quantity', quantity),
    loadKeyQuantity: () => ipcRenderer.invoke('load-key-quantity')
});