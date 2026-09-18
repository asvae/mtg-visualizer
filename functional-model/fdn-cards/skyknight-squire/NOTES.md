# Skyknight Squire — authoring notes

## Authoring background

Real Forge: `T:Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield
| ValidCard$ Creature.YouCtrl+Other`. A board-wide watch for some OTHER
permanent's own entrance, genuinely distinct from `on:'enter'`
(self-only) — expressed via `Trigger.on:'otherPermanentEnters'` +
`otherPermanentEntersMatch` (2026-09-18, schema-completeness pass):
`sameController: true`, no `subtype`/`nonToken` filter (every OTHER
creature you control qualifies, unlike Arahbo's own narrower "nontoken
Cat" filter). NOT itself dispatched by `engine.ts` — no board-wide "any
permanent just entered" sweep exists yet for ANY card (Ward pattern — see
`engine-support-registry.ts`'s own
`other-permanent-enters-trigger-not-enforced` entry).

Modeled as two SELF-only continuous grants (one keyword, one type), each
gated on the new `condition` field
(`BoardStateCondition.kind:'selfCounterCountAtLeast'`, 2026-09-18
schema-completeness pass) — declaratively real but NOT itself
engine-enforced yet (`qualifiesForContinuousGrant` never checks
`condition`, Ward pattern — see `engine-support-registry.ts`'s own
`board-state-condition-not-enforced` entry).
