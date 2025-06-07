const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    fetchCasePrice: (caseName) => ipcRenderer.invoke('fetch-case-price', caseName),
    fetchAllCasePrices: (caseNames) => ipcRenderer.invoke('fetch-all-case-prices', caseNames)
});