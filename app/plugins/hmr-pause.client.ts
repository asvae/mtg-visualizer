// Defers Vite's own HMR updates while the tab is backgrounded (dev only —
// `import.meta.hot` is undefined in a prod build, whole file is a no-op
// there). Vite's client applies a JS/CSS hot update only after
// `notifyListeners("vite:beforeUpdate", ...)` resolves (node_modules/vite/
// dist/client/client.mjs) — a listener returning a pending Promise stalls
// the swap until it resolves. Full reloads go through a SEPARATE event,
// `vite:beforeFullReload`, so both need the same gate — one alone still
// lets the other kind through while hidden. Both are part of Vite's public
// HMR API (vite.dev/guide/api-hmr.html), not internals-reliant.
export default defineNuxtPlugin(() => {
  if (!import.meta.hot) return;

  let resolveVisible: (() => void) | null = null;

  const waitForVisible = () =>
    document.hidden
      ? new Promise<void>((resolve) => {
          resolveVisible = resolve;
        })
      : Promise.resolve();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      resolveVisible?.();
      resolveVisible = null;
    }
  });

  import.meta.hot.on('vite:beforeUpdate', waitForVisible);
  import.meta.hot.on('vite:beforeFullReload', waitForVisible);
});
