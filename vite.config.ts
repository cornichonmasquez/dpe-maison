import { defineConfig } from 'vite';

// L'application vit dans app/ et importe le code partagé de src/.
export default defineConfig({
  root: 'app',
  base: './',
  server: { port: 4173, strictPort: true, fs: { allow: ['..'] } },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' }
});
