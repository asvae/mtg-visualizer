// Hybrid rendering: SSR stays on by default (needed for the landing page's
// prerendering below to actually capture real markup — a global `ssr: false`
// disables Nuxt's whole server-render pipeline at the build level, so a
// per-route override back to `ssr: true` doesn't reliably work; going the
// other way — default on, opt specific routes out — is the well-supported
// direction), and just the graph app opts out via routeRules, since its store
// (app/composables/useGraphStore.ts) reads window.location/localStorage
// throughout and has nothing to gain from server rendering anyway.
export default defineNuxtConfig({
  compatibilityDate: '2026-08-31',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // The review panel is a tagging-workflow tool, not something an end
      // visitor to a deployed copy of the app should see — override locally
      // via NUXT_PUBLIC_ENABLE_REVIEW=true in .env; unset (false) in prod.
      enableReview: false,
    },
  },
  routeRules: {
    // Landing page has real content worth crawling/sharing (og previews) —
    // prerender it at build time so the shipped HTML has the real markup,
    // not just an empty SPA shell.
    '/': { prerender: true },
    // Graph app: pure client-side D3/canvas, SPA-only (see comment above).
    '/app': { ssr: false },
  },
  nitro: {
    preset: 'netlify',
  },
});
