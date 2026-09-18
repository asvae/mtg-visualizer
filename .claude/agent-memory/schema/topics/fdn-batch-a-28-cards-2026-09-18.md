# FDN justification.json authoring — batch A, 28 cards (2026-09-18)

One of 3 concurrent, disjoint-slug batches (A/B/C) all authoring
`functional-model/fdn-cards/<slug>/justification.json` against the same
tree at once — did NOT run `--all` (would race with the other two), only
gated this batch's own 28 slugs explicitly via `gate-and-write-status.mjs
<slug> <slug> ...`. Pool-wide blue/purple/gray totals are therefore
STALE the moment this lands — don't trust any pre-2026-09-18-batches
count for a total; re-derive via a fresh `--all` run once all 3 batches
have landed.

**This batch's own 28 slugs, outcome: 17 blue / 11 purple / 0 gray / 0
other**: day-of-judgment, dazzling-angel, divine-resilience,
dragon-trainer, dreadwing-scavenger, eager-trufflesnout, electroduplicate,
elfsworn-giant, elvish-regrower, erudite-wizard, essence-scatter,
exemplar-of-light, faebloom-trick, felling-blow, fiendish-panda,
fiery-annihilation, fleeting-distraction, fleeting-flight,
goblin-boarders, goblin-negotiation, gorehorn-raider, grappling-kraken,
guarded-heir, hare-apparent, healer-s-hawk, helpful-hunter,
high-fae-trickster, high-society-hunter.

**Purple (11), all via the gate's own automatic name-only-trigger
capacity-gap rule** (`findNameOnlyTriggerGapReasons`, same policy batch B
already established — a bare-named `Trigger` with no real `on` dispatch
value is left as honest coverage referencing `{kind:'trigger', name:...}`,
never given its own redundant `missingSchemaFunctionality` entry, since
the gate already auto-classifies it): dazzling-angel, eager-trufflesnout,
elfsworn-giant, erudite-wizard, exemplar-of-light (2 such triggers),
fiendish-panda (2 such triggers), grappling-kraken, high-society-hunter.
Plus 2 cards purple via a genuinely DECLARED `missingSchemaFunctionality`
gap (below): divine-resilience, fiery-annihilation, high-fae-trickster.

**The 2 task-flagged undeclared gaps, resolved**:
- `fleeting-flight` — real fix, not a gap: "Prevent all combat damage
  that would be dealt to it this turn" is exactly `'CombatDamagePrevention'`
  (an existing `Keyword`, ENGINE_GAPS.md gap #8 already closed for this
  narrow subset, checked via `effectiveKeywords` at `state.dealDamage`).
  Replaced the old inert `custom` no-op with a real
  `grantKeywordTarget({keyword:'CombatDamagePrevention', untilEndOfTurn:
  true})` — no gap after all, lands `blue`.
- `high-fae-trickster` — genuine capacity gap, confirmed the hard way:
  grepped `card.ts` for any existing "cast spells as though..."/MayPlay-
  style caster-permission vocabulary (none — `continuousKeywordGrants`/
  `continuousPTGrants`/`continuousTypeGrants` all broadcast onto
  PERMANENTS on the battlefield, never onto a controller's own general
  casting rights over hand cards). Declared as a real
  `missingSchemaFunctionality` entry (was previously a genuine silent
  drop — no Effect, no gap declaration at all, only `keywords`). Caps at
  `purple`.

**3 more real, undeclared-until-now issues found the same way while
tiling, not on the task's own flagged list**:
- `goblin-negotiation` had a FULLY EMPTY `CardDefinition` beyond
  name/manaCost/typeLine (its own stale NOTES.md called it a 3-part
  capacity gap — X-cost support, excess-damage tracking, dynamic token
  count). All 3 turned out to be real, already-available primitives:
  `EffectContext.xPaid` (already declared, already used live by
  `cards/doppelgang`/`cards/rydia-summoner-of-mist`), `Card
  .getNetToughness()`, and `actions.createToken(..., excess)`. Built as
  one `custom` effect — no gap, lands `blue`.
- `divine-resilience` was missing its own `keywordCosts` entry for the
  printed Kicker cost (`card.ts`'s own `Kicker` doc comment literally
  cites this card as the motivating example — a masked omission, not
  just undocumented) — added. Its OTHER half, "any number of target
  creatures... gain indestructible," is a genuine gap (no "choose any
  number of targets" primitive — every targeted-effect shape here is
  either exactly-one or up-to-a-fixed-max) — declared via
  `missingSchemaFunctionality`, same `type:'rules'` +
  `{kind:'missingSchemaFunctionality'}` pattern chandra-flameshaper's own
  justification.json (batch B) already established for a no-op
  `custom`-backed clause.
- `fiery-annihilation` was flagged wholesale as a 3-part capacity gap;
  narrowed to ONE real gap. "Exile up to one target Equipment attached to
  that creature" IS representable (`Card.getEquippedBy()` — a real,
  already-declared `interfaces.ts` method) — combined with the damage
  clause into one `custom` effect (shared target, same "one local
  variable ties both clauses to the same creature" convention
  `felling-blow` already establishes). "If that creature would die this
  turn, exile it instead" is a genuine CR 614.2 death-REPLACEMENT gap
  (state.ts has narrow per-keyword damage/lifegain/untap replacement
  hooks, nothing intercepts the death/zone-change event itself) —
  declared via `missingSchemaFunctionality`.

**2 real, stale bugs found+fixed (Raid condition never wired)**:
`goblin-boarders`/`gorehorn-raider` both had an unconditional ETB effect
for a printed "Raid — ... if you attacked this turn" ability — missing
`Trigger.condition: {kind:'attackedThisTurn'}` entirely (real precedent:
gutless-plunderer's own identical Raid clause already uses it). Added to
both; both still land `blue` (the condition itself is a real, existing
`BoardStateCondition` vocabulary member, not a gap).

**Verification discipline used**: a small scratch helper script (per-slug
literal substring list -> `indexOf`-resolved spans against the real
`data/fdn/fdn_scryfall.json` text, tiling/gap/overlap-checked the same
way `coverage-justification.ts` itself does) computed every span — no
hand-typed offsets; every card individually verified via
`verify-coverage-justification-cli.mjs` before gating (all 28 passed on
the first script run). Full `npx vitest run functional-model`: 122
files/1314 passed/5 skipped, unaffected. `npm run typecheck`: same 7
pre-existing diagnostics (CardDetailTabs.vue x3, card-status.ts:263,
card.ts's endTurn literal, mana.ts:275, server/api/tokens/by-key.ts:32) —
0 new. Commit `14252ff`, scoped to exactly these 28 slugs' 70 files
(checked via `git diff --cached --name-status` before committing — two
sibling batches had uncommitted/untracked edits to other slugs in the
same tree at commit time, left untouched).

**Open item for `engine`**: `fiery-annihilation`'s and `divine-
resilience`'s declared gaps (CR 614.2 death-replacement redirecting to
Exile; unbounded "choose any number of targets") are both genuinely new
— not obviously the same as any existing `ENGINE_GAPS.md` entry I could
find (checked: no "would die"/"death replacement" hits, no "any
number"/"unbounded"/"multi-target" hits beyond unrelated context). Worth
`engine` confirming whether either maps onto something already tracked
under a different name, or is worth a new `ENGINE_GAPS.md` entry.
