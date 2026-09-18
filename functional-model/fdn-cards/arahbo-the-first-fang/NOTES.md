# Arahbo, the First Fang — authoring notes

## Authoring background

"Whenever Arahbo or another nontoken Cat you control enters, create a 1/1
white Cat creature token." — two real triggers cover the two real halves:
`onEnter` (`on:'enter'`, self-only, a real, engine-dispatched ETB) for
"Arahbo enters," and `onOtherCatEnters`
(`on:'otherPermanentEnters'`/`otherPermanentEntersMatch`, 2026-09-18
schema-completeness pass) for "another nontoken Cat you control enters" —
migrated off the prior `missingSchemaFunctionality` declaration for that
half now that the vocabulary exists (NOT itself dispatched by `engine.ts`
— no board-wide "any permanent just entered" sweep exists yet for ANY
card, same as the Ward pattern — see `engine-support-registry.ts`'s own
`other-permanent-enters-trigger-not-enforced` entry).
