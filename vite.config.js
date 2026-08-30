import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  publicDir: 'data',
  // Two-page site: / is the archetype landing page (plain HTML, no Vue), /app/
  // is the actual graph visualizer (index.html moved to app/index.html — Vite
  // resolves that at /app/ automatically in dev; the build needs both entries
  // listed explicitly, otherwise it only emits whichever page rollup discovers
  // by following root index.html's own links, which is neither of these.)
  build: {
    rollupOptions: {
      input: {
        landing: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app/index.html', import.meta.url)),
      },
    },
  },
  server: {
    watch: {
      // WSL: inotify doesn't fire reliably across the /mnt/c NTFS mount,
      // so file edits silently never invalidate Vite's module cache without polling.
      usePolling: true,
      interval: 300,
    },
  },
});
