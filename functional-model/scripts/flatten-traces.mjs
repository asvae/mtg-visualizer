// Flattens each card's own trace.json (an array of {scenario, log: [...]})
// into flat-trace.json — a flat list of this card's own DISTINCT events,
// `scenario` dropped (which scenario triggered a fact doesn't matter for
// matching, only whether the fact is real and unique — two scenarios
// producing the identical entry, e.g. The Final Days' two flashback
// scenarios both logging `move ... to: exile`, collapse to one). `card` DOES
// stay on entries where the card is the actual subject of the fact
// (cast/move/trigger/activate/enters — see card.ts's own lifecycle
// functions); it's genuinely part of what the fact means there, not
// attribution metadata.
//
// `instanceId` is stripped here too, even though harness.ts's lifecycle
// entries carry it: every isolated scenario's `self` is a stable constant
// (`SELF_INSTANCE_ID = 1`, see harness.ts) since nothing chains multiple
// resolutions together yet, so it can never actually differentiate anything
// in THIS file — pure noise until a real multi-instance joint-scenario
// driver exists. Kept in trace.json (the raw harness output) either way.
//
// Usage: npx vite-node functional-model/scripts/flatten-traces.mjs

import { readdir, readFile, writeFile } from 'node:fs/promises';

const cardsDir = new URL('../cards/', import.meta.url);
const slugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

for (const slug of slugs) {
  const traceRaw = await readFile(new URL(`../cards/${slug}/trace.json`, import.meta.url), 'utf8').catch(() => null);
  if (!traceRaw) {
    console.log(`skip ${slug}: no trace.json (run run-scenarios.mjs first)`);
    continue;
  }
  const traces = JSON.parse(traceRaw);

  const seen = new Set();
  const flat = [];
  for (const t of traces) {
    for (const { instanceId, ...entry } of t.log) {
      const key = JSON.stringify(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      flat.push(entry);
    }
  }

  const outPath = new URL(`../cards/${slug}/flat-trace.json`, import.meta.url);
  await writeFile(outPath, JSON.stringify(flat, null, 2) + '\n', 'utf8');
  console.log(`wrote cards/${slug}/flat-trace.json (${flat.length} unique entries, from ${traces.length} scenarios)`);
}
