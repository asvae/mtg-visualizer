# Engine console: real card-thumbnail chips for name-only match lists

2026-09-18. `app/pages/app/engine/sinks/[[slug]].vue`'s "Real FDN pool
matches" section (`producerMatches`/`consumerMatches`, plain `string[]`
card names, see `server/api/sink-catalog/index.get.ts`'s own
`SinkCatalogRealMatches`) used to render each match as a bare mono-font
text `<li>`. Replaced with `app/components/engine-console/
EngineConsoleCardMatchChip.vue` — a small, real card representation:
lazy-loaded Scryfall thumbnail + legible name, linking to
`/app/engine/cards/fdn/<number>` when resolvable.

## Design

- **Thumbnail**: Scryfall's own documented "drop straight into `<img
  src>`" redirect, `https://api.scryfall.com/cards/named?exact=<name>
  &format=image&version=small` — no server involvement, no JSON round-trip,
  same direct-hotlink-to-Scryfall-CDN posture `CardMedia.vue` already uses
  for the full card image elsewhere. `loading="lazy"` + sitting inside a
  collapsed `<details>` means it's cheap even with dozens of matches.
  `@error` degrades to a placeholder swatch (diagonal-stripe box, same
  visual language `CardImageSkeleton.vue` uses) rather than a broken-image
  icon — a handful of real match names won't resolve cleanly against
  Scryfall's `exact` lookup.
- **Link target**: the match list is only real card NAMES, no set/number —
  needed a name->number lookup. Built client-side in the page itself via
  `useFetch('/api/card-status/fdn', { immediate: isDev })` (the SAME
  endpoint the sibling `/app/engine/cards/fdn` tab already fetches per
  visit) — ONE request for the whole page, not per-row, then a plain
  `Map<name, number>` computed off it. `immediate: isDev` skips the
  request in production, where `realMatches` is always `undefined` anyway.
- **Gotcha**: `<component :is="href ? 'NuxtLink' : 'span'">` does NOT
  resolve `'NuxtLink'` as the real component — it renders a literal,
  unhydrated `<nuxtlink>` custom element (no real `<a>`, no navigation;
  verified live via Playwright). Had to split into two real template
  branches (`v-if="href"` NuxtLink / `v-else` span), same pattern
  `RecognizerEntryCard.vue`'s own matched-card chip list already
  established for its own "not every match resolves to a route" case —
  don't reach for dynamic `:is` with a bare component-name string again.
- Kept in `app/components/engine-console/` (not the top-level
  `app/components/`) since it's specific to this console's
  producer/consumer match-list convention, matching `EngineConsole*`
  naming.

Verified live (Playwright): `lifegain` entry's producer/consumer chips
show real card art + real names, click on "Ajani's Pridemate" navigates to
`/app/engine/cards/fdn/135` and renders that exact card. `npm run
typecheck` stayed at the known 7-diagnostic baseline (all pre-existing,
unrelated files).
