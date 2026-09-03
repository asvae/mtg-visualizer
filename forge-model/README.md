# Forge model

Real card scripts from [Card-Forge/forge](https://github.com/Card-Forge/forge)
(`forge-gui/res/cardsfolder`, GPL-3.0), copied verbatim for the same FIN cards
`synergy-model/data/edges.json` decomposes — FIN is the real *Final Fantasy*
Universes Beyond set, not homebrew, so Forge already has these scripted for
its own rules engine. Kept here unmodified so the card detail page can render
Forge's actual data-driven ability format next to synergy-model's node/flow
graph for comparison. Not re-validated against a running Forge instance;
any parsing quirks are a limitation of `app/lib/forgeScript.ts`, not of the
source data.

File naming matches `synergy-model`'s own convention: `slugify(card.name)`
(`app/lib/buildGraph.ts`) + `.txt`.

See the card page's "Forge model" column for the rendered outline, and its
"Raw Forge script" spoiler for the untouched source text.

## Cards outside FIN

`arahbo-the-first-fang.txt` / `slashing-tiger.txt` are real cards from other
sets (Foundations / Modern Horizons 3, not FIN), added as a worked example
for `app/lib/synergyInteractions.ts` (the cross-card join). They have no
hand-authored entry in `synergy-model/data/edges.json` — the card page falls
back to translating their Forge script on the fly via
`app/lib/forgeTranslate.ts` (see `server/api/card/[set]/[number].ts`), shown
with the same "not yet human-reviewed" treatment an AI decomposition gets.

## Pools (`pools/*.json`)

The interactions join needs every OTHER card's synergy data available at
once (see `synergyInteractions.ts`'s own header) — `pools/fdn-cats.json` and
`pools/blb.json` are curated (FDN) or entire real (BLB, all 274 cards) sets
this session prepared Forge scripts for, one file per pool, each entry
`{ name, typeLine, set, collectorNumber, image }`. `server/api/card/[set]/[number].ts`'s
`POOL_FILES` lists which files are wired in; adding a new set is: fetch its
real card list from Scryfall, match each name to a script in a local
`Card-Forge/forge` checkout (`forge-gui/res/cardsfolder/<letter>/<slug>.txt`,
Forge's own slug rule — lowercase, drop `'`/`,` entirely, everything else
non-alphanumeric → `_`), copy into `data/`, write the pool JSON, then run
`translateForgeCard` over every entry to sanity-check nothing crashes.

`image` is precomputed, not fetched live at request time — an earlier
version called Scryfall per match on every cold page view, which both added
real latency (tens of seconds for a densely-matching card once queued behind
Scryfall's 10-requests/second guideline) and once tripped an actual 429
block mid-session. Regenerate all of a pool's images after adding cards to
it (same 110ms-paced request pattern `server/api/card/[set]/[number].ts`'s
`scryfallFetch` already uses, just run once ahead of time rather than per
request) rather than reverting to a live per-request fetch.

`POOL_TOKEN_REGISTRY` (also in `server/api/card/[set]/[number].ts`) is the
same idea for TokenScript$ ids a pool's own cards create — matched against
that set's real dedicated token sheet on Scryfall (`set:tfdn`/`set:tblb`,
etc.), not synthesized.
