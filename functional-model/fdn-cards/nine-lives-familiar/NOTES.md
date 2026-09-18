# Nine-Lives Familiar — authoring notes

## Authoring background

Real Forge: `K:etbCounter:REVIVAL:8:ValidCard$ Card.Self+wasCastByYou` —
"This creature enters with eight revival counters on it if you cast it."
No declarative "enters with N counters" field exists on `CardDefinition`
(checked pool-wide — no real card models this); the "if you cast it" gate
(as opposed to e.g. being put onto the battlefield some other way) is
dropped as an accepted simplification, same class of cast-condition
approximation joshua-phoenix's-dominant's own file already makes
elsewhere. Modeled as a real ETB `putCounter` effect instead —
mechanically real (`state.ts`'s own persistent per-card counter map), not
a placeholder.

Real Forge: `Mode$ ChangesZone | ValidCard$ Card.Self+counters_GE1_REVIVAL
| Destination$ Graveyard` -> `DelayedTrigger | Phase$ End of Turn`. No
`on` value exists for a dies event, kept as a name-only trigger. The
delayed return IS real, executable machinery — `actions.delayUntil
('EndOfTurn', ...)`, the same real primitive elrond-moon-reader's own
"return at the beginning of the next end step" custom effect already
uses; `ctx.self.getCounters` (real `GameEntity.getCounters`) reads the
real persistent counter this card's own onEnter trigger wrote.
