// Batch writer for `functional-model/fdn-cards/<slug>/pipeline-status.json`
// (see `functional-model/pipeline-status.ts`'s own header for the axis this
// file writes into, and `validate-card-definition.mjs`'s own header for the
// deterministic gate this script is a thin, repeatable wrapper around).
//
// Until this script existed, the original ~10 real FDN cards' own
// `pipeline-status.json` files were produced by hand, one at a time: run
// `validate-card-definition-cli.mjs <slug>` (or `validateCardDefinition`
// inline), eyeball the JSON result, then hand-write `pipeline-status.json`
// via `pipelineStatusFromGateResult` — no reusable script wired the two
// together, confirmed by grepping this whole directory for any existing
// caller of `pipelineStatusFromGateResult` before writing this file (none
// found outside `pipeline-status.test.ts`). This script is the missing
// "run the gate against `<slug>`'s `definition.ts` and write its
// `pipeline-status.json` from the real result" step, batchable across many
// slugs in one `vite-node` invocation (this pipeline's usual per-card-
// tool subprocess-startup cost, ~0.6-1s of real gate work per card per
// `validate-card-definition.mjs`'s own header, is what batching amortizes
// away — see that file's own measured-live note).
//
// What it does, per slug, in order:
//   1. `validateCardDefinition(...)` — the real, deterministic gate.
//   2. `ok:true` or `failureKind:'capacity-gap'` -> `pipelineStatusFromGateResult`
//      produces a real `blue`/`purple` entry, written to
//      `functional-model/fdn-cards/<slug>/pipeline-status.json` (formatted
//      the same 2-space-indent + trailing-newline shape every other
//      generated-data JSON file in this pool already uses).
//   3. `failureKind:'other'` -> `pipelineStatusFromGateResult` itself
//      THROWS (a deliberate, documented behavior of that function, not a
//      bug here) — this script catches that throw at the per-slug level
//      only (never lets one bad slug abort the whole batch) and reports it
//      LOUDLY in the final summary as a real, distinct "blocked-other"
//      failure; per that function's own header, it writes NOTHING to disk
//      for this slug — no `pipeline-status.json` is created/overwritten.
//   4. A slug with no `functional-model/fdn-cards/<slug>/definition.ts` at
//      all is also a real, loud per-slug failure (never silently skipped).
//
// This script itself never authors/edits a `definition.ts` — that stays a
// separate authoring step (the cheap-tier dispatch); this is ONLY the
// gate-and-record step, safe to (re-)run any number of times, including
// re-running against a slug that already has a `pipeline-status.json` (it
// is simply overwritten with the fresh real result, same as every other
// generated-status file in this pool).
//
// Exit code: 0 iff every slug produced a real `blue`/`purple` write with no
// `'other'`/missing-file failures; 1 otherwise (see the printed summary for
// which slugs and why) — a CI/batch-caller-friendly signal, never silently
// swallowed.
//
// Usage (single or batch — same script, argv is just a list of slugs):
//   npx vite-node functional-model/scripts/gate-and-write-status.mjs <slug> [<slug> ...]
//   npx vite-node functional-model/scripts/gate-and-write-status.mjs sire-of-seven-deaths arahbo-the-first-fang
//
// `--all`: gate every real `functional-model/fdn-cards/<slug>/` folder that
// currently has a `definition.ts` (discovered via `readdirSync`, same
// convention `list-fdn-definitions.mjs` already uses), instead of an
// explicit argv list:
//   npx vite-node functional-model/scripts/gate-and-write-status.mjs --all

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCardDefinition } from './validate-card-definition.mjs';
import { pipelineStatusFromGateResult } from '../pipeline-status.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const FDN_CARDS_DIR = join(ROOT, 'functional-model', 'fdn-cards');

function resolveSlugs(argv) {
  if (argv.length === 1 && argv[0] === '--all') {
    let entries;
    try {
      entries = readdirSync(FDN_CARDS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());
    } catch {
      return [];
    }
    return entries
      .map((e) => e.name)
      .filter((slug) => existsSync(join(FDN_CARDS_DIR, slug, 'definition.ts')));
  }
  return argv;
}

async function gateOne(slug) {
  const definitionPath = join(FDN_CARDS_DIR, slug, 'definition.ts');
  if (!existsSync(definitionPath)) {
    return { slug, outcome: 'missing-file', detail: `no definition.ts at ${definitionPath}` };
  }

  const result = await validateCardDefinition(definitionPath, ROOT);

  let entry;
  try {
    entry = pipelineStatusFromGateResult(result);
  } catch (err) {
    // failureKind:'other' — pipelineStatusFromGateResult's own deliberate
    // throw (see this file's own header, point 3). A real, distinct
    // "blocked-other" failure: reported loudly, nothing written to disk.
    return { slug, outcome: 'other', detail: err instanceof Error ? err.message : String(err) };
  }

  const statusPath = join(FDN_CARDS_DIR, slug, 'pipeline-status.json');
  writeFileSync(statusPath, JSON.stringify(entry, null, 2) + '\n');
  return { slug, outcome: entry.status, detail: entry.reasons.join('; ') };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error(
      'Usage: npx vite-node functional-model/scripts/gate-and-write-status.mjs <slug> [<slug> ...]\n' +
        '   or: npx vite-node functional-model/scripts/gate-and-write-status.mjs --all',
    );
    process.exit(1);
  }

  const slugs = resolveSlugs(argv);
  if (slugs.length === 0) {
    console.error('No slugs resolved (empty --all pool, or bad slug list) — nothing to do.');
    process.exit(1);
  }

  const results = [];
  for (const slug of slugs) {
    results.push(await gateOne(slug));
  }

  const byOutcome = { blue: [], purple: [], other: [], 'missing-file': [] };
  for (const r of results) byOutcome[r.outcome]?.push(r) ?? (byOutcome[r.outcome] = [r]);

  console.log(`\nGated ${results.length} card(s):`);
  console.log(`  blue (gate passed):        ${byOutcome.blue.length}`);
  console.log(`  purple (capacity-gap):     ${byOutcome.purple.length}`);
  console.log(`  other (BLOCKED, no write): ${byOutcome.other.length}`);
  console.log(`  missing-file (no write):   ${byOutcome['missing-file'].length}`);

  if (byOutcome.purple.length) {
    console.log('\npurple (capacity-gap) detail:');
    for (const r of byOutcome.purple) console.log(`  - ${r.slug}: ${r.detail}`);
  }
  if (byOutcome.other.length) {
    console.log("\nother (BLOCKED — real bug, nothing written) detail:");
    for (const r of byOutcome.other) console.log(`  - ${r.slug}: ${r.detail}`);
  }
  if (byOutcome['missing-file'].length) {
    console.log('\nmissing-file detail:');
    for (const r of byOutcome['missing-file']) console.log(`  - ${r.slug}: ${r.detail}`);
  }

  const failed = byOutcome.other.length + byOutcome['missing-file'].length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
