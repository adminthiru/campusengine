import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone super-admin (product-owner) portal. Runs on its own port and
// proxies API calls to the same backend as the school app.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
