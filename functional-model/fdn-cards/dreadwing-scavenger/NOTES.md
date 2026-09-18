# Dreadwing Scavenger — authoring notes

## Authoring background

Real Forge (dreadwing_scavenger.txt): two triggers (`Mode$ ChangesZone`
self-ETB and `Mode$ Attacks | ValidCard$ Card.Self`, both `Execute$
TrigDraw`) sharing the identical real effect body — modeled as two
separate real `on:'enter'`/`on:'attacks'` triggers rather than one
(this schema has no single trigger that dispatches on either event).
`S:Mode$ Continuous | ... | Condition$ Threshold` is the real, now-
modelable Threshold template (`ContinuousGrantTargeting.condition`,
2026-09-18 schema-completeness pass).
