// GET /api/card-status/:set — ALL in-scope :set cards' fact-authoring
// status in one request (`functional-model/card-status.ts`'s own 8-bucket
// classifier: red/orange/green/yellow/gray/verified/uncertain/re-review),
// for the `/app/status` grid page (`app/pages/app/status/index.vue`).
// Companion to `server/api/
// card/[set]/[number].ts`'s own per-card `cardStatus` field — same
// confirmed real bug this fixes for the GRID instead of one card: the
// checked-in `data/fin/fin_card_status.json` batch snapshot only refreshed
// on a manual `npm run card-status`, so a just-confirmed review didn't show
// as "Verified" on the grid until that script was rerun.
//
// **DEV**: spawns `functional-model/scripts/compute-all-card-status.mjs`
// under vite-node ONCE per request — that script runs
// `card-status-batch.mjs`'s `computeAllCardStatuses` (the shared core also
// used by `compute-card-status.mjs`/`npm run card-status`) pool-wide, in a
// single process, not one subprocess per card. Measured live on this
// machine: `time npx vite-node functional-model/scripts/
// compute-card-status.mjs` (the same recipe, same cost) ran in ~1.2-1.3s
// wall-clock for the full 306-card FIN pool, repeatable across runs — well
// inside a status-dashboard page's own reasonable load budget (the task
// that produced this route called sub-1-2s acceptable), so no on-disk
// caching layer was added on top: every request genuinely recomputes live,
// same "no manual regen ever needed" story `computeCardStatusLive` already
// established for the single-card route. If the FIN pool ever grows enough
// that this stops being fast enough, an on-demand-refresh-and-cache-to-disk
// fallback (mirroring this same file's own PRODUCTION branch, just
// refreshed transparently instead of only at build time) is the documented
// next step — not needed today, measured, not assumed.
//
// **PRODUCTION**: same reasoning `server/api/card/[set]/[number].ts`'s own
// `loadFunctionalModel` NODE_ENV branch documents — a Netlify Function
// can't dynamic-import `functional-model/`'s raw source tree or spawn
// vite-node at request time. Serves the checked-in `data/<set>/
// <set>_card_status.json` batch snapshot instead, via a plain static
// `import` (bundled at build time, same pattern `relationsData`/
// `finRelationsData`/`themesData` already use in that same route file) —
// NOT `readFileSync`, which `loadJsonFresh`'s own comment there notes
// fails in production (the raw repo checkout isn't shipped in the function
// bundle, only what's statically imported). Stale until `npm run
// card-status` is re-run and committed, same staleness contract every
// other checked-in generated-data consumer already carries.
import type { CardStatusEntry } from '../../../functional-model/card-status';
import finCardStatusData from '../../../data/fin/fin_card_status.json';

interface CardStatusFile {
  generatedAt: string;
  set: string;
  cards: CardStatusEntry[];
}

// Set-scoped by design, same "only FIN exists today, add a static import
// per new set later" convention `app/pages/app/status/index.vue`'s own
// (now-retired) `STATUS_FILES` map established.
const STATIC_STATUS_BY_SET: Partial<Record<string, CardStatusFile>> = {
  fin: finCardStatusData as CardStatusFile,
};

import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function computeAllCardStatusLive(set: string): Promise<CardStatusFile> {
  const { stdout } = await execFileAsync(join(process.cwd(), 'node_modules/.bin/vite-node'), [
    join(process.cwd(), 'functional-model/scripts/compute-all-card-status.mjs'),
    set,
  ]);
  return JSON.parse(stdout);
}

export default defineEventHandler(async (event) => {
  const set = getRouterParam(event, 'set');
  if (!set) {
    throw createError({ statusCode: 400, statusMessage: 'Missing :set' });
  }

  if (process.env.NODE_ENV === 'production') {
    const entry = STATIC_STATUS_BY_SET[set];
    if (!entry) throw createError({ statusCode: 404, statusMessage: `No card-status snapshot for set '${set}'` });
    return entry;
  }

  try {
    return await computeAllCardStatusLive(set);
  } catch (err) {
    throw createError({ statusCode: 500, statusMessage: `Failed to compute card status for set '${set}': ${err instanceof Error ? err.message : String(err)}` });
  }
});
