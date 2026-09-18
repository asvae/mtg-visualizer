# FDN justification.json authoring — batch B, 28 cards (2026-09-18)

One of 3 concurrent, disjoint-slug batches (A/B/C) all authoring
`functional-model/fdn-cards/<slug>/justification.json` against the same
tree at once — did NOT run `--all` (would race with the other two), only
gated this batch's own 28 slugs explicitly via `gate-and-write-status.mjs
<slug> <slug> ...`. Pool-wide blue/purple/gray totals are therefore
STALE the moment this lands — don't trust any pre-2026-09-18-batches
count in this memory file for a total; re-derive via a fresh `--all` run
once all 3 batches have landed.

**This batch's own 28 slugs, outcome: 13 blue / 15 purple / 0 gray / 0
other**: abyssal-harvester, aetherize, ajani-caller-of-the-pride,
ajani-s-pridemate, alesha-who-laughs-at-fate, ambush-wolf,
angel-of-finality, anthem-of-champions, apothecary-stomper,
arcane-epiphany, archmage-of-runes, armasaur-guide, ashroot-animist,
battlesong-berserker, beast-kin-ranger, bigfin-bouncer,
bloodthirsty-conqueror, boltwave, bulk-up, cat-collector,
cathar-commando, celestial-armor, chandra-flameshaper, clinquant-skymage,
courageous-goblin, crackling-cyclops, curator-of-destinies,
dauntless-veteran. Blue (13): ajani-caller-of-the-pride,
alesha-who-laughs-at-fate, ambush-wolf, anthem-of-champions,
apothecary-stomper, arcane-epiphany, ashroot-animist, bigfin-bouncer,
boltwave, bulk-up, cathar-commando, celestial-armor, dauntless-veteran.

**4 previously-flagged undeclared gaps (from the same-day NOTES.md
comment-cleanup sweep) closed via real `missingSchemaFunctionality`
entries, all judged genuine (option b, not declaratively fixable)**:
abyssal-harvester (copy-a-permanent-with-overrides + graveyard-this-turn
filter + self-token-sweep), archmage-of-runes (SpellCostReductionGrant
has no card-TYPE gate, only color), courageous-goblin (no
BoardStateCondition kind for a live creature-power threshold),
curator-of-destinies (2 entries: can't-be-countered has no replacement-
effect vocabulary; the two-pile/opponent-choice ETB has no pile
primitive).

**3 MORE genuine gaps found+declared this same pass that were NOT on the
task's own flagged list, same exact "custom no-op placeholder with prose
but no missingSchemaFunctionality" pattern**: aetherize (`move` has no
"attacking creatures" predicate, no mixed-owner return semantics),
angel-of-finality ("exile target player's graveyard" needs a
target-a-PLAYER-then-clear-their-whole-zone primitive `move`'s
card-selection shape can't express), and — the most substantial —
**chandra-flameshaper had ZERO functional representation of any of its 3
loyalty abilities at all** (just `name`/`manaCost`/`typeLine`, same
"completely absent from CardDefinition" pattern
`fdn-notes-md-comment-convention.md`'s own writeup flagged for
`high-fae-trickster` as worth checking elsewhere). Built real `abilities`
structure: `+2`'s "Add {R}{R}{R}" half is now a real `addMana` effect,
its own "exile top 3, choose one, may play" half + `+1`'s whole copy-token
effect + `-4`'s whole divided-damage effect are 3 new
`missingSchemaFunctionality` entries (impulse draw; copy-with-overrides,
same gap abyssal-harvester needs; divided damage among a chosen number of
creature-and/or-planeswalker targets, `dealDamageTarget` only ever hits
one creature). Old NOTES.md's own "(1) Loyalty cost syntax... (2) Loyalty
counter tracking... (3) Ultimate/emblem support" framing was corrected —
(1)/(2) are the SAME recognized-but-inert "Ward pattern"
`abilities[].cost`/loyalty-counters already establish pool-wide (Ajani/
Kaito precedent), not real declared gaps; (3) doesn't even apply (no
emblem printed on this card). Rewrote that file's own prose to match.

**One real pre-existing bug found+fixed**: `angel-of-finality`'s
`keywords: ['flying']` (lowercase) — not a real `Keyword` union member,
would have failed the gate's own scoped `tsc` check (Part 2) once the
missingSchemaFunctionality/name-only-trigger vocabulary walk passed.
Fixed to `'Flying'`.

**Policy applied, consistent with existing pool precedent (arahbo/
skyknight-squire's own Ward-class reasoning)**: a NAME-ONLY `Trigger` (no
real `on` dispatch value) is left as real, honest `type:'definition'`
coverage referencing `{kind:'trigger', name:...}` — NOT given its own
redundant `missingSchemaFunctionality` entry, since the FDN gate's own
`findNameOnlyTriggerGapReasons` already classifies it as a capacity gap
automatically (mirrors how Ward's own unenforced-but-real keyword needs no
separate declaration either). Real cards landing at purple THIS way in
this batch (no missingSchemaFunctionality authored, purely automatic):
ajani-s-pridemate, armasaur-guide, battlesong-berserker, beast-kin-ranger,
bloodthirsty-conqueror, cat-collector, clinquant-skymage,
crackling-cyclops (plus courageous-goblin/archmage-of-runes, which ALSO
carry a real declared gap independently).

**Verification discipline used**: a small scratch helper script (per-slug
literal substring list -> `indexOf`-resolved spans against the REAL
`data/fdn/fdn_scryfall.json` text, with the same tiling/gap/overlap check
`coverage-justification.ts` itself runs) computed every span — no
hand-typed offsets. Every card individually verified via
`verify-coverage-justification-cli.mjs` before gating. Full
`npx vitest run functional-model`: 122 files/1314 passed/5 skipped,
unaffected. `npx tsc --noEmit -p .nuxt/tsconfig.server.json`: same 4
pre-existing diagnostics (card-status.ts:263, card.ts's endTurn literal,
mana.ts:275, server/api/tokens/by-key.ts:32) — 0 new. Commit `43ec470`,
scoped to exactly these 28 slugs' 64 files (checked via `git diff --cached
--name-status` before committing — two sibling batches had uncommitted
edits to other slugs in the same tree at commit time, left untouched).
