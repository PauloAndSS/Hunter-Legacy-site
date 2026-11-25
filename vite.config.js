import { defineConfig } from 'vite';

export default defineConfig({
  // Base relativa: o mesmo build funciona na raiz de um domínio e em /<repositório>/ (GitHub Pages).
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
});
