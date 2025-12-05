import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        revision: resolve(__dirname, 'revision.html'),
        bibliografia: resolve(__dirname, 'bibliografia.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
}); 