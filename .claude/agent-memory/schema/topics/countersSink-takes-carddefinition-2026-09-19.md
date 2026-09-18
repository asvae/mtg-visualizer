# `CountersSink(definition: CardDefinition)` — factory takes a real card, not a config object (2026-09-19)

First real precedent for "sink family factory takes a real `CardDefinition`
directly, derives everything else internally" — future families
(lifegain/graveyard-fodder/etb/battlefield-presence) will likely follow this
same shape once/if they migrate, so the derivation-rule choices here are
worth reading before doing that.

## What changed

`functional-model/sink-model/catalog/families/counters.ts`:
`CountersSink(config: CountersSinkConfig)` -> `CountersSink(definition:
CardDefinition)`. `CountersSinkConfig` type deleted entirely (not deprecated
— deleted, per explicit "throw away complete bullshit, don't leave
deprecated cruft" instruction this same task). Three new private, pure
helper functions derive what the config object used to carry:

- `deriveCounterType(definition)` — walks `definition.effects` AND
  `definition.triggers[].effects` (NOT `deriveOccurrences`/backFace/program
  AST — deliberately narrower, since this only ever inspects the ONE known
  driving definition passed to the factory, not an arbitrary runtime
  candidate) for the first real `putCounter`/`putCounterTarget`/
  `putCounterAll` effect, returns its `counterType`. **Throws** if none
  found — a definition with no counter-granting effect is a genuine
  authoring mistake for this factory to be called with, not a legitimate
  empty result.
- `slugForCounterType(counterType)` — sanitizes counterType into a
  deterministic slug (`'+1/+1'` -> `'counters-plus1plus1'`, lowercase, `+`
  -> `'plus'`, `-` -> `'minus'`, non-alnum stripped). Chosen specifically so
  it reproduces the pre-existing real slug byte-for-byte — `sink-catalog-
  status.ts`'s `sourceFileFor`/`computeSinkCatalogFingerprint`/
  `memberEvidenceFor` all resolve `catalog/${entry.slug}.ts`/`.corpus.json`
  directly off this value, so getting it wrong would silently break the
  review-status file lookups. Verified live against `computeSinkCatalogStatus()`
  and a real dev server — unchanged.
- `deriveConsumerTriggerNames(definition)` — the genuinely ambiguous
  derivation. **Investigated first whether "trigger has no `Trigger.on`
  field" was already a reserved convention for "reacts to X" elsewhere in
  the codebase — it is NOT.** `card.ts`'s own `Trigger.on` doc comment
  documents dozens of real, shipped FDN/FIN triggers that are name-only for
  reasons entirely unrelated to counters (not yet retrofitted onto a closed
  auto-fire occasion, fired only by a scenario's own `Scenario.trigger`
  field, etc.) — using absence-of-`on` alone would over-match any
  manually-named trigger. Chosen instead: a small, explicit, family-owned
  allowlist (`COUNTER_ADDED_TRIGGER_NAMES = ['onCounterAdded']`, the one
  real convention name already established in the pool), with a trigger
  EXCLUDED if it also carries a real `on` value (already explained by a
  real auto-fire occasion — a coincidental name match on top of that is a
  collision, not a genuine second signal). This is the general shape to
  reuse for any future family whose consumer-side signal has no real
  `Trigger.on` value yet: don't trust "no `on`" alone, use a small
  family-owned name allowlist plus an `on`-exclusion safety net.

## Predicates naming (mid-task coordinator relay)

User sharpened the `Self → Sink → (Predicates) → Candidate` chain into
`SinkFamily(sinkCandidateDefinition) -> (Predicates) -> Candidate
Definition` mid-task. Factored the candidate-matching logic (previously
inline in the sink's own callable closure) into a named
`withPredicates(counterType, consumerTriggerNames)` closure factory
returning `{producer, consumer}` — visible in the code now, not just prose.
Did NOT rename `definition`/`candidate` parameters to
`sinkCandidateDefinition`/`sourceCandidateDefinition` — those terms would
collide with the pre-existing, differently-scoped "Source Candidate"/"Sink
Candidate" UI vocabulary (`app/pages/app/engine/sinks/[[slug]].vue`, which
means producer-role-card vs. consumer-role-card, a different axis than
"the card configuring the sink" vs "the card being tested"). Flagged this
collision risk in the final report rather than silently picking one.

## Scope confirmed NOT expanded

Same task, user separately said "Right now it's complete bullshit — so we
can throw away current implementation of sinks" — coordinator confirmed
this did NOT expand scope past Counters this pass. `BattlefieldPresenceSink`
still untouched (hand-authored `BattlefieldPresenceSinkConfig`, still
`SinkQuery`/`matchSink`-based). Whether "throw away sinks" becomes a real
follow-up task covering all 5 families is undecided — watch for it.

## Verification

`npx vitest run functional-model`: 120 files / 1344 passed / 5 skipped (net
+6 vs prior 1338/5 — 5 new derivation-focused tests in `counters.test.ts`
plus 1 from the mock-definition rewrite). `npm run typecheck`: unchanged
7-diagnostic baseline, zero new. Live dev-server check: `GET
/api/sink-catalog`'s `counters` entry and `GET /api/card/fdn/11`'s
`functionalModel.cardInteractions` both byte-identical to pre-change (19
source candidates / 1 sink candidate, Exemplar of Light self-included);
`/app/engine/sinks/counters` and `/app/engine/sinks/counters-plus1plus1`
both 200.

Full writeup: `functional-model/sink-model/SINK_MODEL_DESIGN.md`'s new "2c"
section; `.claude/contracts/card-schema.md`'s new section 12.

## Open / not done

- `BattlefieldPresenceSink` not migrated (deliberate, same precedent as the
  2026-09-18 `SinkQuery` migration — one family at a time).
- No Forge re-verification needed this pass — purely internal derivation
  refactor, no new oracle-text/rules claims made; `counterType`/trigger-name
  facts were already Forge-cited in the pre-existing header comment and
  carried forward unchanged.
- If "throw away sinks" does expand to a real task, this file's derivation
  patterns (throw-loudly-on-missing-signal, small family-owned name
  allowlists with an `on`-exclusion safety net, deterministic slug
  sanitization) are the ones to reuse/adapt for `lifegain`/`graveyard-
  fodder`/`etb`/`BattlefieldPresenceSink`.
