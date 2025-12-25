import { defineConfig } from 'vite';

// Use relative base in production so Electron can load files via file://
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : './',
  server: {
    port: 5173
  },
  build: {
    target: 'esnext'
  }
}));

