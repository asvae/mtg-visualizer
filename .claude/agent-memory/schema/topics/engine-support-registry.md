# `engine-support-registry.ts` — per-card engine-support tri-state (2026-09-18)

New, small axis, genuinely distinct from `pipeline-status.ts`'s own
gray/purple/blue/yellow/green/re-review status: a card can be `blue` (zero
`missingSchemaFunctionality` gaps — schema fully REPRESENTS the printed
text) while still using a keyword/trigger/effect the schema recognizes but
the real engine doesn't actually ENFORCE at runtime. Also distinct from
`engine-status.ts`'s own 29-gap dashboard (coarse, subsystem-level,
parsed off `ENGINE_GAPS.md`'s numbered list) — this is a finer per-card
grain, sparse and organically-growing, seeded with exactly one real entry:
Ward (`card.ts`'s `Keyword` union includes it; `functional-model/keywords/
registry.ts`'s own `"ward"` entry's `gapNote` says directly "nothing in
the engine enforces or triggers it yet").

- `functional-model/engine-support-registry.ts` — `EngineSupportGapEntry`
  (`id`/`description`/`matches(definition)`/optional `gapRef`),
  `ENGINE_SUPPORT_REGISTRY` (array, currently 1 entry: `ward-not-enforced`,
  no `gapRef` since Ward isn't tracked as its own numbered `ENGINE_GAPS.md`
  item — only via `keywords/registry.ts`'s per-keyword `gapNote`), and the
  pure `computeEngineSupport(definition): 'on' | 'off'` (checks `matches`
  against both the front face and, when present, `backFace`).
- Wired into `functional-model/pipeline-status.ts`: `CardDefinitionValidationResult`
  gained an optional `definition?: CardDefinition` field (the real, already-
  resolved `CardDefinition` `validate-card-definition.mjs` loaded — carried
  through ONLY on `ok:true`/`failureKind:'capacity-gap'`, never itself
  written to `pipeline-status.json`); `PipelineStatusFile` gained
  `engineSupport?: 'on' | 'off'`; `pipelineStatusFromGateResult` computes it
  via `computeEngineSupport(result.definition)` and sets it ONLY on the
  `'blue'`/`'purple'` return branches — never on `'gray'`
  (`incomplete-authoring`, no manifest yet — absence there is the real,
  load-bearing "not yet evaluated" signal for a future UI's "-" state) and
  never carried forward by `applyPipelineReview` onto `yellow`/`green`
  (dropped on review transition, same as `engineGapsContext`/`failureKind`
  already are). `assertPipelineStatusInvariants` now throws if
  `engineSupport` is set on anything other than `blue`/`purple`.
- `functional-model/scripts/validate-card-definition.mjs` needed only a
  2-line change: attach the already-resolved `definition` object to its
  `ok:true` and `failureKind:'capacity-gap'` return literals.
  `gate-and-write-status.mjs` needed ZERO changes — it already just forwards
  `result` into `pipelineStatusFromGateResult(result)` unchanged.
- Tests: `functional-model/engine-support-registry.test.ts` (mocked
  `CardDefinition`, same convention as `coverage-justification.test.ts`),
  6 cases including a `backFace`-only Ward case.

**Real re-gate side effect, flagged not silently absorbed**: to make
`zul-ashur-lich-lord` (one of the two confirmed real Ward users the task
asked to verify shows `engineSupport: 'off'`) actually reach `purple` (a
precondition for the field appearing at all — it had NO
`justification.json` yet, so it was `gray`/"incomplete-authoring" before
this task), a real, span-verified `functional-model/fdn-cards/
zul-ashur-lich-lord/justification.json` was authored (5 entries covering
its full real oracle text against `data/fdn/fdn_scryfall.json`, same
convention `sire-of-seven-deaths`'s own manifest already established).
This is genuine, legitimate FDN authoring work (squarely in-domain), but
it means the pool-wide purple/gray counts are NOT the previously-recorded
"2 blue / 3 purple / 95 gray" anymore — confirmed, current, re-gated
`--all` result: **2 blue / 4 purple / 94 gray / 0 other**. The task brief's
own "counts must stay unchanged" instruction and its own "both real Ward
users must show `engineSupport: 'off'`" instruction are, strictly, in
tension for a card that starts below `purple` — the wiring/gate-logic
itself is unchanged (verified: `pipelineStatusFromGateResult`'s existing
blue/purple/gray classification branches are untouched, this is a pure
additive field), but finishing zul-ashur-lich-lord's own overdue authoring
was the only way to make it eligible to carry the field at all. Resolved
in favor of the literal per-card verification ask (in-domain, real,
non-fabricated authoring) over the stale count baseline; flagged here so
a future count-based regression check knows this delta is real/expected,
not a gate bug.
