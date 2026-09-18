# Kykar, Zephyr Awakener — authoring notes

## Authoring background

Real Forge (kykar_zephyr_awakener.txt): `T:Mode$ SpellCast | ValidCard$
Card.nonCreature` — bare name-only trigger (no `on` value exists for
"you cast a noncreature spell"). Mode 1's own `SVar:DelTrig:DB$
DelayedTrigger | Mode$ Phase | Phase$ End of Turn | ...` is a real,
genuine DELAYED trigger (exile now, come back at a LATER game event).

**Corrected 2026-09-18** (was previously mis-flagged as a
`missingSchemaFunctionality` capacity gap — that entry was a false
positive): `functional-model/interfaces.ts`'s real `delayUntil(phase,
run)` (CR 603.4/603.7) is exactly this primitive — Elrond, Moon-Reader's
own "next end step" clause (`functional-model/cards/elrond-moon-reader/
definition.ts`) already uses it via a `custom` closure. Mode 1's effects
now mirror that same pattern (`chooseTarget` off `ctx.you
.getCreaturesInPlay()` excluding self, `moveTo(..., 'Exile')`, then
`actions.delayUntil('EndOfTurn', () => moveTo(..., 'Battlefield'))`).
