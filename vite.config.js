import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Permite que os assets CSS/JS carreguem perfeitamente tanto no Electron (file://) quanto na web
  server: {
    host: '127.0.0.1',
    port: 5173,
    cors: true,
  },
});
