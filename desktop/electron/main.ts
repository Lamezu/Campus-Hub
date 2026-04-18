import { app, BrowserWindow, ipcMain, dialog, desktopCapturer } from 'electron';
import path from 'path';
import axios from 'axios';
import fs from 'fs';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Disabling sandbox can help with certain media captures
    },
    titleBarStyle: 'default',
    title: 'CampusHub',
    show: false,
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // Ensure focus is regained when window is clicked
  win.on('focus', () => {
    win.webContents.focus();
  });

  // More aggressive focus management for "stuck" input issues
  win.webContents.on('before-input-event', () => {
    if (!win.isFocused()) {
      win.focus();
    }
  });

  // We disable the native request handler to ensure our custom source picker modal is always used for a better UX.
  win.webContents.session.setDisplayMediaRequestHandler(null);

  win.on('close', (event) => {
    if ((app as any).isQuitting) return;
    event.preventDefault();
    win.webContents.send('app-closing');
  });
}

(app as any).isQuitting = false;
app.on('before-quit', () => {
  (app as any).isQuitting = true;
});

ipcMain.on('close-confirmed', () => {
  app.quit();
});

const FIREBASE_API_KEY = 'AIzaSyA2Bvno8r2bi7Uv_2SuTiQ2HsmO3fGPLjs';
const FIREBASE_AUTH_DOMAIN = 'campushub-52343.firebaseapp.com';

ipcMain.handle('get-screen-sources', async () => {
  try {
    console.log('[ScreenShare] IPC Invoke: get-screen-sources');
    
    // Try both separately to debug which one fails
    let screenSources: any[] = [];
    try {
      screenSources = await desktopCapturer.getSources({ 
        types: ['screen'],
        thumbnailSize: { width: 400, height: 225 }
      });
      console.log(`[ScreenShare] Screens found: ${screenSources.length}`);
    } catch (err) {
      console.error('[ScreenShare] Error fetching screens:', err);
    }

    let windowSources: any[] = [];
    try {
      windowSources = await desktopCapturer.getSources({ 
        types: ['window'],
        thumbnailSize: { width: 400, height: 225 }
      });
      console.log(`[ScreenShare] Windows found: ${windowSources.length}`);
    } catch (err) {
      console.error('[ScreenShare] Error fetching windows:', err);
    }

    const allSources = [...screenSources, ...windowSources];
    
    const mapped = allSources.map(source => {
      try {
        return {
          id: source.id,
          name: source.name,
          thumbnail: source.thumbnail.toDataURL(),
          appIcon: source.appIcon ? source.appIcon.toDataURL() : null
        };
      } catch (e) {
        console.error(`[ScreenShare] Error mapping source ${source.name}:`, e);
        return null;
      }
    }).filter(s => s !== null);

    console.log(`[ScreenShare] Returning ${mapped.length} mapped sources`);
    return mapped;
  } catch (err) {
    console.error('[ScreenShare] Critical error in get-screen-sources:', err);
    return [];
  }
});

// For native getDisplayMedia support (if used directly)
let selectedSourceId: string | null = null;
ipcMain.on('set-selected-source', (_event, id) => {
  selectedSourceId = id;
});

ipcMain.handle('google-auth', () => {
  return new Promise(async (resolve) => {
    let settled = false;
    const done = (value: any) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let authUri: string;
    try {
      const resp = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${FIREBASE_API_KEY}`,
        { providerId: 'google.com', continueUri: `https://${FIREBASE_AUTH_DOMAIN}/__/auth/handler` }
      );
      authUri = resp.data.authUri;
    } catch {
      done(null);
      return;
    }

    const authWin = new BrowserWindow({
      width: 520,
      height: 680,
      title: 'Sign in with Google',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    authWin.setMenu(null);
    authWin.loadURL(authUri);

    const tryExtract = async (url: string) => {
      if (!url.includes(`${FIREBASE_AUTH_DOMAIN}/__/auth/handler`)) return;
      try {
        const hash: string = await authWin.webContents.executeJavaScript('location.hash');
        const params = new URLSearchParams(hash.slice(1));
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');
        if (idToken || accessToken) {
          done({ idToken, accessToken });
          authWin.destroy();
        }
      } catch {}
    };

    authWin.webContents.on('will-redirect', (_, url) => tryExtract(url));
    authWin.webContents.on('did-navigate', (_, url) => tryExtract(url));
    authWin.webContents.on('did-navigate-in-page', (_, url) => tryExtract(url));
    authWin.on('closed', () => done(null));
  });
});

// Handle native downloads
ipcMain.handle('download-file', async (_event: any, { url, fileName }: { url: string; fileName: string }) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { success: false, error: 'No active window' };

  try {
    const { filePath } = await dialog.showSaveDialog(win, {
      defaultPath: fileName,
      title: 'Guardar archivo',
      buttonLabel: 'Guardar',
    });

    if (!filePath) return { success: false, error: 'Download cancelled' };

    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve({ success: true, filePath }));
      writer.on('error', (err) => resolve({ success: false, error: err.message }));
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length === 0) {
      createWindow();
    } else {
      allWindows[0].focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

