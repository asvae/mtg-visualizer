# Schema-completeness pass over the FDN pool's real gaps (2026-09-18)

Surveyed every `missingSchemaFunctionality` entry across the 100-card FDN
pool (20 cards had real entries) and clustered them. Closed the clusters
that were genuinely additive/low-risk; left the rest declared-but-open
(see "Not closed" below). `fdn-cards/*/definition.ts` content was NOT
touched (out of scope for this pass — deliberately a "next step" for a
future card-authoring pass), with the sole allowed exception (a masked
`tsc`-error fix) turning out to need zero edits at all (see below).

## Closed

**1. Keyword cost-payload (`card.ts`)** — new `KeywordCost {keyword,
cost}` interface + `CardDefinition.keywordCosts?: KeywordCost[]`, a
SEPARATE sibling field to `keywords`, NOT a payload folded onto `Keyword`
itself. Checked first: `.keywords.includes('Ward')`-style bare-string
reads exist at dozens of real call sites (`state.ts`, `engine.ts`,
`synergy.ts`, `coverage-justification.ts`, several
`recognizers/*-structural.ts`, FIN's own keyword-scenario fixtures) —
widening the array ELEMENT type would have broken several of those
(`KEYWORD_WORD[k]`-style lookups can't index by an object). The additive
sibling field costs nothing at any of those sites. Unblocks (schema-side;
none re-authored): `sire-of-seven-deaths`, `zul-ashur-lich-lord` (Ward
non-default cost), `sun-blessed-healer` (Kicker cost) — plus
`divine-resilience`'s own masked `tsc` error (`keywords: ['Kicker']`) is
now genuinely fixed FOR FREE, zero edits needed, once `'Kicker'` became a
real `Keyword` member (confirmed via a scoped `tsc -p` check against just
that file, same `.nuxt/tsconfig.server.json`-extending config the FDN
gate itself uses — zero errors against that file specifically).

**2. `Keyword` union additions**: `'Kicker'`, `'Prowess'`, `'CantBlock'`
— each a plain new literal (zero blast radius, additive only). Prowess
unblocks `elementalist-adept`/`drake-hatcher` (both declared the same
gap); its own auto-fire half is NOT new — already tracked under
`ENGINE_GAPS.md`'s "trigger-doubling" writeup's own `castNoncreatureSpell`
paragraph (17+ FIN cards share it), cited there, no new numbered entry
added. CantBlock unblocks `vampire-soulcaller` (1 card, added anyway —
cheap, mirrors `'Unblockable'`'s existing precedent for the opposite
combat-declaration side).

**3. `BoardStateCondition` (`card.ts`)** — new type,
`Trigger.condition?` + `ContinuousGrantTargeting.condition?` (both
purely additive). 3 variants: `graveyardCountAtLeast` (Threshold),
`attackedThisTurn` (Raid), `selfCounterCountAtLeast` (skyknight-squire's
own counter-count gate). Declaratively real but NOT engine-enforced
(`resolveCard` has no live `GameState` param; "attacked this turn" needs
real per-turn combat-history tracking `interfaces.ts`'s own `Player` has
no method for — checked directly). Unblocks: `crypt-feaster`,
`midnight-snack`, `gutless-plunderer` (Trigger.condition, Raid/
Threshold); `billowing-shriekmass`, `cephalid-inkmage`, `skyknight-squire`
(ContinuousGrantTargeting.condition — the P/T-bonus, can't-be-blocked, and
counter-gated flying/Knight-type-grant halves respectively).

**4. `Trigger.on: 'otherPermanentEnters'`** + new
`otherPermanentEntersMatch?: {subtype?, nonToken?, sameController?}` — a
board-wide watch-trigger for some OTHER permanent's entrance, genuinely
distinct from the pre-existing self-only `on:'enter'`. Unblocks
`arahbo-the-first-fang` (already-declared gap) and closes the SAME silent,
undeclared gap `skyknight-squire`'s own `onEnter` trigger has (comment-
only, never declared via `missingSchemaFunctionality` — flagged in the
prior schema-tightness pass, still not authored onto that card; the
vocabulary to fix it now exists for the next authoring pass). NOT
engine-dispatched (Ward pattern).

**5. `combinator.ts`: `Query.source` gains `'graveyard'`** — genuinely
REAL/engine-enforced (not Ward-pattern): `resolveQuery` already has real
`Player` objects in scope and every other `source` value already calls a
sibling `Player.getCardsIn(...)` method; `'graveyard'` just reads
`getCardsIn('Graveyard')`. Lets a Threshold-style ONE-SHOT (triggered/
cast) effect be expressed as genuine `program`/`branch`/`compare`/
`Aggregate` logic — does NOT by itself make a CONTINUOUS static ability
live-conditional (that's `BoardStateCondition` above; a `program` only
runs at one resolution moment).

**6. `engine-support-registry.ts`**: 5 new entries —
`kicker-not-enforced`, `prowess-not-enforced`, `cant-block-not-enforced`,
`board-state-condition-not-enforced` (checks `Trigger.condition` +
all 3 `continuous*Grants` families' own `.condition`, both faces),
`other-permanent-enters-trigger-not-enforced`. `ward-not-enforced`
untouched. `engine-support-registry.test.ts` updated (the "seeded with
exactly the one Ward entry" pin test now expects all 6; added coverage
for each new matcher including a backFace-only case per new entry).

## Not closed (flagged, not attempted this pass)

- `crystal-barricade`'s player-level hexproof grant + "prevent noncombat
  damage to OTHER creatures" — genuinely novel PLAYER-level static-grant
  primitive (every existing grant family targets a PERMANENT); no
  existing cluster to fold into, single-card gap. Good `ENGINE_GAPS.md`
  candidate if `engine` agrees it's worth tracking as its own general
  mechanism.
- `herald-of-eternal-dawn`'s "can't lose/opponents can't win" — a real
  state-based-action/game-loss override, touches `engine`'s own SBA
  machinery conceptually; single-card gap, not attempted.
- `arbiter-of-woe`'s "additional cost: sacrifice a creature" (a spell's
  own normal-cast ADDITIONAL cost, distinct from `AlternateCost`'s
  REPLACEMENT-cost shape and `activationCost`) and `blasphemous-edict`'s
  board-state-conditional alternate cost (`AlternateCost` today is
  zone-based only) — both single-card, both real, both deferred rather
  than rushed under this pass's time budget.
- `tinybones-bauble-burglar` / `zul-ashur-lich-lord`'s own MayPlay/
  standing-permission-to-cast-a-card-you-don't-own gap (+ "mana of any
  type" cost override) — already-known, genuinely large, cross-cutting
  primitive (both cards' own comments/gap text independently name it);
  not attempted, matches `ENGINE_GAPS.md`'s own posture toward similarly
  large deferred mechanisms.

## Verification

`npx vitest run functional-model`: 122 files / 1314 passed / 5 skipped,
clean. `npm run typecheck`: same 7 pre-existing diagnostics as the
pre-change baseline (confirmed via `git stash` A/B comparison) — zero
regression, zero reduction (the `card.ts` `endTurn`-exhaustiveness one
just shifted line number). Did NOT run the FDN gate or re-author any
card — that's explicitly the next step, not this task.
