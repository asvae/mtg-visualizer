// CLI wrapper around `text-coverage.mjs`'s `computeTextCoverage` — see that
// file's own header for scope/rationale. Pool-wide, INFORMATIONAL ONLY
// (never a hard-fail exit code — real, honest, partial coverage is a normal
// and expected state for a lot of this pool, not a bug to gate a run on;
// see `text-coverage.mjs`'s own doc comment). Prints every real v2-shaped
// card whose own coverage `ratio` is below `--threshold` (default 0.85) —
// a real, low-value textual gap, not necessarily a synergy-relevant one.
//
// Usage: npx vite-node functional-model/scripts/verify-text-coverage.mjs [--threshold=0.85] [slug...]
import { readFile, readdir } from 'node:fs/promises';
import { loadOracleTextByName, computeTextCoverage } from './text-coverage.mjs';

const cardsDir = new URL('../cards/', import.meta.url);
const dataDir = new URL('../../data/', import.meta.url);

const args = process.argv.slice(2);
const thresholdArg = args.find((a) => a.startsWith('--threshold='));
const threshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : 0.85;
const requestedSlugs = args.filter((a) => !a.startsWith('--'));

const oracleByName = await loadOracleTextByName(dataDir);
const allSlugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
const slugs = requestedSlugs.length > 0 ? requestedSlugs : allSlugs;

let checked = 0;
let incomplete = 0;
const results = [];

for (const slug of slugs) {
  let facts;
  try {
    facts = JSON.parse(await readFile(new URL(`${slug}/synergy.json`, cardsDir), 'utf8'));
  } catch {
    continue;
  }
  const all = [...(facts.source ?? []), ...(facts.sink ?? [])];
  if (all.length === 0 || !all.every((f) => typeof f === 'object' && f !== null && ('zone' in f || 'to' in f || 'from' in f || 'event' in f))) continue;

  let card;
  try {
    const mod = await import(new URL(`${slug}/definition.ts`, cardsDir).href);
    card = Object.values(mod)[0];
  } catch {
    continue;
  }
  if (!card?.name) continue;
  const lookupName = card.backFace?.name ? `${card.name} // ${card.backFace.name}` : card.name;
  const oracle = oracleByName.get(lookupName);
  if (!oracle) continue;

  const oracleByFace = { front: oracle.front?.oracleText, back: oracle.back?.oracleText };
  // `progress.json`'s own `annotatedNonFactSpans` (2026-09-16, annotation-
  // taxonomy plumbing — same read `compute-card-status.mjs` now performs,
  // see that script's own header) — kept consistent with the dashboard
  // classifier's own verdict rather than leaving this sibling diagnostic
  // reporting a stale gap the dashboard no longer does.
  let progress;
  try {
    progress = JSON.parse(await readFile(new URL(`${slug}/progress.json`, cardsDir), 'utf8'));
  } catch {
    progress = undefined;
  }
  const { ratio, gaps } = computeTextCoverage(facts, oracleByFace, progress?.annotatedNonFactSpans ?? []);
  checked++;
  if (ratio < threshold && gaps.length > 0) {
    incomplete++;
    results.push({ slug, ratio, gaps });
  }
}

results.sort((a, b) => a.ratio - b.ratio);
for (const r of results) {
  console.log(`${r.slug}: ${(r.ratio * 100).toFixed(0)}% covered`);
  for (const g of r.gaps) console.log(`  · [${g.face}:${g.line}] uncovered: "${g.text}"`);
}

console.log(`\n${checked} v2 card(s) checked, ${incomplete} below ${(threshold * 100).toFixed(0)}% real-text coverage (informational only, not a hard failure — see this script's own header).`);
