# CountersSink producer predicate now checks occurrence target shape

`producerPredicate` (`functional-model/sink-model/catalog/families/counters.ts`)
used to check only `event`/`counterType`/controller on a derived `putCounter`
occurrence, ignoring `occ.target` entirely. Confirmed false positive: a
self-only producer (`{kind:'putCounter', target:'self', ...}`, no way to
target another card) satisfied a DIFFERENT card's sink.

Fix: `producerPredicate` now also takes the driving definition's own
`ownName`/`ownTypes` (captured in `buildCounterInstance` via
`staticAttrsFor(definition).types`, `synergy.ts`) and checks `occ.target`:
- `'self'` → only valid when `candidate.name === ownName` (preserves
  Exemplar of Light's real self-loop: its own self-targeted producer trigger
  genuinely is its own producer for its own consumer trigger).
- a `Constraints`-shaped object (`{types: {...}}`) → `satisfiesType(ownTypes,
  occ.target.types)`.
- `undefined` (untyped program-AST broadcast, no pool-type guarantee) → no
  restriction, passes through.

`satisfiesType` (`match-sink.ts`) was private; exported it rather than
reimplementing — same logic `occurrenceSatisfiesSink` already uses for the
equivalent same-shape check on other sink families (Battlefield-presence
etc.), now genuinely shared instead of risking divergence.

Also did a pure comment-trim pass on `counters.ts` this same task — stripped
all the accumulated dated change-log/live-correction narration (the file had
grown very verbose across 2026-09-18/19 sessions), kept only the durable
technical "why" (Forge citations, dedup rule, self-loop rationale, why no
`requireConsumerForSelfOwnership` escape hatch is needed here). History for
this file's own evolution lives in git log / this memory file's own log
entries, not in the source anymore.

**Final test design (coordinator/user correction, applied before commit)**:
NO hand-authored mock `CardDefinition`s in this file at all — only real
`compileForgeCard` output (Exemplar of Light + Fleeting Flight), compiled
ONCE at module scope (`loadCompiled`, hoisted out of Test3's own former
per-test local) and reused across every case. The bug-regression case needed
no synthetic 3rd card either: `CountersSink(fleetingFlight)[0]
(exemplarOfLight)` → `false` is the exact real-world shape of the bug
(Exemplar of Light's only counter-producing effect is self-targeted, so it
can never satisfy a DIFFERENT real card's sink even though both share
`counterType: '+1/+1'`). Self-loop case:
`CountersSink(exemplarOfLight)[0](exemplarOfLight)` → `true`. Test2 (raw
Forge JSON, no schema) is the one deliberate exception, kept hand-authored —
unrelated, already-settled reason (comparing against schema-based matching
honestly). Test1/Test3 now assert the same real-data outcome by construction
(both use the same two module-scope compiled cards) — accepted as a minor,
intentional redundancy per this design, not a mistake.

**Open**: no new Forge verification needed (this was a pure structural-typing
bug, not a new oracle-text mapping) — not flagged to `engine` either, this is
schema/sink-model-internal (`CardDefinition`-shape matching, not engine
simulation).
