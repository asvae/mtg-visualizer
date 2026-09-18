# Zimone, Paradox Sculptor — authoring notes

## Authoring background

Real Forge (zimone_paradox_sculptor.txt): `T:Mode$ Phase | Phase$
BeginCombat | ... | SVar:TrigPutCounter:DB$ PutCounter | ValidTgts$
Creature.YouCtrl | TargetMin$ 0 | TargetMax$ 2 | CounterNum$ 1` — "put a
+1/+1 counter on each of up to two target creatures you control," the
same real `selectUpTo`/`applyToBound` shape `felidar-savior`'s own ETB
already establishes, just fired at the beginning of combat instead (bare
name-only trigger — no `Trigger.on` value exists for "beginning of combat
on your turn"). The activated ability's own real "double the number of
EACH KIND of counter on up to two target creatures and/or artifacts" is a
genuinely different shape: it needs to read a CHOSEN TARGET's own live
counter count (not `ctx.self`'s), for an unbounded set of counter TYPES —
no `ValueRef` reads a bound target's own counters (`selfCounters` only
ever reads `ctx.self`), and no primitive enumerates "every counter type
currently on an object."
