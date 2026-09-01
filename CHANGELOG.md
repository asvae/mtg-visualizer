# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
follow [SemVer](https://semver.org/). Versions are bumped manually (`package.json`
`version` + this file, in the same commit) — nothing here is auto-generated from
commits or tags.

## [Unreleased]

- Added a standalone card detail page: `/api/card/[set]/[number]` (Scryfall + relations
  + shorthand in one request) replaces `/app/card/[set]/[number]`'s dependency on the
  client-side graph store, so a direct link works without visiting `/app`
  first. `CardMediaRelations.vue` split into `CardMedia.vue`/`CardRelations.vue`
  to support this.
- Added the card shorthand notation system for homebrew card text —
  see [`CARD_SHORTHAND.md`](CARD_SHORTHAND.md), `data/card_shorthands.json`,
  `data/card_shorthand_status.json`, and the `MtgIcon.vue` component (Mana
  font icons, Storybook autodocs enabled for it and other components).
  Drafted through 41 of FIN's 312 cards plus one homebrew card. Along the
  way: `ManaSymbol.vue` renders literal `{X}` mana/cost symbols from real
  oracle text the way scryfall.com renders its own — official symbol SVGs
  inlined as base64 data URIs (`data/mana_symbols/manifest.json`, via
  `npm run fetch:mana-symbols` / `scripts/fetch-mana-symbols.mjs`) rather
  than a third-party font recreation — no curation needed per symbol; a
  documented
  em-dash convention for every trigger header; a face-separator format for
  modal DFCs/transforming cards; an orange left-border on the card page
  while a card's shorthand is `review: "ai"` (not yet human-reviewed); and
  several MTG-community-standard verbs adopted as tokens (`[Reanimate]`,
  `[Donate]`, `[bounce]`, `burns`, `stuns`). Two borrowed stand-in icons
  (Keyrune's Ixalan symbol for "target", mana-font's "d" glyph for a modal's
  "Choose one —") were tried and reverted — both stay plain text.
- Fixed dev-server/Storybook HMR silently missing file changes on WSL's
  DrvFs mount — Vite watchers now use polling (`nuxt.config.ts`,
  `.storybook/main.ts`).
- Added `scripts/generate-set-status.mjs` (`npm run set-status`), regenerating
  [`SET_STATUS.md`](SET_STATUS.md) — per-set enrichment/review status, cross-
  referenced from `tagging/card-enrichment-status.json`.
- Removed `UI_AGENT_NOTES.md` — stale (predated the Nuxt 4 migration); its
  still-relevant content is covered by README's "App architecture" section.

## [0.1.0] - 2026-08-31

Initial release: force-directed graph visualizer for a Magic: the Gathering
set's card/theme synergies (built around Final Fantasy, `FIN`), plus the
hand/agent-authored tagging pipeline and review tooling behind it.

- Client-side graph build (`app/lib/buildGraph.ts`) from raw Scryfall data,
  curated theme relations, and auto-derived creature-type themes.
- Scryfall-query mode (`?sf=<query>` / 🔍) resolving an arbitrary search
  against the tagged corpus via `server/api/cards.ts`.
- Filter panel (colors/rarities/types/themes), two-way synced to the URL
  query string and `localStorage` per set code.
- Card/theme selection, hover relation tooltips, weak-theme anchoring in the
  D3 force simulation.
- Tagging review workflow: CLI (`scripts/review-card.mjs`), in-app review
  panel driven by `scripts/review-server.mjs`, and structural sanity checks
  (`scripts/relations.test.mjs`).
- Migrated to Nuxt 4; Nuxt UI-based redesign of the app header and filter UI.
