// Shared per-set, WHOLE-POOL status computation core — extracted
// (2026-09-16) out of `compute-card-status.mjs` so that script (writes
// `data/<set>/<set>_card_status.json` to disk, the `npm run card-status`
// entry point) and `compute-all-card-status.mjs` (prints the same payload
// to stdout for `server/api/card-status/[set].get.ts` to spawn live, one
// request = one process, no per-card subprocess fan-out) run the EXACT
// SAME recipe instead of it being duplicated a third time. Both callers
// import `computeAllCardStatuses` from here; neither re-implements any of
// the dynamic-import/fs-read/classify loop itself.
//
// Deliberately NOT also folded together with `compute-one-card-status.mjs`
// (the SINGLE-card variant `server/api/card/[set]/[number].ts` spawns per
// card-detail-page request) — that script's own per-card body looks
// similar but is genuinely a different shape (no name->slug pool scan, no
// tally, no importErrorBySlug, argv-driven single slug/number instead of a
// whole scryfall.json listing) and was already a working, tested precedent
// before this task; forcing it through this same function would mean
// building the WHOLE nameToSlug map (a full directory scan + dynamic
// import of every OTHER card) just to serve one card, which is exactly the
// per-request cost this refactor exists to avoid for the single-card path.
// Left as its own small, intentional duplication rather than a triplicated
// recipe — the real duplication this task called out (compute-card-
// status.mjs's pool-wide loop vs. the new batch route needing the same
// pool-wide loop) is what's unified here.
//
// See `compute-card-status.mjs`'s own header for the full recipe rationale
// (dynamic-import every `cards/<slug>/definition.ts`, read `synergy.json`,
// resolve real Scryfall oracle text, `computeTextCoverage`, read
// `progress.json`'s `review`/`annotatedNonFactSpans`/`reviewCaveat`,
// `classifyCardStatus`) — unchanged here, just relocated.
import { readFile, readdir } from 'node:fs/promises';
import { loadOracleTextByName, computeTextCoverage } from './text-coverage.mjs';
import { classifyCardStatus } from '../card-status.ts';

const cardsDir = new URL('../cards/', import.meta.url);
const dataDir = new URL('../../data/', import.meta.url);

/**
 * @param {string} setSlug e.g. 'fin' — expects `data/<setSlug>/<setSlug>_scryfall.json`
 *   to exist, same convention `data/fin/fin_scryfall.json` already
 *   establishes (the only real set this runs against today).
 */
export async function computeAllCardStatuses(setSlug) {
  const scryfallUrl = new URL(`../../data/${setSlug}/${setSlug}_scryfall.json`, import.meta.url);
  const allCards = JSON.parse(await readFile(scryfallUrl, 'utf8'));
  // Same in-scope filter `relations.test.mjs`/`generate-set-status.mjs` use.
  const inScope = allCards.filter((c) => !(c.type_line ?? '').includes('Basic') && !c.digital);

  const oracleByName = await loadOracleTextByName(dataDir);

  const cardDirs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

  // Real-name -> slug map, built by dynamically importing every card
  // directory's own `definition.ts` ONCE — see `compute-card-status.mjs`'s
  // own (now-relocated) comment for why this is preferred over guessing a
  // slug via `slugify(name)`.
  const nameToSlug = new Map();
  const defBySlug = new Map();
  const importErrorBySlug = new Map();
  for (const slug of cardDirs) {
    let mod;
    try {
      mod = await import(new URL(`${slug}/definition.ts`, cardsDir).href);
    } catch (err) {
      importErrorBySlug.set(slug, err instanceof Error ? err.message : String(err));
      continue;
    }
    const def = Object.values(mod)[0];
    if (!def?.name) continue;
    defBySlug.set(slug, def);
    nameToSlug.set(def.name, slug);
    if (def.backFace?.name) nameToSlug.set(`${def.name} // ${def.backFace.name}`, slug);
  }

  const results = [];
  const tally = { verified: 0, uncertain: 0, 're-review': 0, green: 0, yellow: 0, orange: 0, red: 0, gray: 0 };

  for (const card of inScope) {
    const name = card.name;
    const number = card.collector_number;
    const slug = nameToSlug.get(name);

    let definition;
    let synergy;
    let textCoverage;
    let review;
    let reviewCaveat;

    if (slug) {
      definition = defBySlug.get(slug);
      try {
        synergy = JSON.parse(await readFile(new URL(`${slug}/synergy.json`, cardsDir), 'utf8'));
      } catch {
        synergy = undefined;
      }
      // `progress.json`'s own `review` field — see compute-card-status.mjs's
      // relocated comment. Missing/unparseable `progress.json` degrades to
      // `undefined` (never upgrades), same tolerance every other optional
      // per-card read here already has.
      let progress;
      try {
        progress = JSON.parse(await readFile(new URL(`${slug}/progress.json`, cardsDir), 'utf8'));
      } catch {
        progress = undefined;
      }
      review = progress?.review;
      // `progress.json`'s own `reviewCaveat` (2026-09-17, `uncertain` bucket
      // — see card-status.ts's own header) — read the same tolerant way as
      // `review` (missing/unparseable `progress.json` degrades to
      // `undefined`, never a hard failure).
      reviewCaveat = typeof progress?.reviewCaveat === 'string' ? progress.reviewCaveat : undefined;
      if (synergy) {
        const oracle = oracleByName.get(name);
        if (oracle) {
          const oracleByFace = { front: oracle.front?.oracleText, back: oracle.back?.oracleText };
          try {
            textCoverage = computeTextCoverage(synergy, oracleByFace, progress?.annotatedNonFactSpans ?? []);
          } catch {
            textCoverage = undefined;
          }
        }
      }
    }

    const entry = classifyCardStatus({ number, name, definition, synergy, textCoverage, review, reviewCaveat });
    results.push(entry);
    tally[entry.status]++;
  }

  results.sort((a, b) => Number(a.number) - Number(b.number) || a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    set: setSlug,
    cards: results,
    tally,
    importErrorBySlug,
  };
}
