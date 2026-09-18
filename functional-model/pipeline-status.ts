// Per-card FDN authoring-PIPELINE-STAGE status — `functional-model/
// fdn-cards/<slug>/pipeline-status.json` (2026-09-18, later same day:
// moved out of `functional-model/cards/<slug>/` — that directory is FIN's
// own reference-only pool now, see `functional-model/cards/README.md` —
// into this dedicated sibling directory, since an FDN card's on-disk shape
// has almost nothing in common with a FIN one: no Facts/synergy.json/
// progress.json, and several existing scripts that blindly scan every
// entry under `functional-model/cards/` with no set filter
// (`card-status-batch.mjs`, `scripts/build-fm-bundle.mjs`,
// `functional-model/scripts/sync-combos.mjs`) would otherwise ambiently
// pick up FDN folders they were never designed to handle) — see the
// approved plan, Workstream 4,
// and `.claude/contracts/card-schema.md`'s own "FDN authoring-pipeline
// status" section for the served/consumer-facing contract). A genuinely
// DIFFERENT question from `progress.json`'s `enrichment`/`review`/
// `verifySynergy` fields (fact-quality AUDITING of already-authored facts)
// — this axis instead tracks "how far along the two-tier authoring
// PIPELINE itself is" for one candidate card, before any Fact/sink
// authoring has even started:
//
//   *(no folder at all)* — transparent, not started. Never a computed
//     `PipelineStatus` value — see `readPipelineStatus` below, which
//     returns `undefined` for this case (same "absence is its own signal,
//     not a 6th color" treatment `card-status.ts`/`engine-status.ts`'s own
//     axes never needed, since THEY always have a real definition to
//     classify; this axis, uniquely, has a real "before authoring has
//     even begun" state with no file to read at all).
//   `gray`  — ready for agent work (a real folder exists, `definition.ts`
//     doesn't compile/pass the gate YET, or simply hasn't been attempted).
//     Never computed BY this file — a future authoring-pipeline script
//     writes this the moment it creates the card's own folder, before
//     attempting the cheap-model transcription step at all.
//   `purple` (renamed from `red`, 2026-09-18, later same day, per an
//     explicit user ruling — see below) — blocked: needs additional info
//     from the engine or some other system before authoring can proceed.
//     Deliberately BROADER than the original "engine-capacity gap only"
//     meaning (see `pipelineStatusFromGateResult` below — still the one,
//     sole, real writer of this status; never hand-authored, never
//     inferred any other way) — this generalization is what the user's
//     ruling asked for, and it also absorbs the plan's own speculative
//     "some other blocking reason might need its own status later" case,
//     so `gray`/`purple`/`blue`/`yellow`/`green` is the complete, final
//     5-state list — no 6th status is needed.
//   `blue`  — **redefined 2026-09-18, later same day, per an explicit user
//     ruling (sink-only-synergy-model experiment, catalog/attachment
//     workstream) — now requires BOTH of:**
//     (a) the pre-existing condition above: `functional-model/scripts/
//         validate-card-definition.mjs`'s own deterministic
//         schema-validation gate passed, AND
//     (b) `functional-model/sink-attachment.ts`'s own per-card sink-
//         ATTACHMENT step is complete (`isSinkAttachmentComplete` —
//         `functional-model/fdn-cards/<slug>/sinks.json` exists, is marked
//         `reviewed: true`, every referenced catalog slug is real, and its
//         own recorded fingerprint still matches the card's CURRENT
//         `definition.ts`). Zero attached sinks is a fully legitimate,
//         "complete" outcome (Serra Angel's own real shape — a vanilla
//         creature with no real synergy hooks) — the requirement is that
//         the attachment step was explicitly PERFORMED, never that the
//         resulting slug count is nonzero.
//     Applied uniformly, no grandfathering: `pipelineStatusFromGateResult`
//     ITSELF is UNCHANGED (still writes a raw `status: 'blue'` purely off
//     the schema gate, same as before this redefinition — see that
//     function's own doc comment, "a pure function, no fs reads inside
//     itself," a property this redefinition does not disturb) — the second
//     condition is enforced only in `effectivePipelineStatus` below (the
//     computed, display-time value every real consumer should read
//     instead of the raw stored `status`), which downgrades an otherwise-
//     `blue` stored entry to `gray` (see that function's own doc comment
//     for why `gray`, not a new bucket or the broadened `purple` above, is
//     the correct fallback here) whenever the attachment step hasn't been
//     completed yet. Consequence, verified directly against the real pool
//     (`functional-model/fdn-cards/*/pipeline-status.json`) at the moment
//     this redefinition landed: all 7 real FDN cards that were stored
//     `blue` under the OLD, gate-only definition (`ajani-s-pridemate`,
//     `day-of-judgment`, `essence-scatter`, `fleeting-distraction`,
//     `healer-s-hawk`, `helpful-hunter`, `serra-angel`) genuinely regressed
//     to an effective `gray` the instant this landed — none of them had a
//     `sinks.json` yet. Two were then given a real attachment (restoring
//     their effective `blue`): `ajani-s-pridemate` (wants the shared
//     `lifegain` catalog sink — its own real `onLifeGained` trigger) and
//     `serra-angel` (zero sinks, `reviewed: true` — the explicit "vanilla
//     creature, zero is a legitimate complete outcome" demonstration). The
//     other 5 remain effectively `gray` until their own attachment step is
//     done — a real, intentional, checked consequence of this redefinition,
//     not an oversight.
//     **Deliberately scoped to `blue` only, not `yellow`/`green` too** — see
//     `effectivePipelineStatus`'s own doc comment for the full reasoning
//     (in short: a human review outcome, once it genuinely happens, is not
//     retroactively second-guessed by this completeness axis; the review
//     ROUTE's own precondition is a separate, not-yet-updated concern,
//     flagged in `.claude/contracts/card-schema.md`, not addressed here).
//   `yellow`— a human reviewed a `blue` card and found it wrong (carries a
//     required `reviewNote`).
//   `green` — a human reviewed a `blue` card and confirmed it (carries
//     `reviewedAt`).
//
// ## Naming: `purple`, not `red` — and NOT the also-considered `incomplete`
// (2026-09-18, two-step user ruling)
//
// Originally named `red`, matching the plan text verbatim. The user's
// FIRST ruling asked for a semantic rename with a broadened meaning: "Red
// for cards would be something like 'needs additional info from engine/
// other systems pretty much. Maybe incomplete can cover that instead" —
// which this file briefly implemented as a literal `incomplete` value. The
// user's very next message corrected that specific choice: reuse `purple`
// instead — the SAME value-naming vocabulary the shared axis
// (`card-status.ts`'s `CardStatusColor`, `engine-status.ts`'s
// `EngineStatusColor`, `sink-derivation-status.ts`'s
// `SinkDerivationColor`) already uses for "schema support only,
// unverified," since that's the same underlying concept in spirit — don't
// coin a second synonym for it on a different axis. This is a pure
// naming-consistency fix, NOT a fold into the shared axis's own type/
// computation/file — `pipeline-status.ts` stays its own separate module,
// tracking a genuinely different question (authoring-pipeline STAGE, not
// fact-verification confidence); it merely borrows that axis's color
// WORDS for its OWN 5 states rather than a bespoke third vocabulary.
// Renamed everywhere in this file (type, both functions, every doc
// comment/error message) — no remaining `'red'` or `'incomplete'` literal
// anywhere in this module or its own test file.
//
// ## Why `purple` needs its OWN dedicated writer function, not a bare
// literal — and the judgment call on `failureKind: 'other'`
//
// The plan's own explicit instruction (written when this status was still
// named `red`, unchanged in substance by either rename): reserve it
// SPECIFICALLY for a real, detected blocking condition — any OTHER reason
// a card can't be processed must hard-fail loudly, never silently fold in.
// `pipelineStatusFromGateResult` below is the ONE real mechanism enforcing
// this: it accepts `validate-card-definition.mjs`'s own
// `CardDefinitionValidationResult` (`{ok, failureKind, reasons,
// engineGapsContext}`) and maps `ok:true` -> `blue`, `failureKind:
// 'capacity-gap'` -> `purple` (carrying the gate's own real reasons/
// engineGapsContext straight through, never re-derived) — the gate's own
// `failureKind` value stays the literal string `'capacity-gap'` even
// though the pipeline-status LABEL it maps to is now the broader
// `purple` (see that field's own doc comment on
// `PipelineStatusFile.failureKind` for why this is a deliberate, kept
// naming split between two different layers, not an inconsistency).
//
// **Judgment call, made explicitly, not silently**: `failureKind:'other'`
// (doesn't compile / malformed shape / missing required field / a module
// that fails to import) still maps to a real THROW here, NOT folded into
// the now-broader `purple`. Reasoning: `purple`'s new meaning is "blocked,
// needs MORE INFORMATION from the engine or another system" — a
// genuinely broken definition isn't waiting on more information from
// anywhere, the authoring STEP ITSELF failed (a bug, a typo, a missing
// field) — CR-adjacent this is closer to "the work was done wrong" than
// "the work can't be done yet." Nothing in this file's own code or tests
// surfaced a real case blurring that line, so this is kept as designed
// originally, just re-confirmed under the new name; flagged here per the
// user's own explicit ask to document the call either way. A caller
// (the not-yet-built authoring-pipeline script) that wants to persist
// ANYTHING for an `'other'` failure has to catch this throw and write to
// its own explicitly-named "blocked-other" marker itself — it can never
// happen by accident, by a missing branch, or by a lazy fallback default.
//
// ## Review actions (Workstream 5's own writer, not built here) — the
// PURE transition rule lives here regardless
//
// `applyPipelineReview` implements the one real state-machine rule the
// plan describes for Workstream 5 ("Ok"/"Not ok" on the card page): a
// review action is only ever meaningful on a `blue` card (same "review is
// a precondition-gated action, not a bare status overwrite" rule
// `.claude/contracts/card-schema.md`'s own "Real, enforced gate...
// (2026-09-18)" section already establishes for the OTHER two review-
// overlay axes) — refuses (throws) on `gray`/`purple`/already-
// `yellow`/already-`green`. This file only builds the pure decision
// function; Workstream 5's own API route (not part of this task) is the
// real writer that calls it and persists the result.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFunctionalModelFile } from './source-files';
import { isSinkAttachmentComplete } from './sink-attachment';

// `validate-card-definition.mjs`'s own real return shape, duplicated here
// as a type only (that script is plain `.mjs` — no exported TS types to
// import; same small, deliberate, documented duplication-across-the-JS/TS-
// boundary trade `card-status.ts`'s own `FactLike`/`SynergyLike`/
// `TextCoverageLike` already accept for `text-coverage.mjs`). Keep in sync
// by hand if that script's own return shape ever changes.
export interface CardDefinitionValidationResult {
  ok: boolean;
  failureKind?: 'capacity-gap' | 'other';
  reasons: string[];
  engineGapsContext?: { gray: string[]; purple: string[] };
}

// `re-review` (2026-09-18, later same day) is a SEVENTH-in-name-but-really-
// SIXTH-real-state addition, mirroring `engine-status.ts`'s
// `EngineStatusColor`/`sink-derivation-status.ts`'s `SinkDerivationColor` —
// same bright/light-blue `#7dd3fc` semantics, same "a human confirmed it,
// then the underlying thing drifted since" meaning, adapted to THIS axis's
// own single reviewed artifact: `status: 'green'` means a human confirmed a
// `blue` card; `re-review` means that confirmation is now STALE because
// `functional-model/fdn-cards/<slug>/definition.ts` (the one, whole file
// this axis's `blue` gate itself checked) has changed since. Unlike the
// other two axes, this one does NOT split a separate `Baseline`/`Color`
// pair of types — `PipelineStatus` itself is widened to include it, since
// (a) this axis's `status` field is a single flat value already, with no
// pre-existing baseline/overlay type split to preserve, and (b) simplicity
// was the explicit ask for this axis, not a mechanical copy of the other
// two's own type shape. Consequence, stated plainly: `PipelineStatusFile.
// status` — the literal value ever WRITTEN to `pipeline-status.json` on
// disk — never actually holds `'re-review'`; only `effectivePipelineStatus`
// below (a computed, at-read-time value, never itself stored) can return
// it. `pipelineStatusFromGateResult`/`applyPipelineReview` (the only two
// writers) are UNCHANGED by this addition — neither one can produce
// `'re-review'`.
export type PipelineStatus = 'gray' | 'purple' | 'blue' | 'yellow' | 'green' | 're-review';

export interface PipelineStatusFile {
  status: PipelineStatus;
  /** Real, human-readable reasons — always populated for `purple` (the
   * gate's own capacity-gap reasons) and empty for `gray`/`blue`;
   * irrelevant for `yellow`/`green` (see `reviewNote` instead). */
  reasons: string[];
  /** Set iff `status === 'purple'` — always `'capacity-gap'` today
   * (the only real value `pipelineStatusFromGateResult` ever writes here;
   * a `'purple'` entry missing this field is itself an invariant
   * violation, see `assertPipelineStatusInvariants` below). Deliberately
   * kept as the narrower, lower-level `'capacity-gap'` string even though
   * the pipeline-status LABEL it backs is the broader `purple` — this
   * field is a real, specific DIAGNOSTIC of which precise reason blocked
   * the card, not a restatement of the status name; see this file's own
   * header for the full "why keep the two names different" reasoning. */
  failureKind?: 'capacity-gap';
  /** Set iff `status === 'purple'` — the gate's own informational
   * `computeEngineStatus()` gray/purple titles, carried straight through
   * from `CardDefinitionValidationResult.engineGapsContext` (see that
   * file's own header for why this is context only, never itself the
   * classifier). */
  engineGapsContext?: { gray: string[]; purple: string[] };
  /** Required, non-empty, iff `status === 'yellow'` — the human reviewer's
   * own free-text note on what's wrong (Workstream 5's own "Not ok" modal). */
  reviewNote?: string;
  /** Set iff `status === 'green'` — ISO timestamp of the confirming review
   * action (Workstream 5's own "Ok" action). */
  reviewedAt?: string;
  /** Set iff `status === 'green'` (2026-09-18, later same day) —
   * `computePipelineDefinitionFingerprint(slug)`'s own sha256 value, at the
   * moment of confirmation, of `functional-model/fdn-cards/<slug>/
   * definition.ts`'s real current content — the one thing this axis's
   * `blue` gate itself checked. Compared against a FRESH fingerprint on
   * every read by `effectivePipelineStatus` below; a mismatch (or this
   * field being missing entirely — an old, pre-fingerprint `green` entry)
   * means the effective status is `re-review`, not a trusted `green`.
   * Deliberately NOT populated by `applyPipelineReview` itself reading the
   * filesystem — see that function's own doc comment for why the hash is
   * the CALLER's job. */
  reviewedFingerprint?: string;
  /** ISO timestamp this entry was last computed/written — informational
   * only, never consulted by any classification/transition logic here. */
  computedAt: string;
}

/**
 * The ONE real writer of `status: 'purple'`/`'blue'` — see this file's
 * own header for the full "why a dedicated function, not a bare literal"
 * rationale, and the explicit judgment call on `failureKind:'other'`.
 * Throws (never returns a status) for a `failureKind: 'other'` gate
 * result — enforced as a real throw here rather than left as
 * documentation a future caller could accidentally skip.
 */
export function pipelineStatusFromGateResult(result: CardDefinitionValidationResult, now: string = new Date().toISOString()): PipelineStatusFile {
  if (result.ok) return { status: 'blue', reasons: [], computedAt: now };
  if (result.failureKind === 'capacity-gap') {
    return { status: 'purple', reasons: result.reasons, failureKind: 'capacity-gap', engineGapsContext: result.engineGapsContext, computedAt: now };
  }
  // failureKind === 'other' — a real, distinct blocked-other case (doesn't
  // compile, malformed shape, missing required field, a module that fails
  // to import, ...) — see this file's own header for why this is kept a
  // hard throw rather than folded into the now-broader `purple`: it's
  // "the authoring step failed," not "blocked, needs more information."
  // MUST hard-fail loudly here — a caller wanting to persist ANYTHING for
  // this outcome has to catch this throw and write to its own explicitly-
  // named "blocked-other" marker itself; nothing in this function ever
  // produces a `PipelineStatus` value for it.
  throw new Error(
    `validate-card-definition.mjs reported a non-capacity-gap ('other') failure — this must be hard-failed/flagged loudly by the caller, never silently written as pipeline-status.json's 'purple': ${result.reasons.join('; ')}`,
  );
}

// `reviewedFingerprint` on the `'ok'` branch (2026-09-18, later same day) is
// deliberately PRE-COMPUTED by the caller (`server/api/fdn-cards/[slug]/
// review.post.ts`, via `computePipelineDefinitionFingerprint` below), not
// computed inside this function from a bare `slug`/`root` — keeps this
// function's own long-established "pure decision logic, no fs reads
// inside the transition function itself" property genuinely intact (see
// this file's own header, "Review actions") rather than only documented.
// Optional (not required) so existing callers/tests that don't care about
// drift detection still compile unchanged; omitting it simply means the
// resulting `green` entry has no `reviewedFingerprint` at all, which
// `effectivePipelineStatus` below treats exactly like a mismatch (an old,
// pre-fingerprint confirmation is never assumed still valid).
export type PipelineReviewAction =
  | { verdict: 'ok'; reviewedAt?: string; reviewedFingerprint?: string }
  | { verdict: 'not-ok'; reviewNote: string };

/**
 * The pure `blue -> yellow|green` transition rule (see this file's own
 * header, "Review actions"). Throws — never silently no-ops or
 * re-interprets — when `current.status !== 'blue'` (review is meaningless
 * on a card that was never claimed pipeline-complete in the first place),
 * or when a `'not-ok'` action carries an empty/whitespace-only
 * `reviewNote` (the plan's own explicit "carries a `reviewNote`"
 * requirement — enforced as real, not just documented).
 */
export function applyPipelineReview(
  current: PipelineStatusFile,
  action: PipelineReviewAction,
  now: string = new Date().toISOString(),
): PipelineStatusFile {
  if (current.status !== 'blue') {
    throw new Error(
      `review action refused — pipeline status is '${current.status}', not 'blue'; a review action is only meaningful on a card the agent already completed fully (same precondition this project's other review-action gates already enforce — see .claude/contracts/card-schema.md's "Real, enforced gate..." section).`,
    );
  }
  if (action.verdict === 'ok') {
    return {
      status: 'green',
      reasons: [],
      reviewedAt: action.reviewedAt ?? now,
      reviewedFingerprint: action.reviewedFingerprint,
      computedAt: now,
    };
  }
  const note = action.reviewNote?.trim();
  if (!note) throw new Error("a 'not-ok' review action requires a real, non-empty reviewNote.");
  return { status: 'yellow', reasons: [], reviewNote: note, computedAt: now };
}

/**
 * Real, current sha256 of `functional-model/fdn-cards/<slug>/
 * definition.ts` — the one file this axis's own `blue` gate
 * (`validate-card-definition.mjs`) checks, and therefore the one real
 * input `effectivePipelineStatus` below drift-checks a `green`
 * confirmation against. Uses `readFunctionalModelFile` (same read-only,
 * scope-safe primitive `engine-status.ts`/`sink-derivation-status.ts` use
 * for their own fingerprints) rather than a bare `readFileSync`, so a
 * missing file (should never happen for a real `blue`/`green` card, but
 * never assumed) returns `null` instead of throwing.
 */
export function computePipelineDefinitionFingerprint(slug: string, root: string = process.cwd()): string | null {
  const result = readFunctionalModelFile(root, join('functional-model', 'fdn-cards', slug, 'definition.ts'));
  if (!result.exists) return null;
  const hash = createHash('sha256');
  hash.update(result.content ?? '');
  return hash.digest('hex');
}

/**
 * The real, drift-aware status a consumer should ACTUALLY trust — never
 * the raw stored `status` blindly (see this file's own header addition on
 * `re-review`, above `PipelineStatus`'s own type). Mirrors
 * `readPipelineStatus`'s own `undefined`-for-"no folder at all" contract:
 * returns `undefined` when no `pipeline-status.json` exists yet (the
 * caller decides its own "not started" display fallback, same as every
 * existing `readPipelineStatus` call site already does). For a stored
 * `'green'` entry, compares its `reviewedFingerprint` against a FRESH
 * `computePipelineDefinitionFingerprint` — any mismatch, OR a missing
 * `reviewedFingerprint` at all (an old, pre-fingerprint entry), downgrades
 * the effective status to `'re-review'` rather than trusting a possibly-
 * stale `'green'`. Every other stored status (`gray`/`purple`/`yellow`)
 * passes through unchanged — drift only ever matters for a confirmed
 * `green`.
 *
 * **`blue` redefinition (2026-09-18, later same day) — see this file's own
 * header for the full rationale.** A stored `'blue'` entry additionally
 * requires `sink-attachment.ts`'s own `isSinkAttachmentComplete(slug,
 * root)` to be `true`; when it isn't, this function returns `'gray'`
 * instead of `'blue'` — chosen deliberately over inventing a 7th bucket or
 * reusing the now-broadened `'purple'` (that status is reserved for a
 * genuine, detected engine-capacity/vocabulary gap, `failureKind:
 * 'capacity-gap'` — attachment-incompleteness isn't that; it's real,
 * ordinary, still-pending agent work, which is exactly what `'gray'`
 * ("ready for agent work... or simply hasn't been attempted") already
 * means). **Deliberately scoped to `'blue'` only — a stored `'yellow'`/
 * `'green'` entry passes through UNCHANGED regardless of attachment
 * status, even though either could only have been reached from a `'blue'`
 * precondition (`applyPipelineReview`'s own gate).** Reasoning: a human
 * review outcome, once it genuinely happened, records a real judgment call
 * that this completeness axis should not silently override or hide behind
 * a `'gray'` fallback — and, as of this writing, the review ROUTE itself
 * (`POST /api/fdn-cards/:slug/review`, `card`/`server`-owned, re-runs the
 * schema gate fresh but does NOT yet also check attachment completeness —
 * a real, separate, flagged-not-fixed-here follow-up, see `.claude/
 * contracts/card-schema.md`) could in principle still produce a `'yellow'`/
 * `'green'` without attachment ever having been done; this function
 * doesn't try to retroactively guess or punish that case. No real FDN card
 * is `'yellow'`/`'green'` today (checked), so this distinction is
 * currently inert in practice, not just in theory — but is real, tested
 * behavior, not an oversight.
 *
 * The SAME shared function `server/api/card-status/[set].get.ts`'s `fdn`
 * branch and `server/api/fdn-cards/[slug]/review.post.ts` both call — see
 * this file's own contract note in `.claude/contracts/card-schema.md`'s
 * "FDN authoring-pipeline status" section for why it must not be
 * reimplemented per route.
 */
export function effectivePipelineStatus(slug: string, root: string = process.cwd()): PipelineStatus | undefined {
  const stored = readPipelineStatus(slug, root);
  if (!stored) return undefined;
  if (stored.status === 'blue' && !isSinkAttachmentComplete(slug, root)) return 'gray';
  if (stored.status !== 'green') return stored.status;
  const currentFingerprint = computePipelineDefinitionFingerprint(slug, root);
  if (!stored.reviewedFingerprint || !currentFingerprint || stored.reviewedFingerprint !== currentFingerprint) {
    return 're-review';
  }
  return 'green';
}

/**
 * Real invariant check — throws on any `PipelineStatusFile` whose fields
 * don't match the shape its own `status` promises (see each field's own
 * doc comment above). Never called by `pipelineStatusFromGateResult`/
 * `applyPipelineReview` themselves (both are ALREADY correct by
 * construction) — this exists for a future writer/reader to defensively
 * check a hand-edited or otherwise-untrusted on-disk file before acting on
 * it, and for this file's own tests.
 */
export function assertPipelineStatusInvariants(entry: PipelineStatusFile): void {
  // `re-review` (2026-09-18, later same day) is a COMPUTED, at-read-time-only
  // value (see `effectivePipelineStatus`) — never a real value written to
  // disk. A stored `pipeline-status.json` whose own `status` field is
  // literally `'re-review'` is itself a violation, same "never guess/persist
  // a color this axis doesn't really produce" posture the rest of this
  // function already enforces.
  if (entry.status === 're-review') {
    throw new Error("'re-review' is a computed, at-read-time-only status (see effectivePipelineStatus) — it must never be the literal stored status value.");
  }
  if (entry.status === 'purple') {
    if (entry.failureKind !== 'capacity-gap') throw new Error("a 'purple' entry must carry failureKind:'capacity-gap'.");
    if (entry.reasons.length === 0) throw new Error("a 'purple' entry must carry at least one real reason.");
  } else if (entry.failureKind !== undefined) {
    throw new Error(`failureKind must only be set on a 'purple' entry, found it on '${entry.status}'.`);
  }
  if (entry.status === 'yellow') {
    if (!entry.reviewNote?.trim()) throw new Error("a 'yellow' entry must carry a real, non-empty reviewNote.");
  } else if (entry.reviewNote !== undefined) {
    throw new Error(`reviewNote must only be set on a 'yellow' entry, found it on '${entry.status}'.`);
  }
  if (entry.status === 'green') {
    if (!entry.reviewedAt) throw new Error("a 'green' entry must carry reviewedAt.");
  } else if (entry.reviewedAt !== undefined) {
    throw new Error(`reviewedAt must only be set on a 'green' entry, found it on '${entry.status}'.`);
  }
  // `reviewedFingerprint` is only ever meaningful alongside `green` — but,
  // deliberately, NOT required there (an old, pre-fingerprint `green` entry
  // is a real, tolerated case — see `effectivePipelineStatus`'s own doc
  // comment: a missing fingerprint downgrades the EFFECTIVE status to
  // `re-review` rather than being treated as a malformed file).
  if (entry.status !== 'green' && entry.reviewedFingerprint !== undefined) {
    throw new Error(`reviewedFingerprint must only be set on a 'green' entry, found it on '${entry.status}'.`);
  }
}

/**
 * Reads `functional-model/fdn-cards/<slug>/pipeline-status.json` off disk —
 * `undefined` for the real "(no folder at all)" transparent case (the card
 * dir doesn't exist, or exists but has no such file yet) AND for a
 * genuinely unparseable file. The latter is deliberate, not a shortcut:
 * per this project's own "an ambiguous case always falls back to the LAST
 * KNOWN LOWER status, never guesses upward" policy, a corrupt file conveys
 * NO reliable color signal at all — `undefined` (this axis's own lowest/
 * no-opinion state, "not started") is the correct fallback, never a guess
 * at `gray` or anything higher. Never throws.
 */
export function readPipelineStatus(slug: string, root: string = process.cwd()): PipelineStatusFile | undefined {
  const path = join(root, 'functional-model', 'fdn-cards', slug, 'pipeline-status.json');
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.status !== 'string') return undefined;
    return parsed as PipelineStatusFile;
  } catch {
    return undefined;
  }
}
