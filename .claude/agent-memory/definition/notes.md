# definition lane — agent memory

New lane under the 2026-09-15/16 4-lane split (engine-core / recognizer /
definition / card-results). This is its first entry — no prior notes
existed. Onboarding doc: `functional-model/CARD_DEFINITION_QUICKSTART.md`.

## 2026-09-16 — pilot task: jill-shiva-s-dominant-shiva-warden-of-ice
Sequence migration

Migrated both `kind:'custom'` exile-then-return closures on
`functional-model/cards/jill-shiva-s-dominant-shiva-warden-of-ice/
definition.ts` to the real `combinator.ts` `Sequence` shape
(`sequence('Exile', 'Battlefield')`), matching
`dion-bahamut-s-dominant-bahamut-warden-of-light`'s own already-migrated
sibling exactly:
1. Front face's `{3}{U}{U}, {T}` transform activated ability.
2. Back face (Shiva, Warden of Ice) chapter III's own exile-then-return
   (after the `tapAll` land-tap half, which stayed as-is — not part of
   this migration and not a Sequence shape itself).

Confirmed against real Forge (`jill_shivas_dominant_shiva_warden_of_ice.txt`
and XMage `JillShivasDominant.java`, both via `forge-lookup.mjs`) — both
closures are genuine "ChangeZone Battlefield->Exile" then "ChangeZone
Exile->Battlefield" pairs, front with `Transformed$ True`, chapter III
without (front-face-up), same as Dion's own two migrated instances. Clean
fit, no divergence from Dion's pattern — nothing forced.

Net effect confirmed real, not cosmetic: `apply-recognizers.mjs` retagged
all 4 affected facts (2 per closure) from unprovenanced/AI-authored onto
real `sequenceExileReturn-effect-structural` parser provenance — this is
the actual point of the migration (`custom` closures are opaque to
synergy/recognizer matching, `program`+`Sequence` isn't). `verify-synergy.mjs`
clean (0 hard failures, same pre-existing soft noise — tapForMana/drawCard/
untap/transform — as every other engine-piloted DFC scenario). Full
`vitest run functional-model`: 790/790 passed (+5 skipped), unrelated to
this change but run anyway per the incident below. `trace.json` for this
card, once correctly isolated-regenerated, came out **byte-identical** to
the pre-migration committed version — confirms the migration is purely
structural/authoring, zero behavior change (both `custom.run` and
`program: sequence(...)` execute the identical two `moveTo` calls).

`progress.json`'s `review` flag was already `"ai"` (never was `"human"`) —
no reset needed; left untouched either way, `progress.json` is out of this
lane's scope per the pilot's own stated boundaries.

The other 3 things the pilot triage flagged on this same card
(`grantKeywordTarget`/Unblockable verb-phrase template gap, `tapAll`/
lands-predicate recognizer gap) are recognizer-lane's job, dispatched
separately — not touched here, only noted: my migration didn't change
either of those two effects' own shape, so no incidental effect on that
lane's work either way.

## Incident: accidental full-pool `run-scenarios.mjs` regeneration (self-inflicted, self-corrected same session)

**Root cause**: the dispatching task said "the real scripts take a plain
positional slug arg" for scripts across the board — true for
`apply-recognizers.mjs`/`verify-synergy.mjs` (confirmed: both read
`process.argv.slice(2)` as a positional slug list), but **false for
`run-scenarios.mjs`**, which only recognizes `--slug=<slug>` (confirmed by
reading its own source — a bare positional arg is silently ignored and it
falls through to a full-pool run over every card in `functional-model/cards/`).
I ran `run-scenarios.mjs jill-shiva-s-dominant-shiva-warden-of-ice` (no
`--slug=`) exactly once, trusting that blanket instruction without
independently checking this specific script's own arg-parsing first —
should have grepped `process.argv`/usage comment before trusting a
cross-script generalization. This silently rewrote **323 cards' `trace.json`
files** (confirmed via mtime clustering, not a random guess) with shifted
internal object IDs (the shared, run-scoped ID counter the QUICKSTART doc
already warns about) — a real, if recoverable, mistake.

**Why it was recoverable without data loss**: `run-scenarios.mjs` only ever
writes `trace.json` (confirmed from its own source — never `definition.ts`/
`scenarios.ts`, which stayed fully intact for all 322 other cards), and
`trace.json` is *always* machine-derived (never hand-authored) — a pure,
deterministic function of a card's own `definition.ts`+`scenarios.ts` when
regenerated in isolation via `--slug=`. So the fix was: for each of the 322
non-Jill affected slugs, re-run `run-scenarios.mjs --slug=<slug>` (their
own real, unmodified source files, individually) rather than `git
checkout`/`restore` (which the environment's own auto-mode sandbox
correctly refused as irreversible-destruction risk, and which would have
been the genuinely wrong move anyway — plenty of those 322 files had real,
legitimate pre-existing uncommitted diffs from sibling lane sessions
already in flight before this task started; blindly reverting to HEAD
would have destroyed that real work, whereas regenerating from their own
untouched source files does not). Verified via a targeted A/B test first
(`adventurer-s-airship`: full-pool output had `id: 28`, isolated `--slug=`
rerun gave `id: 4` — proving both the contamination and the fix's
correctness) before running the fix across all 322. 0 errors logged across
the fix pass; final full `vitest run functional-model` 790/790 clean;
`git status` trace.json/synergy.json/definition.ts counts after the fix
(246/115/75) are consistent with ordinary sibling-lane in-flight WIP, not
residual contamination.

**Lesson for future dispatches into this lane**: don't trust a blanket
"positional not `--slug=`" instruction across *all* scripts without
checking each script's own arg-parsing first — `apply-recognizers.mjs`/
`verify-synergy.mjs` and `run-scenarios.mjs` are NOT consistent with each
other on this, and `run-scenarios.mjs` silently full-pool-runs instead of
erroring on an unrecognized invocation shape, which is exactly the trap.
Flagging this so whoever is "mid-fix" on the quickstart's script-invocation
examples (per the dispatching task's own caveat) fixes `run-scenarios.mjs`'s
own usage comment/QUICKSTART entry to be unambiguous per-script, not a
blanket rule.
