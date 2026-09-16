// Single-card variant of compute-card-status.mjs's own classification —
// spawned as a child process by server/api/card/[set]/[number].ts's own
// live, per-request `cardStatus` computation (2026-09-16 — the fix for a
// confirmed real bug: the checked-in `data/fin/fin_card_status.json` batch
// snapshot only refreshes on a manual `npm run card-status`, so a
// just-confirmed review didn't show as "Verified" on that card's own page
// until that script was rerun). Same reason `run-one-card.mjs` exists for
// `computeTracesLive` in that route: a first attempt had the route
// statically `import`ing `computeTextCoverage` straight from this
// directory's own `text-coverage.mjs` and calling `classifyCardStatus`
// in-process, which resolved fine under `npx tsc --noEmit` but broke at
// actual request time in Nitro's dev server (`Cannot find module
// '/functional-model/scripts/text-coverage.mjs' imported from
// .../.nuxt/dev/index.mjs`) — a `.mjs` sibling of an already-dynamically-
// imported `.ts` file apparently isn't traced/rewritten the same way
// Nitro's bundler handles this route's other `.ts` imports. Spawning this
// script under vite-node sidesteps that the same way `run-one-card.mjs`
// already does for traces.
//
// Runs the EXACT SAME recipe `compute-card-status.mjs` runs pool-wide, for
// just one slug: dynamic-imports `definition.ts`, reads `synergy.json` off
// disk, resolves real Scryfall oracle text (this directory's own
// `text-coverage.mjs`'s `loadOracleTextByName`), computes text coverage,
// reads `progress.json`'s `review` + `annotatedNonFactSpans` +
// `reviewCaveat` (2026-09-17, `uncertain` bucket — see `card-status.ts`'s
// own header), calls `classifyCardStatus`.
//
// Prints the resulting `CardStatusEntry` as JSON to stdout — nothing else
// may write to stdout. A missing/unimportable `definition.ts` still prints
// a real entry (`classifyCardStatus`'s own `gray` bucket handles `undefined`
// definition/synergy already), never a hard error — this is a
// best-effort status badge, not a build gate.
//
// Usage: npx vite-node functional-model/scripts/compute-one-card-status.mjs <slug> <number>

import { readFile } from 'node:fs/promises';
import { loadOracleTextByName, computeTextCoverage } from './text-coverage.mjs';
import { classifyCardStatus } from '../card-status.ts';

const slug = process.argv[2];
const number = process.argv[3] ?? '';
if (!slug) {
  console.error('usage: compute-one-card-status.mjs <slug> <number>');
  process.exit(1);
}

const cardsDir = new URL('../cards/', import.meta.url);
const dataDir = new URL('../../data/', import.meta.url);

let definition;
try {
  const cardModule = await import(new URL(`${slug}/definition.ts`, cardsDir).href);
  definition = Object.values(cardModule)[0];
} catch {
  definition = undefined;
}

let synergy;
try {
  synergy = JSON.parse(await readFile(new URL(`${slug}/synergy.json`, cardsDir), 'utf8'));
} catch {
  synergy = undefined;
}

let progress;
try {
  progress = JSON.parse(await readFile(new URL(`${slug}/progress.json`, cardsDir), 'utf8'));
} catch {
  progress = undefined;
}
// 3 real values (2026-09-17): 'ai' (never reviewed / manually unconfirmed),
// 'human' (confirmed on current content), 'regression' (was 'human',
// auto-reset by check-verified-regressions.mjs's own drift detection — see
// card-status.ts's own header for the full re-review-bucket rationale).
// Anything else (missing progress.json, no review field, an unrecognized
// value) degrades to undefined, same tolerance every other optional field
// here already has.
const review =
  progress?.review === 'human' ? 'human' : progress?.review === 'regression' ? 'regression' : progress?.review === 'ai' ? 'ai' : undefined;
const annotatedNonFactSpans = Array.isArray(progress?.annotatedNonFactSpans) ? progress.annotatedNonFactSpans : [];
const reviewCaveat = typeof progress?.reviewCaveat === 'string' ? progress.reviewCaveat : undefined;

let textCoverage;
if (synergy && definition?.name) {
  const oracleByName = await loadOracleTextByName(dataDir);
  const oracle = oracleByName.get(definition.name);
  if (oracle) {
    const oracleByFace = { front: oracle.front?.oracleText, back: oracle.back?.oracleText };
    try {
      textCoverage = computeTextCoverage(synergy, oracleByFace, annotatedNonFactSpans);
    } catch {
      textCoverage = undefined;
    }
  }
}

const entry = classifyCardStatus({
  number,
  name: definition?.name ?? slug,
  definition,
  synergy,
  textCoverage,
  review,
  reviewCaveat,
});

process.stdout.write(JSON.stringify(entry));
