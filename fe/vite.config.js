import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  root: __dirname,
  cacheDir: resolve(__dirname, 'node_modules/.vite'),
  plugins: [react()],
  server: {
    port: 5173
  }
});
