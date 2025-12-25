import path from 'node:path';

import { app, BrowserWindow } from 'electron';

// app.isPackaged надёжнее, чем переменная окружения в финальной сборке
const isDev = !app.isPackaged;

// Разрешаем загрузку локальных файлов (wasm) при file://
app.commandLine.appendSwitch('allow-file-access-from-files');
// Чтобы гарантированно читать файлы из app.asar (или распакованных ассетов)
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

const createWindow = () => {
  const preloadPath = path.join(__dirname, 'preload.js');

  const win = new BrowserWindow({
    width: 900,
    height: 640,
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: false
    }
  });

  if (isDev) {
    void win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    void win.loadFile(indexPath);
  }
};

app
  .whenReady()
  .then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  })
  .catch((err) => {
    console.error('Failed to start Electron', err);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

