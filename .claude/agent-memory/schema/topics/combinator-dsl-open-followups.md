# combinator.ts (kind:'program'): still-open follow-ups

`combinator.ts`'s declarative `ProgramNode` AST (`Query`/`Filter`/
`Aggregate`/`Each`/`Branch`/`Sequence`, plus a fluent builder layer) is
the default over a raw `kind:'custom'` closure for new card authoring
(per `feedback_combinator_dsl_default`). As of the last touch, real gaps
remain:

- **No `Bind`/`Choose`/`ContextEquals` node kinds yet.** These block
  migrating any effect shaped like "create a token, then act on THAT
  specific token" (a genuine cross-step object reference) off
  `kind:'custom'` — named blockers: `dragoon-s-lance`/
  `machinist-s-arsenal`'s own onEnter (create Hero token, then `equip`
  it), plus `delivery-moogle`/`from-father-to-son`/`magitek-infantry`
  from the original combinator experiment's own inventory. Don't force
  these onto `Sequence` alone; they were deliberately left as `custom`
  rather than mis-modeled.
- **`saga-lore-and-sacrifice-structural.ts` can't distinguish a
  transform-back `Sequence` from an unrelated `program` effect on a
  Saga's final chapter** — it treats every `kind:'program'` as equally
  opaque, the same conservative treatment it already gives
  `kind:'custom'`. Known false-declines from this: `summon-leviathan`
  and `crystal-fragments-summon-alexander` (back face) both have a
  real, already-authored `sacrifice`+`dies` self-pair that this
  recognizer would decline to re-derive (their own final chapters use
  `program` for an unrelated reason — a type-filtered bounce, a
  tap-all-opponents effect — not a transform-back). The existing facts
  are correct and untouched; this is a recognizer blind spot, not a data
  bug.
- **Recognizers that used to runtime-probe a `kind:'custom'` closure
  (e.g. `putCounter-broadcast-structural.ts`) can no longer re-derive
  facts for cards already migrated onto the `program` AST**
  (`aerith-gainsborough`, `dion-bahamut-s-dominant...`,
  `the-crystal-s-chosen`) — their on-disk facts are frozen/correct
  from before the migration, but a *future* edit to their own
  `.each(putCounter(...))` clause shape would silently NOT be reflected
  in `synergy.json` at all, since nothing currently re-derives it. A
  sibling recognizer that reads `kind:'program'` `Each`/`Filter` nodes
  directly (strictly easier than runtime probing, since the structure is
  already data) would close this, not built yet.
- Aerith Gainsborough's own tier-3 `authoredFact` escape hatch (the
  "magnitude X" fact, originally justified because runtime probing
  "carries no object identity to track numeric provenance through") is
  now arguably obsolete — the `program` AST makes that same magnitude a
  directly visible `selfCounters` `ValueRef`. Left in place pending the
  recognizer work above (retiring it needs that recognizer to exist
  first).
