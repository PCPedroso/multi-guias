import { contextBridge, ipcRenderer } from 'electron';

// Expõe APIs seguras para a interface do Multi-Guias
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron
});
