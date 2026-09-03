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
