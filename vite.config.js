import { defineConfig } from 'vite';

// Base path for GitHub Pages — repo is `wackygolf`, served at
// https://<username>.github.io/wackygolf/
// In `npm run dev` Vite uses '/' regardless of this value.
export default defineConfig({
  base: '/wackygolf/',
  server: {
    host: true,   // allows phone on same Wi-Fi to hit dev server
    port: 5173,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: true,
  },
});
