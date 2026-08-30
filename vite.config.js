import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue(),
    // Vite's dev server falls back to root index.html (the landing page) for
    // any path it doesn't recognize as a file — "/app" (no trailing slash)
    // doesn't match the app/index.html entry, so it silently served the
    // landing page instead of redirecting like a real static host would.
    {
      name: 'redirect-app-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/app') {
            res.writeHead(301, { Location: '/app/' });
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
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
