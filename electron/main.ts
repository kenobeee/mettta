import path from 'node:path';

import { app, BrowserWindow } from 'electron';

const isDev = process.env.NODE_ENV !== 'production';

const createWindow = () => {
  const preloadPath = path.join(__dirname, 'preload.js');

  const win = new BrowserWindow({
    width: 900,
    height: 640,
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath
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

