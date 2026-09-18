# Twinblade Blessing — authoring notes

## Authoring background

"Enchant creature" (the targeting-restriction clause itself) is NOT a
`missingSchemaFunctionality` gap — removed from `staticAbilities` outright,
2026-09-18, FDN schema-tightness redesign/migration pass (rather than
migrated as a demand), once actually checked against the rest of this
same definition: the `onEnter` trigger's own `custom` attach effect filters
its candidate pool to `.filter((c) => c.isCreature())` before ever
choosing a target — that IS the real, structural enforcement of "enchant
creature," just living in the attach effect rather than a dedicated
field. Nothing was actually missing here.

Real keyword string is `'DoubleStrike'` (no space), not `'Double
Strike'`. `equippedBySelf` is the SAME real `attachedToId` broadcast
mechanism sleep-magic/stuck-in-summoner-s-sanctum's own Auras already use
for "enchanted creature" (an Aura's attachment link is the identical
relationship an Equipment's own "equipped creature" broadcast reads — see
state.ts's own `qualifiesForContinuousGrant` doc comment).

Without a real `equip`-attach, `equippedBySelf` above would never
activate (nothing would ever set `attachedToId`) — same real ETB
attach-then-nothing-else pattern sleep-magic's own `onEnter` trigger
already establishes (that card's own `actions.tap` follow-up is specific
to its own text; this card has none).
