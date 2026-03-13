import { contextBridge } from 'electron';

// Expose safe APIs to renderer if needed in the future
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
