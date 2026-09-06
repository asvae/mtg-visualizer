// Single-card variant of run-scenarios.mjs's own dispatch (scenarios.ts
// exports EITHER `scenarios` (a Scenario[], run through harness.ts's
// runScenarios) or `runEngineScenarios(): TraceResult[]` (a real
// engine-piloted trace, see engine-trace.ts's own header) — spawned as a
// child process by server/api/card/[set]/[number].ts's own live-execution
// path. Nitro's dev-time dynamic import of these files turned out unreliable
// (see that file's own comment: Rollup bundling vs. Node's native loader
// resolve differently, and neither consistently handles both real-export
// linking AND extensionless relative-import resolution inside the target
// file), so that route spawns this under vite-node instead — proven, since
// run-scenarios.mjs already succeeds this exact way for the whole corpus.
//
// Prints the resulting TraceResult[] as JSON to stdout — nothing else may
// write to stdout. A missing scenarios.ts is a hard error here, unlike
// run-scenarios.mjs's own "skip and move on to the next card" (a
// single-card caller has no next card to move on to).
//
// Usage: npx vite-node functional-model/scripts/run-one-card.mjs <slug>

const { runScenarios } = await import('../harness.ts');

const slug = process.argv[2];
if (!slug) {
  console.error('usage: run-one-card.mjs <slug>');
  process.exit(1);
}

const scenariosModule = await import(`../cards/${slug}/scenarios.ts`).catch(() => null);
if (!scenariosModule) {
  console.error(`no scenarios.ts for ${slug}`);
  process.exit(1);
}

let results;
if (typeof scenariosModule.runEngineScenarios === 'function') {
  results = scenariosModule.runEngineScenarios();
} else {
  const cardModule = await import(`../cards/${slug}/definition.ts`);
  const card = Object.values(cardModule)[0];
  results = runScenarios(card, scenariosModule.scenarios);
}

process.stdout.write(JSON.stringify(results));
