const { contextBridge, ipcRenderer } = require('electron');

// Expõe APIs seguras para comunicação direta entre a UI e as BrowserViews do Electron
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  navigate: (paneId, url) => ipcRenderer.send('pane-navigate', { paneId, url }),
  reload: (paneId) => ipcRenderer.send('pane-reload', { paneId }),
  goBack: (paneId) => ipcRenderer.send('pane-go-back', { paneId }),
  goForward: (paneId) => ipcRenderer.send('pane-go-forward', { paneId }),
  updateBounds: (panesBounds) => ipcRenderer.send('update-panes-bounds', panesBounds),
  hidePane: (paneId) => ipcRenderer.send('hide-pane', { paneId }),
  showPane: (paneId) => ipcRenderer.send('show-pane', { paneId }),
  onUrlChanged: (callback) => ipcRenderer.on('pane-url-changed', (e, data) => callback(data)),
  onTitleChanged: (callback) => ipcRenderer.on('pane-title-changed', (e, data) => callback(data)),
  onLoadingChanged: (callback) => ipcRenderer.on('pane-loading-changed', (e, data) => callback(data))
});
