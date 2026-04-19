import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  downloadFile: (url: string, fileName: string) => ipcRenderer.invoke('download-file', { url, fileName }),
  googleAuth: () => ipcRenderer.invoke('google-auth'),
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
});