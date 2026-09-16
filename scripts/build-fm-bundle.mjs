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
import { loadOracleTextByName, computeTextCoverage } from '../functional-model/scripts/text-coverage.mjs';
import { classifyCardStatus } from '../functional-model/card-status.ts';

const ROOT = new URL('../', import.meta.url);
const cardsDir = new URL('cards/', new URL('functional-model/', ROOT));
const dataDir = new URL('data/', ROOT);
const outPath = join(process.cwd(), 'data/functional-model/fm-bundle.json');

// Real Scryfall oracle text by card name, across every checked-in set — same
// pool-wide scan `functional-model/scripts/compute-card-status.mjs` does for
// its own batch run (see that script's own header); done ONCE here too,
// since `cardStatus` below (2026-09-16) needs it for the same
// `computeTextCoverage` check that script runs, and this bundle-build
// script itself only ever runs at authoring/commit time, not per-request.
const oracleByName = await loadOracleTextByName(dataDir);

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
  // `uncertain`-bucket free-text caveat (2026-09-17, see card-status.ts's own
  // header) — threaded into `classifyCardStatus` below AND carried on the
  // bundle entry itself so the served `FunctionalModelData.reviewCaveat`
  // (the "Confirm (Uncertain)" UI's own pre-fill value) is correct in
  // production too, not just via the dev-live path.
  const reviewCaveat = typeof progress?.reviewCaveat === 'string' && progress.reviewCaveat.trim() ? progress.reviewCaveat : undefined;
  const scenariosReview = progress?.scenariosReview === 'reviewed' ? 'reviewed' : 'draft';
  const interactionsReview = progress?.interactionsReview === 'reviewed' ? 'reviewed' : 'draft';
  // 2026-09-16 annotation-taxonomy rework — see progress.json's own
  // `annotatedNonFactSpans` (.claude/contracts/card-schema.md). Passthrough
  // only; this script doesn't validate the shape.
  const annotatedNonFactSpans = Array.isArray(progress?.annotatedNonFactSpans) ? progress.annotatedNonFactSpans : [];

  // cards/<slug>/verified-snapshot.json's own `capturedAt` (see server/api/
  // card/[set]/[number].ts's own `reviewSnapshotAt` doc comment) — `null`
  // when the card has no verified-snapshot.json (never confirmed, or not
  // yet backfilled).
  const verifiedSnapshot = await readJson(join(dir, 'verified-snapshot.json'), null);
  const reviewSnapshotAt = typeof verifiedSnapshot?.capturedAt === 'string' ? verifiedSnapshot.capturedAt : null;

  // Per-card fact-authoring status (2026-09-16) — same
  // classifyCardStatus/computeTextCoverage recipe compute-card-status.mjs
  // runs pool-wide, computed here at bundle-build time instead (production
  // reads this precomputed value; dev computes it live per request — see
  // server/api/card/[set]/[number].ts). `definition` here is the SAME
  // already-imported `card` object used for `poolFacts` below (real
  // `effects`/`triggers`/`abilities` and all — `card-status.ts`'s own
  // `collectEffects` needs the full object, not the stripped-down
  // `poolFacts` subset this bundle otherwise ships).
  const oracle = oracleByName.get(card.name);
  let textCoverage;
  if (rawSynergy && oracle) {
    const oracleByFace = { front: oracle.front?.oracleText, back: oracle.back?.oracleText };
    try {
      textCoverage = computeTextCoverage(rawSynergy, oracleByFace, annotatedNonFactSpans);
    } catch {
      textCoverage = undefined;
    }
  }
  // No real per-card "number" (collector number) available at this scope
  // (this script iterates functional-model/cards/<slug>/ directories, not
  // fin_scryfall.json's own card list, unlike compute-card-status.mjs) —
  // left empty; no consumer renders `CardStatusEntry.number`/`.name`,
  // only `.status`/`.reasons` (see CardDetailTabs.vue).
  const cardStatus = classifyCardStatus({ number: '', name: card.name, definition: card, synergy: rawSynergy ?? undefined, textCoverage, review, reviewCaveat });

  // Source text for the Card Definition tab (FunctionalModelScript.vue) —
  // this card's own definition.ts ONLY. Used to also concatenate
  // scenarios.ts's raw source when it used the real-engine-piloted
  // runEngineScenarios shape, mirroring loadFunctionalModel's dev path —
  // removed (here and there) since that leaked scenario content into the
  // Definition tab; scenario content belongs exclusively under the
  // Scenarios tab (`traces`, above).
  const source = await readFile(definitionPath, 'utf8');

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
    reviewCaveat,
    scenariosReview,
    interactionsReview,
    reviewSnapshotAt,
    source,
    annotatedNonFactSpans,
    cardStatus,
  };
}

await mkdir(join(process.cwd(), 'data/functional-model'), { recursive: true });
await writeFile(outPath, JSON.stringify(bundle));
console.log(`wrote ${outPath}: ${Object.keys(bundle).length} cards (${skipped} skipped)`);
