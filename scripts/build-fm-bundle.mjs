// Builds data/functional-model/fm-bundle.json — a single, committed,
// production-servable snapshot of every functional-model/cards/<slug>/'s
// generated artifacts (synergy.json/trace.json/progress.json) PLUS the
// handful of real CardDefinition fields (name/manaCost/typeLine/cmc/pt)
// server/utils/functionalModelPool.ts's cross-card matcher needs but can't
// get without actually executing definition.ts.
//
// Why this exists: server/api/card/[set]/[number].ts's loadFunctionalModel
// and functionalModelPool.ts's loadFunctionalModelPool both read raw
// functional-model/ source off disk (readFileSync/readdirSync/dynamic
// import()) at REQUEST time — fine in dev (`nuxt dev` runs from the real
// source tree), but none of that survives a Netlify Function bundle: Nitro/
// Rollup only ships statically-traced imports, not a scanned directory, a
// dynamically-imported .ts module, or a spawned vite-node binary (confirmed
// in prod as ENOENT scandir '/var/task/functional-model' — see git blame on
// the NODE_ENV==='production' guards in both those files). This script runs
// the equivalent extraction ONCE, here, at authoring time (same "generate
// then commit" convention synergy.json/trace.json/progress.json themselves
// already follow — see functional-model/scripts/find-synergies.mjs's own
// header) and writes ONE plain JSON file under data/ — the exact same
// directory server/api/card/[set]/[number].ts already statically imports
// data/global_relations.json etc. from, which Rollup DOES trace and bundle.
// The two request-time reader files then get a `NODE_ENV==='production'`
// branch that reads this bundle's already-in-memory object instead of
// touching disk at all — zero fs access, zero subprocess, exactly what a
// Netlify Function bundle supports.
//
// Deliberately NOT wired into `npm run build` — this only needs re-running
// when functional-model/cards/ actually changes (new card, edited
// definition.ts/synergy.json/trace.json/progress.json), same manual
// "regenerate, then commit" cadence synergy.json/trace.json already have via
// functional-model/scripts/*.mjs. Re-run and commit the diff whenever the
// engine agent's corpus changes.
//
// Usage: npx vite-node scripts/build-fm-bundle.mjs (or `npm run sync:fm-bundle`)

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url);
const cardsDir = new URL('cards/', new URL('functional-model/', ROOT));
const outPath = join(process.cwd(), 'data/functional-model/fm-bundle.json');

function isV2Shaped(synergy) {
  const all = [...(synergy?.source ?? []), ...(synergy?.sink ?? [])];
  return all.length > 0 && all.every((f) => typeof f === 'object' && f !== null && ('zone' in f || 'event' in f));
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

const slugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();

const bundle = {};
let skipped = 0;

for (const slug of slugs) {
  const dir = join(process.cwd(), `functional-model/cards/${slug}`);

  // Real CardDefinition fields the cross-card matcher (functional-model/
  // synergy.ts's staticAttrsFor/resolveSubject) reads off `PoolCard.card` —
  // name/manaCost/typeLine (required on CardDefinition) plus cmc/pt
  // (optional, read when present). Nothing else of CardDefinition is ever
  // read for matching (confirmed against every `.card.` access in
  // synergy.ts) — deliberately NOT shipping `effects`/`triggers`/etc, which
  // would mean re-serializing arbitrary Effect ASTs for no reader.
  const definitionPath = join(dir, 'definition.ts');
  if (!existsSync(definitionPath)) {
    console.log(`skip ${slug}: no definition.ts`);
    skipped++;
    continue;
  }
  const cardModule = await import(`../functional-model/cards/${slug}/definition.ts`).catch(() => null);
  const card = cardModule ? Object.values(cardModule)[0] : null;
  if (!card?.name) {
    console.log(`skip ${slug}: definition.ts has no exported CardDefinition`);
    skipped++;
    continue;
  }

  const rawSynergy = await readJson(join(dir, 'synergy.json'), null);
  const synergy = isV2Shaped(rawSynergy)
    ? {
        source: (rawSynergy.source ?? []).map((f) => ({ ...f, role: 'source' })),
        sink: (rawSynergy.sink ?? []).map((f) => ({ ...f, role: 'sink' })),
      }
    : null;

  const traces = await readJson(join(dir, 'trace.json'), []);

  const progress = await readJson(join(dir, 'progress.json'), null);
  const review = progress?.review === 'human' ? 'human' : 'ai';
  const scenariosReview = progress?.scenariosReview === 'reviewed' ? 'reviewed' : 'draft';
  const interactionsReview = progress?.interactionsReview === 'reviewed' ? 'reviewed' : 'draft';

  // Source text for the Card Definition tab (FunctionalModelScript.vue) —
  // same definition.ts (+ scenarios.ts, when it's the real-engine-piloted
  // runEngineScenarios shape) concatenation loadFunctionalModel's dev path
  // already builds, done once here instead of at request time.
  let source = await readFile(definitionPath, 'utf8');
  const scenariosPath = join(dir, 'scenarios.ts');
  const scenariosSource = existsSync(scenariosPath) ? await readFile(scenariosPath, 'utf8') : '';
  if (/export\s+function\s+runEngineScenarios\b/.test(scenariosSource)) {
    source += `\n\n// ============================================================\n// scenarios.ts — this card's own real engine-piloted trace\n// ============================================================\n\n${scenariosSource}`;
  }

  bundle[slug] = {
    name: card.name,
    // `continuousKeywordGrants` (+ its `backFace` mirror) — 2026-09-12,
    // ENGINE_GAPS.md gap #14 closure — is a plain declarative CardDefinition
    // field (613, same category as `manaCost`/`typeLine` above, NOT an
    // `Effect`/`resolveCard()` internal), so serving it here doesn't cross
    // the "card must not assume Effect kinds" line in card-schema.md.
    // `app/components/ScenarioReplayTrace.vue` reads it at RENDER time
    // (cross-referenced against each snapshot's own `activePlayer`/owner/
    // subtype) to show a continuously-granted keyword — see that
    // component's own doc comment for why a discrete trace.json log entry
    // can't represent this (it's query-time, not event-triggered). `backFace`
    // only ever carries the few fields that component needs (its own
    // `continuousKeywordGrants`) — not a full nested CardDefinition.
    poolFacts: {
      name: card.name,
      manaCost: card.manaCost,
      typeLine: card.typeLine,
      cmc: card.cmc,
      pt: card.pt,
      continuousKeywordGrants: card.continuousKeywordGrants,
      backFace: card.backFace
        ? { name: card.backFace.name, manaCost: card.backFace.manaCost, typeLine: card.backFace.typeLine, continuousKeywordGrants: card.backFace.continuousKeywordGrants }
        : undefined,
    },
    synergy,
    traces,
    review,
    scenariosReview,
    interactionsReview,
    source,
  };
}

await mkdir(join(process.cwd(), 'data/functional-model'), { recursive: true });
await writeFile(outPath, JSON.stringify(bundle));
console.log(`wrote ${outPath}: ${Object.keys(bundle).length} cards (${skipped} skipped)`);
