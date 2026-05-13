/**
 * Shell mínimo: abre uma janela e carrega a URL do player (mesmo fluxo que Chromium kiosk).
 *
 * Uso:
 *   PLAYER_URL=https://totem.exemplo/player/ npm start
 */
const { app, BrowserWindow } = require('electron');

const DEFAULT_PLAYER_URL = 'http://127.0.0.1:8080/';

function resolvePlayerUrl() {
  const fromEnv = process.env.PLAYER_URL || process.env.VITE_PLAYER_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim();
  }
  return DEFAULT_PLAYER_URL;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1080,
    height: 1920,
    fullscreen: process.env.TOTEMDIGITAL_KIOSK === '1',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  const url = resolvePlayerUrl();
  win.loadURL(url).catch((err) => {
    console.error('Falha ao carregar PLAYER_URL:', url, err);
  });

  if (process.env.TOTEMDIGITAL_OPEN_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
