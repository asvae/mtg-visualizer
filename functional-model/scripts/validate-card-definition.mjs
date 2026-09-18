// Deterministic schema-validation gate for the FDN sink-only-synergy-model
// experiment's two-tier authoring pipeline (see the approved plan,
// Workstream 4, and `functional-model/ENGINE_DESIGN.md`/`SYNERGY_DESIGN.md`
// for the wider context) — given a candidate `definition.ts`, answers
// exactly one of FOUR things, NEVER an LLM judgment call:
//   - `ok: true`                          — safe to mark `blue`.
//   - `ok: false, failureKind: 'capacity-gap'` — a genuine, detected
//     engine-capacity/vocabulary gap (references an Effect/combinator
//     `kind` this engine has never heard of, uses the pool's own
//     established "documented no-op placeholder" convention for one, a
//     name-only `Trigger` with no real `on` value (FDN-only — see part 3
//     below), OR — see the "`missingSchemaFunctionality` presence"
//     section below, 2026-09-18, later same day again — carries ANY
//     non-empty `missingSchemaFunctionality` entry at all) — the caller
//     may mark the pipeline-status `purple` (renamed from an earlier
//     `red`, 2026-09-18, per a two-step explicit user ruling — see
//     `functional-model/pipeline-status.ts`'s own header for the full
//     rename/broadened-meaning writeup; this `failureKind` string itself
//     deliberately stays `'capacity-gap'`, a lower-level diagnostic
//     distinct from the higher-level status name it backs).
//   - `ok: false, failureKind: 'incomplete-authoring'` — the card is
//     otherwise schema-valid but carries no real, well-formed
//     coverage-justification manifest (see the "Coverage-justification
//     manifest" section below, 2026-09-18, later same day again) — maps to
//     `gray` (still "ready for agent work," not a capacity gap and not a
//     bug), never `purple`/`blue`.
//   - `ok: false, failureKind: 'other'`   — anything else: a real bug (a
//     module that doesn't import, a shape that doesn't compile, a missing
//     required `CardDefinition` field, ...), OR (2026-09-18, later same day
//     again) an FDN card using the now-disallowed `staticAbilities` field
//     at all (see "`staticAbilities` is now a hard FDN policy violation"
//     below) — the caller must hard-fail LOUDLY (throw / write to a
//     distinct blocked-other marker), never fold this into
//     `'capacity-gap'`/`purple` or `'incomplete-authoring'`/`gray` — those
//     carry specific, verified meanings that must never be assumed.
//
// ## Foundational redesign, 2026-09-18, later same day again — schema
// tightness + explicit gap declaration (supersedes the `staticAbilities`-
// presence rule below in substance, not by deleting it — see each section)
//
// Per explicit user ruling: "No random strings anywhere, no `any` -
// everything should be strictly tight... Purple - means schema is valid.
// Definition fully covers card function (author should provide written
// reasoning like 'this text' is covered by this code in definition). Blue
// - no schema gaps (missingSchemaFunctionality is not there)." Two new
// structured `CardDefinition` fields (`card.ts`, both purely additive) are
// the direct implementation:
//   - `missingSchemaFunctionality: { clause, demand }[]` — the ONE
//     sanctioned place to declare a real, printed clause this schema
//     can't express, replacing the informal `staticAbilities`-as-gap-
//     marker convention below. See `findMissingSchemaFunctionalityGapReasons`.
//   - `coverageJustification: { clause, coveredBy, reasoning }[]` — the
//     author's own per-clause, written "this text is covered by this
//     code" reasoning, REQUIRED (real, non-empty, internally consistent)
//     to reach EITHER `purple` or `blue` now. See
//     `validateCoverageJustification`.
//
// ## `staticAbilities` is now a hard FDN policy violation, not a capacity
// gap (2026-09-18, later same day again)
//
// The original rule below ("any non-empty `staticAbilities` is an
// automatic capacity-gap") is RETIRED for the FDN pool specifically —
// `staticAbilities` itself stays untouched/unremoved in `card.ts` (98 real,
// legitimate FIN uses, completely out of scope here), but an FDN card using
// it AT ALL is now a HARDER failure than a capacity gap: `failureKind:
// 'other'`, never `purple`. Checked directly against the real FDN pool
// (2026-09-18): every one of the 22 real existing `staticAbilities` entries
// across 20 cards is a genuine capacity-gap marker in disguise (a real,
// printed, mechanically-unbacked clause) — ZERO genuinely rules-irrelevant
// FLAVOR-text uses were found. Since the whole point of this redesign is
// that a capacity gap must be DECLARED via the new structured
// `missingSchemaFunctionality` field (with a real, specific `demand`), not
// left as unstructured prose, leaving `staticAbilities` usable as an
// alternate "same meaning, different field" gap-marker for FDN would
// immediately reopen the exact "two ways to say the same thing" looseness
// this whole task exists to close — `staticAbilities` strings are
// literally the "random strings" the user's own ruling objected to.
// `findStaticAbilitiesPolicyViolationReasons` below is the deterministic
// implementation (same dual-face-walk shape as the retired rule it
// replaces) — checked FIRST, before any other part of this gate, since a
// card using the deprecated field hasn't even attempted the new schema yet.
//
// ## `missingSchemaFunctionality` presence is a capacity-gap, exactly like
// the retired `staticAbilities` rule was (2026-09-18, later same day again)
//
// `findMissingSchemaFunctionalityGapReasons` below is the direct structural
// successor to `findStaticAbilityGapReasons` (same dual-face walk, one
// reason per real entry, folded into the SAME `capacity-gap` bucket the
// vocabulary walk and the name-only-trigger rule already produce) — the
// only change is reading the new, structured `{clause, demand}` field
// instead of a bare string.
//
// ## Coverage-justification manifest (2026-09-18, later same day again)
//
// A fully general "does every real oracle-text clause have a matching
// functional counterpart" check is still NOT feasible here (that's
// NLP-complete oracle-text-vs-effects matching, not a deterministic
// structural gate — the `engine` agent's own prior investigation already
// established this, see `.claude/agent-memory/engine/topics/
// fdn-static-abilities-gate-rule.md`). `validateCoverageJustification`
// below does NOT attempt it — it mechanically checks only what doesn't
// require judgment: the manifest is real/present/non-empty, every entry
// carries real non-empty `clause`/`reasoning` text, and every `coveredBy`
// pointer actually resolves to something real on this SAME
// `CardDefinition` (a named trigger/ability that exists, a
// `missingSchemaFunctionality` index in range, a real `Effect.kind`
// actually used somewhere on the card, ...) — plus one directional
// completeness check: every real `missingSchemaFunctionality` entry must
// be referenced by at least one manifest entry, so a declared gap can
// never go unreasoned-about. This is NOT semantic verification (whether
// the reasoning is actually TRUE is never checked, by design) — its real
// value is forcing the reasoning to be written down at authoring time and
// making it inspectable later, per the user's own explicit framing.
// Deliberately did NOT build a "manifest entry count roughly matches real
// oracle-text clause count" heuristic (floated as a maybe in the task
// brief) — declined, not merely skipped: `CardDefinition` carries no
// `oracleText` field at all for an FDN card (confirmed directly, `card.ts`),
// and the only place real oracle text exists on disk for some (not all)
// FDN cards is an ad hoc per-card scratch cache
// (`functional-model/.fdn-scratch/<slug>/scryfall.json`, opportunistically
// populated during earlier gap sweeps, not a guaranteed/complete input this
// gate could honestly depend on for every card) — building a heuristic
// against a data source that doesn't reliably exist for the whole pool
// would be exactly the "fragile heuristic" the task brief asked NOT to
// force.
// A card failing this check gets `failureKind: 'incomplete-authoring'`
// (maps to `gray`, see `pipeline-status.ts`) — NOT `purple` (no manifest at
// all is a strictly LOWER bar than "schema valid, capacity gap declared and
// reasoned about") and NOT `other` (this isn't a bug, it's un-started/
// incomplete authoring work, same "ambiguous case falls back to the last
// known LOWER status" policy this whole project already follows
// elsewhere). Checked independent of, and BEFORE, the capacity-gap
// classification below — a card can't reach `purple` OR `blue` without a
// real manifest, regardless of whether it also has capacity gaps.
//
// ## Original `staticAbilities`-presence rule (RETIRED for FDN, kept here
// as the historical record of the reasoning this redesign supersedes)
//
// (2026-09-18, earlier same day — real bug found: Inspiring Paladin
// carried a whole second real ability with NO functional counterpart at
// all — expressed only as free-text `staticAbilities` prose plus a code
// comment admitting the gap — and this gate still returned `ok:true`
// (`blue`) for it, since neither check below (part 1's vocabulary walk,
// part 2's type-check) has any way to notice that a `staticAbilities`
// STRING went completely unbacked by any real `Effect`/`Trigger`/
// `continuousKeywordGrants` entry; `card-status.ts`'s own
// `isUnsupportedNoOp` doc comment already named this exact case as "a
// known, accepted blind spot of this check, not silently claimed as
// covered."). The blunt "any non-empty `staticAbilities` is an automatic
// capacity-gap" rule this section used to describe is GONE — see
// "`staticAbilities` is now a hard FDN policy violation" above for what
// replaced it.
//
// ## A name-only `Trigger` (no real `on` value) is ALSO an automatic
// capacity-gap, FDN-only (2026-09-18, later same day again)
//
// Fourth instance of this same silent-gap family, same blunt/deterministic
// shape as the `staticAbilities` rule above: `Trigger.on` (`card.ts`, real
// closed union `'enter' | 'upkeep' | 'endStep' | 'tapLandForMana' |
// 'attacks' | 'equippedAttacks'`) is the ONLY thing that makes a trigger
// auto-fire inside `engine.ts` — a `Trigger` with no `on` at all is, per
// that field's own doc comment, meant to be "picked manually per scenario
// via `harness.ts`'s own `Scenario.trigger`" instead. That's a real,
// legitimate, already-exercised convention for the FIN pool (205 live
// instances, each backed by a real `scenarios.ts`) — but categorically
// NOT for an FDN card, which has no `scenarios.ts` at all by design (see
// `.claude/contracts/card-schema.md`'s "FDN authoring-pipeline status"
// section) — so a name-only trigger there has zero path to ever execute,
// manual or automatic, and is a genuine capacity gap on its own terms.
// `findNameOnlyTriggerGapReasons` below is the deterministic
// implementation, walking both faces exactly like
// `findStaticAbilityGapReasons` — see that function's own doc comment for
// the full reasoning and the real cards this closed (`armasaur-guide`,
// `dazzling-angel`, `exemplar-of-light`, `courageous-goblin`). This rule
// is safe to be unconditional (no separate "is this an FDN candidate"
// check needed) because this whole file is only ever imported by
// `gate-and-write-status.mjs`, which only ever walks
// `functional-model/fdn-cards/` — never `functional-model/cards/` (FIN),
// so the 205 legitimate FIN instances are structurally never seen by this
// gate at all.
//
// ## Two independent checks, in a specific, deliberate order
//
// 1. **The vocabulary walk, run FIRST** — reuses REAL, already-exhaustive
//    runtime dispatchers already in this codebase, rather than a
//    hand-maintained "known kinds" list that could silently drift stale:
//      - `card-status.ts`'s own `findUnsupportedConstructs` (this pool's
//        established "documented no-op `kind:'custom'` placeholder"
//        convention for a genuinely unsupported construct — see that
//        file's own doc comment).
//      - `card.ts`'s own `synergyTags(definition)` — a real, pure,
//        already-exhaustive switch over every plain (non-`program`) `Effect
//        .kind`, recursing into `triggers`/`abilities`/`modal` modes AND
//        `backFace` (both faces), that THROWS `"unhandled effect kind: ..."`
//        for anything outside the real `Effect` union — never guessed at,
//        the same exhaustiveness TypeScript's own `_exhaustive: never`
//        check already enforces at compile time, just exercised for real at
//        runtime here.
//      - `combinator.ts`'s own `walkProgram` — the SAME real, symbolic,
//        already-exhaustive walker (confirmed: no ctx/actions/board
//        needed, see that function's own doc comment) run over every
//        `kind:'program'` effect's `program` field (found via `card-status
//        .ts`'s `collectEffects`, filtered to `kind === 'program'`) — walks
//        `Query`/`Filter`/`EachAction`/`ValueRef`/`CompareCondition`
//        structurally and throws `"unhandled ... node/action/ref/..."` for
//        anything outside the real combinator vocabulary.
//    **Why run this BEFORE the type-check, not after**: `vite-node`'s
//    dynamic import (this whole pipeline's own established convention —
//    see `compute-one-card-status.mjs`) is TRANSPILE-ONLY (esbuild strips
//    TS types without checking them) — so a candidate's own `export const x
//    : CardDefinition = {...}` annotation does NOT stop an invented,
//    unrecognized `kind` string from importing successfully as a plain JS
//    object at runtime, whether or not the source used an `as` cast to
//    smuggle it past a REAL `tsc` pass too. That means this walk is the
//    reliable, always-reachable signal for "this uses a kind the engine
//    doesn't know" — checking it FIRST, before `tsc`, is what correctly
//    classifies a fake-kind fixture as `capacity-gap` rather than the
//    generic `other` a raw `tsc` "not assignable" diagnostic would
//    otherwise produce (that diagnostic's own free text doesn't reliably
//    distinguish "an unknown kind" from any other kind of type mismatch —
//    see the CLI's own header for the real fixture proving this).
//
// 2. **The scoped type-check, run ONLY once the vocabulary walk finds
//    nothing wrong** — real `tsc --noEmit`, scoped to just the one
//    candidate file via a temporary `tsconfig.json` (`extends:
//    .nuxt/tsconfig.server.json` — the SAME config this project's own
//    `npm run typecheck`/ad hoc `npx tsc --noEmit` verification already
//    resolves to for `functional-model/`, confirmed by reproducing this
//    session's own real pre-existing baseline error set
//    — `card-status.ts:263`/`card.ts:2970`/`mana.ts:275` — via that exact
//    config; the bare root `tsconfig.json` is a `files: []` solution file
//    with only `references`, which checks NOTHING under plain `--noEmit`,
//    a real, previously-unnoticed footgun this script deliberately avoids
//    repeating), `files:` overridden to JUST the candidate path (`include`
//    cleared too) so the resulting TS *program* only ever pulls in the
//    candidate's own real import closure (`card.ts`, `combinator.ts`, ...)
//    — never the whole app/server/other-300-cards graph. Confirmed live,
//    ~0.6s per real card (see this file's own CLI verification run).
//    Diagnostics are filtered to ONLY those reported against the candidate
//    file's own real path — a pre-existing, unrelated error inside a
//    DEPENDENCY (`card.ts`/`mana.ts`, etc.) is never this candidate's own
//    fault and must never fail its gate.
//    Any diagnostic on the candidate's own file at this point is
//    genuinely NOT a vocabulary problem (the walk above already proved
//    every `kind` used is real) — a missing required `CardDefinition`
//    field, a wrong field type, a malformed shape, always `failureKind:
//    'other'`, never re-interpreted upward into `capacity-gap`.
//
// ## Cross-referenced against `engine-status.ts` (2026-09-18)
//
// A `capacity-gap` result also attaches `engineGapsContext` — the CURRENT
// `gray`/`purple` titles off `computeEngineStatus()` (`engine-status.ts`,
// this same session's own engine-capability status page) — purely as
// human-facing CONTEXT for a reviewer deciding what to do next, never part
// of the classification itself (matching one-line `describe`/error text
// against `ENGINE_GAPS.md` prose by keyword would be a real, fragile,
// silently-wrong heuristic — this file does NOT attempt that; the
// capacity-gap verdict is decided ENTIRELY by the real vocabulary walk
// above, independent of whatever `ENGINE_GAPS.md` currently says).
//
// ## Reusable, not just a CLI (mirrors `forge-lookup.mjs`'s own
// `findForge`/`findXMage` export precedent) — but a SEPARATE CLI file, not
// a self-guarded bottom block
//
// `validateCardDefinition(definitionPath, root)` is the real, importable
// entry point. Unlike `forge-lookup.mjs` (run via `tsx`, where
// `process.argv[1]` really is the target script's own path, so its own
// `import.meta.url === file://${process.argv[1]}` guard correctly
// distinguishes "run directly" from "imported as a library"), this file
// MUST run under `vite-node` (same reason `prep-card-context.mjs` does —
// dynamically importing sibling `.ts` files like `card.ts`/`combinator.ts`
// /`card-status.ts`/`engine-status.ts`) — and `vite-node`'s own CLI
// wrapper does NOT preserve the real target-file path anywhere in
// `process.argv` at all (confirmed empirically: `process.argv[1]` is
// `vite-node`'s OWN bin path, and the target file itself never appears in
// `process.argv` either), so that guard idiom is structurally impossible
// here. The CLI is therefore its own separate, tiny, always-runs-
// unconditionally file — `validate-card-definition-cli.mjs`, sibling to
// this one — never imported by anything else, so it needs no guard at
// all; this file itself has NO top-level argv-reading code, so importing
// it (from a test, or a future authoring-pipeline script) is always side-
// effect-free.
//
// Usage: npx vite-node functional-model/scripts/validate-card-definition-cli.mjs <slug>
//   npx vite-node functional-model/scripts/validate-card-definition-cli.mjs summon-bahamut

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { collectEffects, findUnsupportedConstructs } from '../card-status.ts';
import { synergyTags } from '../card.ts';
import { walkProgram } from '../combinator.ts';
import { computeEngineStatus } from '../engine-status.ts';

/** Matches this file's own header note: `synergyTags`/`walkProgram`'s real
 * exhaustive-switch `default` branches all throw a message of this exact
 * shape (`card.ts`/`combinator.ts`'s own literal `throw new Error(\`unhandled
 * ...: ${...}\`)` text) — the one, real, positive signal that a thrown error
 * during the vocabulary walk means "genuinely unknown construct" rather
 * than some OTHER, unrelated bug in the walk itself (which must stay
 * `'other'`, never silently promoted to `capacity-gap`). */
const UNHANDLED_KIND_RE = /^unhandled (effect kind|program node|each action|value ref|filter predicate|compare op|condition|card type word):/;

/**
 * Runs the real vocabulary walk over `definition` (see this file's own
 * header, part 1) — `undefined` when every `kind` used is real/known,
 * otherwise the list of real reasons naming the specific unsupported
 * construct(s)/kind(s) found.
 */
function findVocabularyGaps(definition) {
  const reasons = [];

  const unsupported = findUnsupportedConstructs(definition);
  for (const describe of unsupported) reasons.push(`documented unsupported construct (kind:'custom' no-op placeholder): ${describe}`);

  // synergyTags/walkProgram are real, throwing dispatchers — any OTHER
  // (non-"unhandled ...") throw here is a genuine, unrelated bug in the
  // candidate's own data (e.g. a field access on a malformed nested
  // object) and must propagate as a hard 'other' failure, not get folded
  // in here as if it were a vocabulary gap.
  try {
    synergyTags(definition);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!UNHANDLED_KIND_RE.test(message)) throw err;
    reasons.push(`unknown Effect kind: ${message}`);
  }

  for (const effect of collectEffects(definition)) {
    if (effect.kind !== 'program') continue;
    try {
      walkProgram(effect.program);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!UNHANDLED_KIND_RE.test(message)) throw err;
      reasons.push(`unknown combinator node in program (${effect.describe}): ${message}`);
    }
  }

  return reasons.length > 0 ? reasons : undefined;
}

/**
 * FDN-only hard policy-violation rule (2026-09-18, later same day again —
 * see this file's own header, "`staticAbilities` is now a hard FDN policy
 * violation"). Any non-empty `staticAbilities` array on EITHER face is now
 * a reason to hard-block (`failureKind: 'other'`), not a capacity gap — an
 * FDN card must declare a real capacity gap via the new, structured
 * `missingSchemaFunctionality` field instead (see
 * `findMissingSchemaFunctionalityGapReasons` below). Same dual-face-walk
 * shape as this rule's own retired predecessor (`findStaticAbilityGapReasons`,
 * historical name, see the git history on this file) — walks both faces,
 * one reason per real, non-empty entry, `[]` when the card has none on
 * either face. Exported (not just a local helper) for direct unit testing,
 * same "pure primitive, no fs/tsc dependency" precedent this file's other
 * exported checkers already follow.
 */
export function findStaticAbilitiesPolicyViolationReasons(definition) {
  const reasons = [];
  const walk = (def, faceLabel) => {
    for (const text of def.staticAbilities ?? []) {
      reasons.push(
        `staticAbilities is disallowed for an FDN card (migrate to missingSchemaFunctionality: {clause, demand})${faceLabel}: "${text}"`,
      );
    }
    if (def.backFace) walk(def.backFace, ' [back face]');
  };
  walk(definition, '');
  return reasons;
}

/**
 * The direct structural successor to the retired `staticAbilities`-
 * presence rule (2026-09-18, later same day again — see this file's own
 * header, "`missingSchemaFunctionality` presence is a capacity-gap") — same
 * dual-face-walk shape, same "one reason per real entry, folded into the
 * SAME `capacity-gap` bucket" behavior, just reading the new, structured
 * `{clause, demand}` field instead of a bare string.
 */
export function findMissingSchemaFunctionalityGapReasons(definition) {
  const reasons = [];
  const walk = (def, faceLabel) => {
    for (const entry of def.missingSchemaFunctionality ?? []) {
      reasons.push(`declared missingSchemaFunctionality entry${faceLabel}: clause: "${entry.clause}" — demand: "${entry.demand}"`);
    }
    if (def.backFace) walk(def.backFace, ' [back face]');
  };
  walk(definition, '');
  return reasons;
}

/**
 * The real closed set of `CoverageReference.kind` values this checker
 * knows how to resolve — mirrors `card.ts`'s own `CoverageReference` union
 * (duplicated here as a plain runtime list for the same "small, documented
 * duplication across the JS/TS boundary" reason `pipeline-status.ts`'s own
 * header already accepts for `CardDefinitionValidationResult`). Grows only
 * in lockstep with that real type.
 */
const COVERAGE_REFERENCE_KINDS = new Set(['keyword', 'trigger', 'ability', 'effect', 'field', 'missingSchemaFunctionality', 'staticAbilities']);

/**
 * Mechanically checks a `CoverageJustificationEntry.coveredBy` pointer
 * actually resolves to something real on `definition` — see this file's
 * own header, "Coverage-justification manifest," for the full "what this
 * does and doesn't verify" reasoning. Returns `undefined` when the pointer
 * resolves, otherwise a real, specific reason string.
 */
function unresolvedCoverageReferenceReason(coveredBy, definition) {
  if (!coveredBy || typeof coveredBy !== 'object' || !COVERAGE_REFERENCE_KINDS.has(coveredBy.kind)) {
    return `coveredBy has no real, recognized \`kind\` (got ${JSON.stringify(coveredBy)})`;
  }
  switch (coveredBy.kind) {
    case 'keyword':
      return (definition.keywords ?? []).includes(coveredBy.keyword) ? undefined : `coveredBy.kind:'keyword' names "${coveredBy.keyword}", not present in this card's own \`keywords\``;
    case 'trigger':
      return (definition.triggers ?? []).some((t) => t.name === coveredBy.name)
        ? undefined
        : `coveredBy.kind:'trigger' names "${coveredBy.name}", not a real trigger name on this card's own \`triggers\``;
    case 'ability':
      return (definition.abilities ?? []).some((a) => a.name === coveredBy.name)
        ? undefined
        : `coveredBy.kind:'ability' names "${coveredBy.name}", not a real ability name on this card's own \`abilities\``;
    case 'effect':
      return collectEffects(definition).some((e) => e.kind === coveredBy.effectKind)
        ? undefined
        : `coveredBy.kind:'effect' names Effect kind "${coveredBy.effectKind}", not actually used anywhere on this card`;
    case 'field':
      return definition[coveredBy.field] !== undefined && !(Array.isArray(definition[coveredBy.field]) && definition[coveredBy.field].length === 0)
        ? undefined
        : `coveredBy.kind:'field' names "${coveredBy.field}", not actually present (or empty) on this card`;
    case 'missingSchemaFunctionality':
      return typeof coveredBy.index === 'number' && coveredBy.index >= 0 && coveredBy.index < (definition.missingSchemaFunctionality ?? []).length
        ? undefined
        : `coveredBy.kind:'missingSchemaFunctionality' index ${coveredBy.index} is out of range (this card has ${(definition.missingSchemaFunctionality ?? []).length} real entries)`;
    case 'staticAbilities':
      return typeof coveredBy.index === 'number' && coveredBy.index >= 0 && coveredBy.index < (definition.staticAbilities ?? []).length
        ? undefined
        : `coveredBy.kind:'staticAbilities' index ${coveredBy.index} is out of range (this card has ${(definition.staticAbilities ?? []).length} real entries)`;
    default:
      return `coveredBy has no real, recognized \`kind\` (got ${JSON.stringify(coveredBy)})`;
  }
}

/**
 * The real, mechanical coverage-justification-manifest check (2026-09-18,
 * later same day again — see this file's own header, "Coverage-
 * justification manifest," for the full "what this does and doesn't
 * verify" reasoning). Walks both faces (same convention as every other
 * checker in this file); a face with no real content of its own (no
 * `backFace` at all) is simply skipped, never required to carry its own
 * manifest. Returns `{ok: true}` or `{ok: false, reasons: string[]}` —
 * never throws (every input here is already a real, already-imported plain
 * object by the time this runs).
 */
export function validateCoverageJustification(definition) {
  const reasons = [];
  const walk = (def, faceLabel) => {
    const manifest = def.coverageJustification;
    if (!Array.isArray(manifest) || manifest.length === 0) {
      reasons.push(`missing/empty coverageJustification manifest${faceLabel} — every FDN card needs real, written, per-clause coverage reasoning (see card.ts's own CoverageJustificationEntry doc comment)`);
      return;
    }
    manifest.forEach((entry, i) => {
      const label = `${faceLabel} entry [${i}]`;
      if (typeof entry?.clause !== 'string' || entry.clause.trim().length === 0) {
        reasons.push(`coverageJustification${label} has no real, non-empty \`clause\` text`);
      }
      if (typeof entry?.reasoning !== 'string' || entry.reasoning.trim().length === 0) {
        reasons.push(`coverageJustification${label} has no real, non-empty \`reasoning\` text`);
      }
      const unresolved = unresolvedCoverageReferenceReason(entry?.coveredBy, def);
      if (unresolved) reasons.push(`coverageJustification${label}'s coveredBy does not resolve: ${unresolved}`);
    });
    // Directional completeness: every declared gap must be referenced by
    // at least one manifest entry — a `missingSchemaFunctionality` entry
    // with no coverageJustification entry pointing at it is an orphaned
    // gap, never reasoned about at all.
    (def.missingSchemaFunctionality ?? []).forEach((_, i) => {
      const referenced = manifest.some((entry) => entry?.coveredBy?.kind === 'missingSchemaFunctionality' && entry.coveredBy.index === i);
      if (!referenced) reasons.push(`missingSchemaFunctionality${faceLabel} index ${i} has no coverageJustification entry referencing it (coveredBy: {kind:'missingSchemaFunctionality', index:${i}})`);
    });
    if (def.backFace) walk(def.backFace, ' [back face]');
  };
  walk(definition, '');
  return reasons.length > 0 ? { ok: false, reasons } : { ok: true, reasons: [] };
}

/**
 * The blunt, deterministic "name-only trigger" rule (2026-09-18, fourth
 * silent-gap class in this same family — see this file's own header for
 * the "why"; real bugs found: `armasaur-guide`, `dazzling-angel`,
 * `exemplar-of-light`, and — the cleanest case, since it has no OTHER
 * gap masking it — `courageous-goblin`, which was still `blue` with zero
 * reasons despite having a whole real trigger that can never fire).
 * `Trigger.on` (`card.ts` line ~1641) is the ONLY thing that makes a
 * trigger auto-fire for real inside `engine.ts` — a real, closed union of
 * `'enter' | 'upkeep' | 'endStep' | 'tapLandForMana' | 'attacks' |
 * 'equippedAttacks'`; every other named `Trigger` (no `on` at all) is,
 * per that same field's own doc comment, "picked manually per scenario
 * via `harness.ts`'s own `Scenario.trigger`/`sequence` fields instead."
 * That's a genuinely legitimate, real, exercised convention for the FIN
 * pool (205 real instances confirmed live across `functional-model/
 * cards/`, each backed by a real `scenarios.ts` that names the trigger
 * explicitly and gets verified via `verify-synergy.mjs`'s real trace
 * evidence) — this rule deliberately does NOT apply there, and can't
 * (this file is only ever imported by `gate-and-write-status.mjs`, which
 * only ever walks `functional-model/fdn-cards/`, never `cards/`).
 *
 * It's a real, different story for the FDN sink-only-synergy-model
 * pool specifically: an FDN card has ONLY `definition.ts` +
 * `pipeline-status.json` by design (no `scenarios.ts`, no Facts, no
 * `synergy.json` — see `.claude/contracts/card-schema.md`'s "FDN
 * authoring-pipeline status" section) — there is no scenario file for
 * ANY FDN card, so a name-only trigger there has categorically zero path
 * to ever execute, manually or automatically, inside this pipeline. Every
 * comment in this pool citing "manual scenario invocation" as the
 * mitigating story for a missing `on` value is simply false for an FDN
 * card as things stand today. No exception category was found among the
 * real 28 current FDN name-only-trigger instances (checked individually,
 * 2026-09-18) — every one is the same real shape: a trigger condition
 * this schema has no `on` value for yet, silently unreachable rather than
 * flagged. Walks both faces (same convention as
 * `findStaticAbilityGapReasons` above); quotes the trigger's own `name`
 * plus its `description`/`describe` field when present (a few real
 * candidates carry one even though neither is part of the real `Trigger`
 * type — read defensively off the plain runtime object, same "transpile-
 * only import" reality this whole gate already works around for the
 * vocabulary walk).
 */
export function findNameOnlyTriggerGapReasons(definition) {
  const reasons = [];
  const walk = (def, faceLabel) => {
    for (const trigger of def.triggers ?? []) {
      if (trigger.on) continue;
      const label = typeof trigger.name === 'string' && trigger.name.length > 0 ? trigger.name : '(unnamed trigger)';
      const detail = trigger.description ?? trigger.describe;
      reasons.push(
        `name-only trigger with no real \`on\` value (cannot auto-fire, and this FDN pool has no scenarios.ts to manually invoke it either)${faceLabel}: "${label}"${
          typeof detail === 'string' && detail.length > 0 ? ` — ${detail}` : ''
        }`,
      );
    }
    if (def.backFace) walk(def.backFace, ' [back face]');
  };
  walk(definition, '');
  return reasons;
}

/**
 * Real, scoped `tsc --noEmit` against just `absDefinitionPath` — see this
 * file's own header, part 2, for the config shape and why `.nuxt/tsconfig
 * .server.json` (not the bare root `tsconfig.json`) is the real base.
 * Returns every diagnostic line reported against `absDefinitionPath`
 * itself — empty array means clean. Throws (a real, loud 'other' failure
 * at the caller) only if `tsc` itself can't be found/run at all, or if the
 * base server tsconfig hasn't been generated yet (`npx nuxt prepare` — a
 * real, distinct prerequisite failure, not a card-authoring problem).
 */
function scopedTypeCheckDiagnostics(absDefinitionPath, root) {
  const serverTsconfig = join(root, '.nuxt', 'tsconfig.server.json');
  if (!existsSync(serverTsconfig)) {
    throw new Error(
      `${serverTsconfig} does not exist — run \`npx nuxt prepare\` first (this script scopes its real tsc check against that config, the same one this project's own functional-model/ type-checking already resolves to; see this file's own header).`,
    );
  }
  const tscBin = join(root, 'node_modules', '.bin', 'tsc');
  if (!existsSync(tscBin)) {
    throw new Error(`${tscBin} not found — is this a fresh checkout with node_modules not installed?`);
  }

  const scratchDir = mkdtempSync(join(tmpdir(), 'validate-card-definition-'));
  try {
    const tempConfigPath = join(scratchDir, 'tsconfig.json');
    writeFileSync(
      tempConfigPath,
      JSON.stringify({ extends: serverTsconfig, include: [], files: [absDefinitionPath] }, null, 2),
    );

    let stdout = '';
    try {
      stdout = execFileSync(tscBin, ['--noEmit', '--pretty', 'false', '-p', tempConfigPath], {
        cwd: root,
        encoding: 'utf8',
      });
    } catch (err) {
      // tsc exits non-zero the moment it finds ANY diagnostic (even one on
      // an unrelated dependency file) — its own stdout still carries the
      // real, parseable diagnostic text, same as a clean run.
      stdout = (err && typeof err.stdout === 'string' ? err.stdout : '') || '';
    }

    // Diagnostic lines look like `<relative-path>(<line>,<col>): error TSxxxx: <message>`
    // — resolve each reported path against `root` (tsc's own cwd here) and
    // keep only the ones that resolve to THIS candidate file, dropping
    // every pre-existing/unrelated diagnostic in a dependency file.
    const relTarget = relative(root, absDefinitionPath);
    return stdout
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .filter((line) => {
        const match = line.match(/^(.+?)\(\d+,\d+\): /);
        if (!match) return false;
        return resolve(root, match[1]) === resolve(root, relTarget) || match[1] === relTarget;
      });
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

/**
 * The real gate. `definitionPath` may be absolute or `root`-relative; it
 * does NOT need to live under `functional-model/cards/` (the CLI wrapper
 * below is the one that resolves a `<slug>` there — this function itself
 * is deliberately path-agnostic so a test can point it at an arbitrary
 * throwaway fixture). `root` defaults to the repo root (`process.cwd()`),
 * same convention every sibling status module in this file's own imports
 * already uses.
 */
export async function validateCardDefinition(definitionPath, root = process.cwd()) {
  const absPath = resolve(root, definitionPath);

  if (!existsSync(absPath)) {
    return { ok: false, failureKind: 'other', reasons: [`no file at ${absPath}`] };
  }

  let mod;
  try {
    mod = await import(new URL(`file://${absPath}`).href);
  } catch (err) {
    return {
      ok: false,
      failureKind: 'other',
      reasons: [`module failed to import (syntax error or a throw during module evaluation): ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // Deliberately loose (only `name` required) — a candidate genuinely
  // missing a DIFFERENT required `CardDefinition` field (`manaCost`/
  // `typeLine`) is exactly the "malformed shape" case this function's own
  // scoped type-check (part 2 below) is supposed to catch and report as
  // `'other'`; sniffing for those fields here too would short-circuit that
  // real check with a less informative, misleading message instead
  // (confirmed against this file's own `fixture-malformed` case).
  const definition = Object.values(mod).find((v) => v && typeof v === 'object' && typeof v.name === 'string');
  if (!definition) {
    return { ok: false, failureKind: 'other', reasons: [`no CardDefinition-shaped export found in ${absPath} (need at least a real \`name\` field)`] };
  }

  // Part 0 — the `staticAbilities`-in-FDN hard policy check, run FIRST
  // (see this file's own header, "`staticAbilities` is now a hard FDN
  // policy violation") — a card using the deprecated field hasn't even
  // attempted the new schema yet, so this short-circuits before spending
  // effort on the vocabulary walk/manifest/type-check below.
  const staticAbilitiesViolations = findStaticAbilitiesPolicyViolationReasons(definition);
  if (staticAbilitiesViolations.length > 0) {
    return { ok: false, failureKind: 'other', reasons: staticAbilitiesViolations };
  }

  // Part 1 — the vocabulary walk. See this file's own header for why this
  // runs BEFORE the type-check.
  let vocabGapReasons;
  try {
    vocabGapReasons = findVocabularyGaps(definition);
  } catch (err) {
    return {
      ok: false,
      failureKind: 'other',
      reasons: [`unexpected error while walking effects/program tree (not a recognized 'unhandled ...' vocabulary signal): ${err instanceof Error ? err.message : String(err)}`],
    };
  }
  // Name-only triggers (FDN-only, see this file's own header) and declared
  // `missingSchemaFunctionality` entries (the structured successor to the
  // retired `staticAbilities`-presence rule) — combined with any real
  // vocabulary-walk reasons above into ONE capacity-gap result, never a
  // separate/competing classification.
  const nameOnlyTriggerReasons = findNameOnlyTriggerGapReasons(definition);
  const missingSchemaReasons = findMissingSchemaFunctionalityGapReasons(definition);
  const combinedGapReasons = [...(vocabGapReasons ?? []), ...nameOnlyTriggerReasons, ...missingSchemaReasons];

  // Part 1.5 — the coverage-justification manifest (see this file's own
  // header, "Coverage-justification manifest") — checked independent of,
  // and BEFORE, the capacity-gap classification below: a card can't reach
  // `purple` OR `blue` without a real, well-formed manifest, regardless of
  // whether it also has declared capacity gaps.
  const manifestResult = validateCoverageJustification(definition);
  if (!manifestResult.ok) {
    return { ok: false, failureKind: 'incomplete-authoring', reasons: manifestResult.reasons };
  }

  if (combinedGapReasons.length > 0) {
    const engineStatus = computeEngineStatus(root);
    return {
      ok: false,
      failureKind: 'capacity-gap',
      reasons: combinedGapReasons,
      engineGapsContext: {
        gray: engineStatus.filter((e) => e.baseline === 'gray').map((e) => e.title),
        purple: engineStatus.filter((e) => e.baseline === 'purple').map((e) => e.title),
      },
    };
  }

  // Part 2 — the scoped type-check. Only reached once every `kind` used is
  // confirmed real/known AND the coverage manifest is real/well-formed.
  const diagnostics = scopedTypeCheckDiagnostics(absPath, root);
  if (diagnostics.length > 0) {
    return { ok: false, failureKind: 'other', reasons: diagnostics };
  }

  return { ok: true, reasons: [] };
}

// No CLI entry point in this file — see this file's own header, "Reusable,
// not just a CLI," for why: `validate-card-definition-cli.mjs` (sibling
// file) is the real CLI, importing `validateCardDefinition` from here and
// computing its own repo-root path independently.
