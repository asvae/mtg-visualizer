// GET /api/card-status/:set — ALL in-scope :set cards' fact-authoring
// status in one request (`functional-model/card-status.ts`'s own 8-bucket
// classifier: red/orange/green/yellow/gray/verified/uncertain/re-review),
// for `/app/engine/sets` (`app/pages/app/engine/sets/index.vue` — the old
// standalone `/app/status` grid page this originally served was retired
// into that tab, see that page's own header). 2026-09-18: each served
// entry also carries a `baseline`/`color` pair translating the 8-bucket
// `status` onto the shared gray/purple/blue/yellow/green display axis —
// see this file's own `withDisplayColor`/`CardStatusPageEntry` below.
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
import type { CardStatusBaseline, CardStatusColor, CardStatusEntry } from '../../../functional-model/card-status';
import { cardStatusBaseline, cardStatusColor } from '../../../functional-model/card-status';
import finCardStatusData from '../../../data/fin/fin_card_status.json';

interface CardStatusFile {
  generatedAt: string;
  set: string;
  cards: CardStatusEntry[];
}

// 2026-09-18: `/app/engine/sets` (the sole real consumer of this route, see
// this file's own grep-confirmed usage) now renders under the SAME shared
// gray/purple/blue/yellow/green display axis `/app/engine/predicates`
// (`GET /api/sink-derivations`) and `/app/engine/features`
// (`GET /api/engine-status`) already use, instead of the checked-in
// 8-bucket classification's own bespoke 8-color scheme — see
// `functional-model/card-status.ts`'s own `cardStatusBaseline`/
// `cardStatusColor` doc comment for the full fold rationale. Deliberately
// applied HERE, at serve time, rather than by regenerating the checked-in
// `data/fin/fin_card_status.json` snapshot (`npm run card-status`'s own
// output) — that snapshot's real schema (`status`, the 8-bucket value)
// stays exactly as-is, still what `scripts/AI_FACT_ELIMINATION_PROCESS.md`/
// `app/lib/cardStatus.ts`/`CardDetailTabs.vue` all read; only THIS route's
// served shape gains the two extra `baseline`/`color` fields, same
// `baseline`-alongside-`color` overlay shape `SinkDerivationPageEntry`/
// `EngineStatusPageEntry` already serve for their own axes.
export interface CardStatusPageEntry extends CardStatusEntry {
  baseline: CardStatusBaseline;
  color: CardStatusColor;
}

interface CardStatusPageFile {
  generatedAt: string;
  set: string;
  cards: CardStatusPageEntry[];
}

function withDisplayColor(file: CardStatusFile): CardStatusPageFile {
  return {
    ...file,
    cards: file.cards.map((entry) => ({
      ...entry,
      baseline: cardStatusBaseline(entry.status),
      color: cardStatusColor(entry.status),
    })),
  };
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
    return withDisplayColor(entry);
  }

  try {
    return withDisplayColor(await computeAllCardStatusLive(set));
  } catch (err) {
    throw createError({ statusCode: 500, statusMessage: `Failed to compute card status for set '${set}': ${err instanceof Error ? err.message : String(err)}` });
  }
});
