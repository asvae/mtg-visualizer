# FDN-surfaced gap triage (2026-09-18)

Orchestrator asked engine to triage ~34 candidate schema/engine gaps the
`schema` agent surfaced authoring `definition.ts`/`justification.json` for
the 150-card FDN pool. Full triage table lives in
`functional-model/ENGINE_GAPS.md`'s own new `### FDN-surfaced gaps
(2026-09-18 triage)` section (entries #30-#47), plus in-place updates to
#7/#24/#25. Don't re-litigate the whole thing here — this topic is just the
two things worth remembering beyond what's already in that doc.

## Two false-positive gap claims found — check before trusting a
`missingSchemaFunctionality` "no primitive exists" claim at face value

`schema`'s per-card gap notes are honest and well-researched, but at least
2 of the ~34 checked this pass were wrong about current capability (not
fabricated — just hadn't found the existing mechanism):

- **`kykar-zephyr-awakener`** claimed no delayed-trigger primitive exists.
  `interfaces.ts`'s real `delayUntil(phase, run)` (603.4/603.7) already IS
  this, already exercised by a real FIN card (Elrond, Moon-Reader's own
  identical "at the beginning of the next end step" clause via a `custom`
  effect). Kykar's own modal mode just has a bare `effects: []` no-op
  instead of a `custom` closure mirroring Elrond's pattern.
- **`ravenous-amulet`** claimed no timing/speed-restriction field exists on
  a named `abilities[]` entry. `engine.ts`'s `canActivateAbility` already
  has a real, general (not Equipment-specific) text-pattern check —
  `/activate only as a sorcery/i.test(cost)` — against ANY named ability's
  own `cost` STRING. The ability's own `cost` field just doesn't currently
  include that literal phrase.

Neither was fixed (out of engine's lane — `fdn-cards/*` is schema's), just
flagged in the new ENGINE_GAPS.md section's own closing note. Worth
grepping `interfaces.ts`/`engine.ts`'s existing text-pattern/ambient
primitives before accepting a "no primitive exists" claim as automatically
true on a future triage — this codebase has a few narrow-but-real
mechanisms (`delayUntil`, the sorcery-speed cost-string check, `Trigger.on`
values) that are easy to miss without a direct grep.

## Not yet Forge-verified

The new entries' Forge citations (Morbid's `Condition$ EachTurn | Type$
CreatureDiedThisTurn` shape, Emblem's CR 701.42 framing, MayPlay's `SVar`
shape) are from trained knowledge / the existing doc's own established
citation style for OPEN (not-yet-built) gaps, not independently re-checked
against `tmp/mtg-forge` line-by-line the way a CLOSED entry's citations
are in this doc (per this project's own convention, an OPEN/documented-not-
built entry gets a lighter citation bar than a CLOSED one). If any of
these are picked up to actually build, re-verify the exact Forge class/line
citation before treating this triage's own framing as ground truth.
