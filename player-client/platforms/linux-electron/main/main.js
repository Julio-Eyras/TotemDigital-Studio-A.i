/**
 * Main Process - Electron Linux
 * Processo principal do Electron
 */

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let isQuitting = false;

/**
 * Cria janela principal
 */
function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    fullscreen: true,
    frame: false,
    kiosk: true, // Modo kiosk
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    backgroundColor: '#000000',
    show: false, // Não mostrar até carregar
  });

  // Carregar aplicação
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Mostrar quando pronto
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Prevenir fechamento acidental
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      // Apenas fechar com comando específico ou shutdown do sistema
    }
  });

  // DevTools apenas em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * Inicializa aplicação
 */
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Não fechar app quando todas as janelas fecham (Linux)
  if (process.platform !== 'darwin') {
    // Manter app rodando
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// IPC Handlers
ipcMain.handle('get-config', () => {
  return {
    apiBaseURL: process.env.API_BASE_URL || 'http://localhost:3000',
    totemUIN: process.env.TOTEM_UIN || '',
    totemSecret: process.env.TOTEM_SECRET || '',
  };
});

ipcMain.handle('set-fullscreen', (event, fullscreen) => {
  if (mainWindow) {
    mainWindow.setFullScreen(fullscreen);
  }
});

// Auto-start via systemd (será configurado externamente)
// Ver arquivo systemd/smartsignage-player.service

