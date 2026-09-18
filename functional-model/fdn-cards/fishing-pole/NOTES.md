# Fishing Pole — authoring notes

## Authoring background

Real Forge (fishing_pole.txt): `S:Mode$ Continuous | Affected$
Creature.EquippedBy | AddAbility$ FishingPoleBaiting` — grants a WHOLE
activated ability to the equipped creature. No such "grant an arbitrary
activated ability to another permanent" primitive exists anywhere in this
schema (`continuousKeywordGrants`/`continuousPTGrants`/
`continuousTypeGrants` only ever broadcast a keyword/P-T-delta/type, never
a full ability). The untap-trigger consequence ("remove a bait counter...
if you do, create a Fish token") is both un-dispatchable (no
`Trigger.on` value for "equipped creature becomes untapped") and
conditionally chained on the FIRST action's own success ("if you do"),
which nothing in this schema tracks. Equip itself IS real, functional
vocabulary (mirrors `celestial-armor`'s own real Equip-attach closure).
