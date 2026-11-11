import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'www',
  build: {
    outDir: path.resolve(__dirname, 'www'),
    emptyOutDir: false,
  },
  server: {
    port: 5173,
  },
});
