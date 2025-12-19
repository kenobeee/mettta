import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('appInfo', {
  env: process.env.NODE_ENV ?? 'production'
});

