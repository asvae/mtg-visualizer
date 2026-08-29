import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  publicDir: 'data',
  server: {
    watch: {
      // WSL: inotify doesn't fire reliably across the /mnt/c NTFS mount,
      // so file edits silently never invalidate Vite's module cache without polling.
      usePolling: true,
      interval: 300,
    },
  },
});
