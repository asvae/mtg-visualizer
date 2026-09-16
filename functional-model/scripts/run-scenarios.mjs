// Runs every card's own scenarios.ts and writes the resulting fact log to
// that card's own trace.json — the per-card structure is: definition.ts
// (definition), scenarios.ts (test inputs, data), trace.json (test results,
// data — this script's output). A synergy matcher (see match.mjs) reads
// trace.json files, never re-runs anything.
//
// scenarios.ts is one of two shapes:
//   - exports `scenarios` (a Scenario[]) — run through harness.ts's
//     `runScenarios(card, scenarios)`, the flat named-trigger path.
//   - exports `runEngineScenarios(): TraceResult[]` — a REAL engine-piloted
//     trace (see engine-trace.ts's own header), called directly. Both
//     shapes produce the same TraceResult[], so nothing downstream needs to
//     know which one a given card uses.
//
// Usage: npx tsx functional-model/scripts/run-scenarios.mjs --slug=<slug>
//     or: npx tsx functional-model/scripts/run-scenarios.mjs --all
// `--slug` scopes a run to exactly one card folder — same "trial a change
// on one card without touching the rest of the corpus's checked-in
// trace.json files" convention prefill-mana-facts.mjs's own `--slug`
// already established. `--all` is required (not a bare/no-arg default) for
// a genuine full-pool run — see the hard-fail below.
//
// **`--slug`/`--all` are REQUIRED (2026-09-16) — this script used to
// silently fall through to a full-pool run on a bare/misspelled/missing
// arg (e.g. a plain positional `<slug>` instead of `--slug=<slug>`, which
// this script has NEVER accepted — unlike `apply-recognizers.mjs`/
// `verify-synergy.mjs`/`verify-text-coverage.mjs`, which all DO take a
// plain positional slug — see `CARD_RESULTS_QUICKSTART.md`'s own
// exact-arg-shape note). That silent fallback has now bitten TWO different
// agents (an earlier static-ability audit's own near-miss, and a
// definition-lane pilot run) with the exact same failure: a full-pool run
// renumbers every card's own shared, run-scoped object-ID counter, diffing
// EVERY checked-in trace.json at once and requiring a manual per-slug
// recovery. Hard-failing on a missing/malformed arg, rather than silently
// defaulting to `--all`'s own behavior, makes that mistake loud instead of
// a silent 800-file diff discovered later.
import { readdir, writeFile } from 'node:fs/promises';

const { runScenarios } = await import('../harness.ts');

const cardsDir = new URL('../cards/', import.meta.url);
const onlySlugArg = process.argv.find((a) => a.startsWith('--slug='));
const onlySlug = onlySlugArg?.split('=')[1];
const wantsAll = process.argv.includes('--all');

if (!onlySlugArg && !wantsAll) {
  console.error(
    'run-scenarios.mjs: refusing to run — pass exactly one of `--slug=<slug>` (single card) or `--all` (explicit, deliberate full-pool run). A bare/missing/misspelled arg used to silently fall through to a full-pool run, renumbering every card\'s own trace.json object IDs at once; see this script\'s own header comment.'
  );
  process.exit(1);
}
if (onlySlugArg && !onlySlug) {
  console.error('run-scenarios.mjs: `--slug=` was given with no value after the `=` — pass a real card folder slug, e.g. `--slug=coral-sword`.');
  process.exit(1);
}

const slugs = onlySlug
  ? [onlySlug]
  : (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

for (const slug of slugs) {
  const scenariosModule = await import(`../cards/${slug}/scenarios.ts`).catch(() => null);
  if (!scenariosModule) {
    console.log(`skip ${slug}: no scenarios.ts`);
    continue;
  }
  let results;
  let enginePiloted = false;
  if (typeof scenariosModule.runEngineScenarios === 'function') {
    results = scenariosModule.runEngineScenarios();
    enginePiloted = true;
  } else {
    const cardModule = await import(`../cards/${slug}/definition.ts`);
    const card = Object.values(cardModule)[0];
    results = runScenarios(card, scenariosModule.scenarios);
  }
  const outPath = new URL(`../cards/${slug}/trace.json`, import.meta.url);
  await writeFile(outPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
  console.log(`wrote cards/${slug}/trace.json (${results.length} scenarios)${enginePiloted ? ' [engine-piloted]' : ''}`);
}
