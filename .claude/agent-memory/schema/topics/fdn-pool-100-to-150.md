# FDN pool extended 100 -> 150 (2026-09-18)

Real selection convention confirmed by cross-referencing `data/cards.db`
(gitignored local bulk sync — NOT `data/fdn/fdn_scryfall.json`, which only
ever holds the subset already synced into the pipeline, confirmed 100/100
before this task, now 150/150) against the existing 100 slugs' own real
card names: the systematic batch (the "FDN: author 100 card definitions"
commit, 89 files) is exactly real FDN collector numbers **1-91,
contiguous**, minus 2 already authored earlier (`felidar-savior`/#12,
`helpful-hunter`/#16). The OTHER 9 pre-existing cards (Ajani's Pridemate,
Angel of Finality, Day of Judgment, Healer's Hawk, Make Your Move, Serra
Angel, Aetherize, Essence Scatter, Fleeting Distraction — collector #s
135/136/140/142/143/147/151/153/155) are a separate, earlier, hand-picked
"wire FDN into the Cards tab" demo batch, NOT part of the sequential run —
confirmed via `git log --diff-filter=A` (3 distinct commits, chronological:
10-card demo batch first, then `felidar-savior` solo, then the 89-card
systematic batch last). **The next 50 in the same sequential convention is
collector #92-146, skipping the 3 demo-batch numbers that fall inside that
window (135/136/140)** — NOT 92-141, which would have only yielded 47 new
names.

All 50 new `fdn-cards/<slug>/definition.ts` authored from real Forge
scripts (`tmp/mtg-forge/forge-gui/res/cardsfolder/<letter>/<slug>.txt` —
confirmed present for all 50, FDN is in this checkout despite being
2026-current). Zero `staticAbilities` usage (hard FDN policy violation,
checked). 23/50 declare a real `missingSchemaFunctionality` entry for a
genuinely open gap; 27/50 use only existing (old + 2026-09-18
schema-completeness-pass) vocabulary with zero gaps. New real capacity
gaps surfaced this pass, not previously documented anywhere in this pool:
Morbid ("did a creature die this turn" — recurs on 5 cards: Slumbering
Cerberus, Cackling Prowler, Needletooth Pack, Wardens of the Cycle, plus
the pre-existing `tragic-banshee`), a genuine delayed-trigger primitive
(Kykar's "return at the beginning of the next end step"), MayPlay-style
standing permissions (Strongbox Raider — same family as
`zul-ashur-lich-lord`/`tinybones-bauble-burglar`'s already-known gap), a
board-wide "creature dealt combat damage, put counters on IT" watch
(Quilled Greatwurm), life-total-conditional statics (Elenda), "grant an
arbitrary activated ability to another permanent" (Fishing Pole), a
CR 614.12-style ETB-counter-count replacement on ANOTHER permanent (Giada),
a "remember a player-chosen creature type" primitive (Banner of Kinship),
an unless-cost player choice (Perforating Artist — "loses life unless that
player sacrifices/discards"), a cross-controller ETB-tapped replacement
(Authority of the Consuls), a CR 603.6e linked "until this leaves the
battlefield" duration (Banishing Light), no counterspell-immunity
mechanism (Koma), no max-hand-size tracking (Niv-Mizzet), no
target-bound-object counter-doubling (Zimone's activated ability — the ETB
trigger half IS expressible via the existing `selectUpTo`/`applyToBound`
DSL, mirrors `felidar-savior`), no animate-with-P/T-override or "all
creature types" primitive (Soulstone Sanctuary), an extra-land-drop static
field (Loot), an opening-hand/game-setup special action (Leyline Axe), and
a qualified "hexproof from instants" Keyword variant (Elenda — plain
`'Hexproof'` would overclaim). None of these were flagged/handed to
`engine` for a verdict on ENGINE_GAPS.md tracking within this task's own
scope — a future pass should triage which of these (Morbid especially,
recurring 5x) are worth a numbered `ENGINE_GAPS.md` entry vs. staying
per-card `missingSchemaFunctionality` text.

**FDN-only gate detail worth remembering**: `findNameOnlyTriggerGapReasons`
(`validate-card-definition.mjs`) flags EVERY bare name-only trigger (no
`Trigger.on`) as a capacity-gap reason — this is FDN-specific, NOT the
same "bare name-only trigger is a legitimate non-gap FIN pattern" rule my
own `current.md` used to imply pool-wide. Doesn't matter for THIS batch
(no justification.json authored, so `incomplete-authoring`/`gray` wins
regardless — confirmed via `exemplar-of-light`, a real pre-existing card
with 2 bare name-only triggers that still lands at plain `gray`), but
matters the day someone writes a `justification.json` for one of these 50
and expects `purple`/`blue`.

No `justification.json` authored for any of the 50 (matches the pool's own
16/100 ratio — that file stays a separate, later, deliberately-scoped
pass, same discipline the 2026-09-18 schema-tightness redesign already
established). Ran `sync-fdn-oracle-text.mjs` (no args = whole pool) to add
the 50 new cards' real oracle text to the durable, checked-in
`data/fdn/fdn_scryfall.json` (150/150 resolved) — needed by any FUTURE
`justification.json` pass, not required for this one, but free/cheap to
keep in parity with the other 100.

Re-gated via `gate-and-write-status.mjs --all`: **13 blue / 3 purple / 134
gray / 0 other / 0 missing-file, 150 total** (unchanged blue/purple count —
none of the 50 reach past gray without a manifest). `npx vitest run
functional-model`: 122 files/1314 passed/5 skipped (identical to
pre-task baseline). `npm run typecheck`: same 7 pre-existing diagnostics
(confirmed via `git stash`/`git stash pop` A-B compare), zero new/reduced.

Committed as 2 commits: (1) the 50 new cards + their `pipeline-status.json`
+ the `fdn_scryfall.json` sync, (2) the pre-existing 100 cards'
`pipeline-status.json` pure-timestamp churn from the same `--all` re-gate
run (verified via `comm` that the 100 unstaged M's have zero overlap with
the 50 new slugs before splitting).
