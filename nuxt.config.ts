import { execFileSync } from 'node:child_process';
import packageJson from './package.json';

function getBuildCommit(): string {
  const deploymentCommit = process.env.COMMIT_REF;
  if (deploymentCommit) return deploymentCommit.slice(0, 7);

  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

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
  app: {
    head: {
      // Same three-node triangle mark AppHeader.vue's own logo draws inline
      // (produce/consume/magnifier-colored dots) — public/favicon.svg, not
      // Nuxt's default favicon.ico convention, since there's no .ico here.
      // EB Garamond — a free old-style serif, the closest freely-licensed
      // stand-in for real Magic cards' own MPlantin rules-text font (which
      // isn't freely distributable). Used only by FunctionalModelText.vue's
      // annotated oracle-text readout.
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      appVersion: packageJson.version,
      buildCommit: getBuildCommit(),
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
    // Both the exact path and everything under it (e.g. the card detail
    // page) need this — the store they all share reads window.location/
    // localStorage regardless of which one is current.
    '/app': { ssr: false },
    '/app/**': { ssr: false },
  },
  nitro: {
    preset: 'netlify',
  },
});
