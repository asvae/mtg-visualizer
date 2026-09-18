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
//   `blue`  — the agent completed the transcription step fully: `functional-
//     model/scripts/validate-card-definition.mjs`'s own deterministic
//     schema-validation gate passed.
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

export type PipelineStatus = 'gray' | 'purple' | 'blue' | 'yellow' | 'green';

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

export type PipelineReviewAction = { verdict: 'ok'; reviewedAt?: string } | { verdict: 'not-ok'; reviewNote: string };

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
    return { status: 'green', reasons: [], reviewedAt: action.reviewedAt ?? now, computedAt: now };
  }
  const note = action.reviewNote?.trim();
  if (!note) throw new Error("a 'not-ok' review action requires a real, non-empty reviewNote.");
  return { status: 'yellow', reasons: [], reviewNote: note, computedAt: now };
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
