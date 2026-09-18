# Quilled Greatwurm — authoring notes

## Authoring background

Real Forge (quilled_greatwurm.txt): `T:Mode$ DamageDealtOnce |
CombatDamage$ True | PlayerTurn$ True | ValidSource$ Creature.YouCtrl |
Execute$ TrigPutCounter | SVar:TrigPutCounter:DB$ PutCounter |
Defined$TriggeredSourceLKICopy | CounterNum$ X` — a board-wide watch (ANY
creature you control dealing combat damage, not just this one) putting
counters ON THAT DEALING CREATURE, magnitude = damage dealt. No
Query/Filter source exists for "creatures that dealt combat damage this
turn," and no `EachAction`/`ProgramNode` broadcasts a per-item variable
magnitude back onto the SAME item that triggered it. `S:Mode$ Continuous
| ... | MayPlay$ True | AffectedZone$ Graveyard | RaiseCost$
RemoveAnyCounter<6/Any/Creature>` — casting from the graveyard by paying
an ADDITIONAL cost (remove 6 counters) alongside the normal mana cost;
`AlternateCost` is a full cost REPLACEMENT shape only (`from:
'graveyard'|'exile'`), can't express "pay normal cost PLUS remove
counters."
