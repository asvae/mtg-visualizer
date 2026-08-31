# Changelog

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
follow [SemVer](https://semver.org/). Versions are bumped manually (`package.json`
`version` + this file, in the same commit) — nothing here is auto-generated from
commits or tags.

## [Unreleased]

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
