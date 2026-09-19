// Dev-only server util — 2026-09-19, card page's "Forge Compiler" reviewer
// tab. Surfaces the standalone `functional-model/scripts/
// forge-json-compiler/` tool's own result (moved out of `scripts/
// experiments/` the same day it was promoted into a real FDN
// authoring-pipeline step — see that dir's `compile-forge-card.ts` header
// for the full design) so it's readable on the card page instead of only
// via that tool's own CLI runner (`run-experiment.ts`, `npx vite-node
// .../run-experiment.ts`).
//
// That experiment is a deliberately NARROW, allowlisted-card feasibility
// probe — it ONLY recognizes the exact real Forge shapes each card in
// `SUPPORTED_CARDS` below needs, and throws `UnsupportedForgeShape` on
// anything else. This util hard-codes that same allowlist up front (a name
// check BEFORE ever calling the compiler) rather than attempting it against
// an arbitrary card and translating the resulting throw after the fact —
// every other card reports `supported: false` and never touches the
// compiler at all.
//
// Allowlist history: started as exactly one card (Exemplar of Light, FDN
// #11); Fleeting Flight (FDN #13) joined 2026-09-19, same day. Later that
// same day the schema agent's "FDN 1-50 coverage push" widened the compiler
// to cover 23 of FDN's first 50 real cards (22 originally, plus Felidar
// Savior once the compiler gained a `TargetMin$0`/`TargetMax$` ->
// `selectUpTo`/`applyToBound` translation rule — see `fdn-1-50-cases.ts`'s
// own doc comment for its gray/blue "compiles or not" scheme + per-card table),
// and `SUPPORTED_CARDS` below now folds that entire `CASES` table's
// compiling (`blue`) entries in alongside the original, hand-added Exemplar
// of Light (which isn't itself part of that table — FDN #11 falls in a gap
// the `fdn-1-50-cases.ts` corpus's own checked-in `fdn_scryfall.json`
// subset doesn't carry). Reused directly from `fdn-1-50-cases.ts` rather
// than re-listed here so this allowlist and that experiment's own
// regression-guard test can never silently drift apart — any future
// coverage change to that shared table lands here automatically.
//
// Scope, deliberately narrow (2026-09-19 correction, mid-task): this tab
// ONLY reports whether a card's real Forge JSON compiles into a
// schema-valid `CardDefinition` — it does NOT diff that output against the
// real hand-authored `fdn-cards/<slug>/definition.ts` reference (an earlier
// pass of this same task built that diff; dropped per explicit user
// direction — "don't care about diffing against the pipeline-authored
// reference, just compiled-or-not"). `SUPPORTED_CARDS` therefore only needs
// each card's `forgeJsonFile`, no `fdnSlug`.
//
// Same dev-only posture as `server/utils/forgeScript.ts`/`fdnDefinitionPool`
// reads elsewhere in this file family (none of
// `functional-model/scripts/experiments/**` survives a production Netlify
// Function bundle, and this whole area is explicitly local-only for now,
// same as Forge Script) — refuses outright when `NODE_ENV === 'production'`,
// checked here AND by the route that calls in, same two-layer gate
// `forgeScript.ts` already establishes.
//
// Imports the experiment's own `compile-forge-card.ts` by spawning it (via
// a thin wrapper, `compile-one-card.mjs`) as a child process under
// `vite-node`, NOT a plain in-process dynamic `import()`. This changed
// 2026-09-19: `compile-forge-card.ts` gained a genuine runtime `import {
// anyPlayer, applyToBound, ... } from '../../combinator'` (real values, not
// type-only) for its bounded-target (`selectUpTo`/`applyToBound`)
// compiler support — a plain dynamic `import()` can't resolve that
// extensionless relative specifier the way Nitro's dev bundler resolves
// this route's OTHER imports, the exact same gap
// `functional-model/scripts/run-one-card.mjs`/`list-fdn-definitions.mjs`
// already exist to work around for `server/api/card/[set]/[number].ts`'s
// own live-execution paths — see
// `.claude/agent-memory/card/topics/nitro-mjs-import-gotcha.md`. Before
// that change, this file's own comment here correctly noted
// `compile-forge-card.ts` only imported `CardDefinition`/`Effect`/... as
// TYPES (erased at runtime), so a plain dynamic import worked; that's no
// longer true, and any FUTURE genuine runtime import added anywhere in
// this file's own import chain keeps working under this same vite-node
// spawn, by construction — no per-import special-casing needed.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { CASES as FDN_1_50_CASES } from '../../functional-model/scripts/forge-json-compiler/fdn-1-50-cases';

const execFileAsync = promisify(execFile);

// `compile-one-card.mjs`'s own stdout envelope shape — see that script's
// header. Token-script resolution (`Cat Collector`, `Guarded Heir`, ...
// `Token`-effect `SVar`s that name a real Forge `res/tokenscripts/<id>.txt`
// id) now happens INSIDE that spawned script, not here — same "missing
// local `tmp/mtg-forge/` checkout degrades to a reported compile error,
// not a crash" tolerance as before, just relocated.
interface CompileOneCardResult {
  ok: true;
  compiled: unknown;
}
interface CompileOneCardError {
  ok: false;
  error: string;
}

interface SupportedForgeCard {
  /** Sibling forge-json-mapper experiment's own output filename for this card (its own `slugify`, underscore-joined). */
  forgeJsonFile: string;
}

// The cards this experiment's compiler understands — see this module's own
// header. Keyed by a trimmed/lowercased card name (the same loose-equality
// posture `forgeScript.ts`'s own `nameMatches` uses for its `Name:` line
// check), not `slugify`, since these are fixed name literals rather than a
// filename-resolution problem. Filters `fdn-1-50-cases.ts`'s own `CASES` to
// anything NOT `gray` (that table's own "doesn't compile" state) — this
// allowlist only cares about compiled-or-not, not whatever finer-grained
// distinction that shared table also tracks.
const SUPPORTED_CARDS: Record<string, SupportedForgeCard> = {
  // Not part of `fdn-1-50-cases.ts`'s own table (FDN #11 falls in that
  // corpus's own checked-in `fdn_scryfall.json` gap) — kept as the original,
  // hand-added entry.
  'exemplar of light': { forgeJsonFile: 'exemplar_of_light.json' },
  ...Object.fromEntries(
    FDN_1_50_CASES.filter((c) => c.status !== 'gray').map((c) => [
      c.name.trim().toLowerCase(),
      { forgeJsonFile: `${c.slug}.json` } satisfies SupportedForgeCard,
    ]),
  ),
};

export interface ForgeJsonCompilerUnavailable {
  available: false;
  reason: 'dev-only';
}
export interface ForgeJsonCompilerUnsupported {
  available: true;
  supported: false;
}
export interface ForgeJsonCompilerCompiled {
  available: true;
  supported: true;
  compiledJson: string;
}
export interface ForgeJsonCompilerError {
  available: true;
  supported: true;
  error: string;
}
export type ForgeJsonCompilerResult =
  | ForgeJsonCompilerUnavailable
  | ForgeJsonCompilerUnsupported
  | ForgeJsonCompilerCompiled
  | ForgeJsonCompilerError;

export async function loadForgeJsonCompilerResult(cardName: string, root: string = process.cwd()): Promise<ForgeJsonCompilerResult> {
  if (process.env.NODE_ENV === 'production') return { available: false, reason: 'dev-only' };
  const supported = SUPPORTED_CARDS[cardName.trim().toLowerCase()];
  if (!supported) return { available: true, supported: false };

  try {
    // The sibling forge-json-mapper experiment's own real Forge JSON for
    // this card — separately committed elsewhere in scope, its own `output/`
    // dir is still untracked as of this writing (see
    // `.claude/agent-memory/card/topics/forge-json-mapper-tab.md`'s own
    // "Open item"), so a missing file here is a real, expected, reportable
    // outcome on a fresh clone, not a bug in this module.
    const forgeJsonPath = join(
      root,
      'functional-model/scripts/experiments/forge-json-mapper/output',
      supported.forgeJsonFile,
    );
    if (!existsSync(forgeJsonPath)) {
      return {
        available: true,
        supported: true,
        error: `forge-json-mapper output/${supported.forgeJsonFile} not found on disk (that experiment's own output/ is untracked).`,
      };
    }
    // Spawned under `vite-node`, not imported in-process — see this
    // module's own header comment.
    const { stdout } = await execFileAsync(join(root, 'node_modules/.bin/vite-node'), [
      join(root, 'functional-model/scripts/forge-json-compiler/compile-one-card.mjs'),
      forgeJsonPath,
    ]);
    const result = JSON.parse(stdout) as CompileOneCardResult | CompileOneCardError;
    if (!result.ok) return { available: true, supported: true, error: result.error };
    return { available: true, supported: true, compiledJson: JSON.stringify(result.compiled, null, 2) };
  } catch (err) {
    // The compiler throwing `UnsupportedForgeShape` (or any other failure —
    // a missing SVar, a malformed on-disk JSON file, ...) degrades to a
    // reported error rather than a route-wide 500; this is a live
    // feasibility experiment, not a hardened pipeline, so a real thrown
    // shape gap is expected, reportable information, not a bug in this tab.
    return { available: true, supported: true, error: err instanceof Error ? err.message : String(err) };
  }
}
