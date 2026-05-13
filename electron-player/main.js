/**
 * Shell mínimo: abre uma janela e carrega a URL do player (mesmo fluxo que Chromium kiosk).
 *
 * Uso:
 *   PLAYER_URL=https://totem.exemplo/player/ npm start
 */
const { app, BrowserWindow, shell, dialog } = require('electron');

const DEFAULT_PLAYER_URL = 'http://127.0.0.1:8080/';

function resolvePlayerUrl() {
  const fromEnv = process.env.PLAYER_URL || process.env.VITE_PLAYER_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim();
  }
  return DEFAULT_PLAYER_URL;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1080,
    height: 1920,
    fullscreen: process.env.TOTEMDIGITAL_KIOSK === '1',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;

  win.once('ready-to-show', () => {
    win.show();
  });

  const url = resolvePlayerUrl();

  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target).catch(() => {});
    return { action: 'deny' };
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (String(validatedURL).startsWith('data:text/html')) return;
    dialog
      .showMessageBox(win, {
        type: 'error',
        title: 'TotemDigital Player',
        message: 'Não foi possível carregar o player',
        detail: `${errorDescription}\n${validatedURL}\n(código ${errorCode})`,
      })
      .catch(() => {});
  });

  win.loadURL(url).catch((err) => {
    console.error('Falha ao carregar PLAYER_URL:', url, err);
    dialog
      .showErrorBox('TotemDigital Player', `Falha ao iniciar:\n${url}\n${err?.message || err}`)
      .catch(() => {});
  });

  if (process.env.TOTEMDIGITAL_OPEN_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  return win;
}

app.on('second-instance', () => {
  const w = BrowserWindow.getAllWindows()[0];
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
