# Shared card-meta resolver (`server/utils/cardMeta.ts` + `scryfallFetch.ts`)

2026-09-18: extracted `resolveFunctionalModelCardMeta` (functional-model
card NAME -> real `{set, collectorNumber, image}`) out of
`server/api/card/[set]/[number].ts`'s own private implementation into
`server/utils/cardMeta.ts`, and the paced live-Scryfall `scryfallFetch`
wrapper into `server/utils/scryfallFetch.ts`. Both are real shared modules
now — `server/api/card/[set]/[number].ts` imports them (no private copy
left behind, unlike the earlier `fdnDefinitionPool` extraction which
deliberately left a private copy in place to avoid an unrelated edit;
here the origin file needed touching anyway).

**Why this matters for future work**: `resolveFunctionalModelCardMeta` is
the ONE correct way to turn a card name into a real, clickable
`/app/card/<set>/<number>` route + thumbnail anywhere in this app —
3-leg resolution (FIN's own `fin_scryfall.json`, then `data/cards.db`,
then a live paced Scryfall call), forever-per-process cached. Any new
route/page that needs to render a list of card-name matches with real
thumbnails should import this, never build its own live per-card Scryfall
fetch (client OR server) — a client-side live-fetch-per-card was exactly
the bug that motivated this extraction (`EngineConsoleCardMatchChip.vue`,
deleted, fired 111 simultaneous live Scryfall image requests for one wide
match list). `scryfallFetch`'s pacing is intentionally a SHARED
per-process singleton (module-level `lastScryfallStart`) — every importer
draws down the same 110ms clock, not an independent one, because the
whole point is staying under Scryfall's real ~10req/s guideline for the
process as a whole.

**Second consumer**: `server/api/sink-catalog/index.get.ts`'s
`computeRealMatches`/`enrichMatchNames` (producer/consumer match
enrichment for the sink-catalog review page) — first real proof this
extraction generalizes beyond the one route it came from.

**Paired client-side component**: `app/components/CardMatchGallery.vue`
(the actual thumbnail-gallery rendering — NuxtLink/img/self-ring/text-
fallback) — the consumer of this resolver's own `{card, image, set?,
collectorNumber?, self?}` output shape. `CardDetailTabs.vue`'s FDN "Sinks"
section and the sink-catalog review page both import it now. Any new
match-list UI should reuse this component too, not hand-roll a new one —
the user's own explicit instruction after the chip regression: "don't
spawn new components that look like shit."
