# False-positive `missingSchemaFunctionality` fixes: kykar, ravenous-amulet (2026-09-18)

Two FDN cards had declared a capacity gap that turned out to be a real,
existing primitive misused/unused — not a genuine schema gap. Both fixed
by wiring the real primitive, not by adding new vocabulary.

**`kykar-zephyr-awakener`** — its modal mode's "Exile ... Return that
card ... at the beginning of the next end step" clause claimed "no
delayed-trigger primitive exists." False: `interfaces.ts`'s real
`delayUntil(phase, run)` (CR 603.4/603.7) IS that primitive —
`functional-model/cards/elrond-moon-reader/definition.ts` already uses it
for an identical "next end step" clause via a `custom` closure. Mirrored
that same pattern (`chooseTarget` off `ctx.you.getCreaturesInPlay()`
excluding self, `moveTo(..., 'Exile')`, then `delayUntil('EndOfTurn', ()
=> moveTo(..., 'Battlefield'))`). Card had NO `justification.json` at all
before this fix (was gray, not purple, for that separate reason) —
authored one fresh, all 4 entries `definition`-kind, verified via
`verify-coverage-justification-cli.mjs`. **Still purple after the
fix** — capped by the separate, pre-existing, correct "name-only trigger
with no real `on` value" FDN gate rule (`onCastNoncreatureSpell` has no
`on`, and FDN cards have no `scenarios.ts` to manually invoke it either —
see `fdn-static-abilities-gate-rule.md`'s own 4th-silent-gap-class
section). Not something this fix touches or should touch.

**`ravenous-amulet`** — its `drawAndSoul` ability's "Activate only as a
sorcery." clause claimed "no timing/speed-restriction field exists on a
named `abilities[]` entry." False: `engine.ts`'s real
`canActivateAbility` already runs `/activate only as a sorcery/i
.test(cost)` against a named ability's own `cost` STRING (not a separate
field) and gates on `sorcerySpeedTimingOk` when it matches. Real pool
precedent for embedding this literal phrase directly in a named ability's
`cost`: `functional-model/cards/garland-knight-of-cornelia/definition.ts`'s
own `returnTransformed` ability, `cost: '{3}{B}{B}{R}{R}, Activate only
as a sorcery'` (comma-joined, no trailing period, no parens — distinct
from the pool's more common `activationCost`-level convention, `'...
(activate only as a sorcery)'`, used only for the single top-level
ability slot). Applied the identical shape here:
`cost: '{1}, {T}, Sacrifice a creature, Activate only as a sorcery'`.
Now regates clean **blue** (0 reasons).

**`tinybones-bauble-burglar` is NOT a legitimate precedent** — its own
`activatedAbilities`/`description` fields aren't real `CardDefinition`
members at all (`CardDefinition.abilities[]` only has `name`/`cost`/
`effects`/`costReduction`/`annotation` — no `description`). This card's
`activatedAbilities` field is silently ignored (excess property, not
caught by `tsc` because `functional-model/tsconfig.json`'s own `include`
doesn't cover `fdn-cards/**` at all, and `npm run typecheck`/nuxt
typecheck doesn't reach fdn-cards either since nothing under `app/`/
`server/` imports it) — this card's own "Each opponent discards a card.
Activate only as a sorcery." never actually reaches `cost` at all. Not
fixed (out of scope, not part of this task's 2-card list) — flagged only
so a future pass doesn't copy this broken shape as a precedent.

**Also found, not fixed (flagged for whoever authors it next)**:
`treetop-snarespinner`'s own `NOTES.md` claims "no priority/timing speed
restriction is enforced anywhere for a plain (non-mana) activated ability
in this engine" — this is now WRONG (same false-positive class as the
two fixes above; `canActivateAbility`'s real check enforces it). That
card is still `gray` (no `justification.json` yet), so nothing is
currently gated on this stale claim, but its `activationCost: '{2}{G}'`
also doesn't carry the restriction text at all (real oracle text has
"Activate only as a sorcery" that isn't reflected anywhere in the
definition) — a real gap to close whenever that card gets authored.

**Latent, unrelated, NOT fixed**: `engine.ts`'s own
`unsupportedCostComponent` only recognizes a `Sacrifice ...` cost
component when `card.effects` (the top-level array) already contains a
matching `kind:'sacrifice'` Effect — it does NOT check a NAMED ability's
own `ability.effects`. Both `ravenous-amulet`'s `drawAndSoul` ("Sacrifice
a creature") and `garland-knight-of-cornelia`'s `returnTransformed`
("Activate only as a sorcery" itself, which also isn't recognized at all
by that same function) would hit `canActivateAbility`'s "unsupported cost
component" hard-rejection if actually invoked — pre-existing on both
cards before this fix, invisible today only because FDN has no
`scenarios.ts` to ever actually call `canActivateAbility` and Garland's
own FIN scenario deliberately never exercises that specific ability
(see that card's own doc comment). Engine-owned; flag to `engine`, not
fixed here.
