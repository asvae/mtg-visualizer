// Deterministic schema-validation gate for the FDN sink-only-synergy-model
// experiment's two-tier authoring pipeline (see the approved plan,
// Workstream 4, and `functional-model/ENGINE_DESIGN.md`/`SYNERGY_DESIGN.md`
// for the wider context) — given a candidate `definition.ts`, answers
// exactly one of three things, NEVER an LLM judgment call:
//   - `ok: true`                          — safe to mark `blue`.
//   - `ok: false, failureKind: 'capacity-gap'` — a genuine, detected
//     engine-capacity/vocabulary gap (references an Effect/combinator
//     `kind` this engine has never heard of, or uses the pool's own
//     established "documented no-op placeholder" convention for one) — the
//     caller may mark the pipeline-status `purple` (renamed from an
//     earlier `red`, 2026-09-18, later same day, per a two-step explicit
//     user ruling — see `functional-model/pipeline-status.ts`'s own header
//     for the full rename/broadened-meaning writeup, including why
//     `purple` — the shared axis's own "schema support only, unverified"
//     color — won over an intermediate `incomplete` choice; this
//     `failureKind` string itself deliberately stays `'capacity-gap'`, a
//     lower-level diagnostic distinct from the higher-level status name
//     it backs).
//   - `ok: false, failureKind: 'other'`   — anything else (a real bug: a
//     module that doesn't import, a shape that doesn't compile, a missing
//     required `CardDefinition` field, ...) — the caller must hard-fail
//     LOUDLY (throw / write to a distinct blocked-other marker), never fold
//     this into `'capacity-gap'`/`purple` — that carries a specific,
//     verified "capacity gap" meaning that must never be assumed.
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
  if (vocabGapReasons) {
    const engineStatus = computeEngineStatus(root);
    return {
      ok: false,
      failureKind: 'capacity-gap',
      reasons: vocabGapReasons,
      engineGapsContext: {
        gray: engineStatus.filter((e) => e.baseline === 'gray').map((e) => e.title),
        purple: engineStatus.filter((e) => e.baseline === 'purple').map((e) => e.title),
      },
    };
  }

  // Part 2 — the scoped type-check. Only reached once every `kind` used is
  // confirmed real/known.
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
