// GET /api/card-status/:set — ALL in-scope :set cards' status in one
// request, for `/app/engine/cards` (route renamed from `/app/engine/sets`,
// 2026-09-18, later same day — see `EngineConsoleTabs.vue`;
// `app/pages/app/engine/cards/` — the old standalone `/app/status` grid
// page this originally served was retired into that tab, see that page's
// own header). 2026-09-18: each served entry also carries a `baseline`/
// `color` pair translating its own real per-set status onto the shared
// gray/purple/blue/yellow/green display axis — see this file's own
// `withDisplayColor` (`fin`) / `computeFdnCardStatusPage` (`fdn`) below.
//
// **`fin` and `fdn` are two GENUINELY DIFFERENT computations, branched
// explicitly below — not one generalized "any set" rule pretending to be
// uniform** (2026-09-18, later same day, real user-diagnosed distinction):
// `fin`'s real per-card question is `functional-model/card-status.ts`'s own
// 8-bucket fact-authoring/provenance/text-coverage classifier (red/orange/
// green/yellow/gray/verified/uncertain/re-review) — meaningless for `fdn`,
// whose cards have no Facts/synergy.json/progress.json at all by design
// (the sink-only model's whole point). `fdn`'s real per-card question is
// instead "what AUTHORING-PIPELINE STAGE is this card at" —
// `functional-model/pipeline-status.ts`'s own `gray`/`purple`/`blue`/
// `yellow`/`green` axis, which ALREADY IS display-color-shaped (no 8-bucket
// fold needed at all). See `.claude/contracts/card-schema.md`'s "FDN
// authoring-pipeline status" section for the full axis writeup.
//
// **`fin` DEV**: spawns `functional-model/scripts/compute-all-card-status.mjs`
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
// **`fin` PRODUCTION**: same reasoning `server/api/card/[set]/[number].ts`'s
// own `loadFunctionalModel` NODE_ENV branch documents — a Netlify Function
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
//
// **`fdn` is DEV-ONLY, no production branch at all** — its whole
// computation reads `data/cards.db` (gitignored, 600MB+, never shipped to
// production, see `server/api/cards/by-names.ts`'s own header) and
// `functional-model/fdn-cards/<slug>/pipeline-status.json` (also never
// bundled — this is the same authoring-tool-not-shipped-app class of route
// `server/api/engine-status/source.get.ts` already is). Handled BEFORE the
// `fin`-only production/dev split below, unconditionally on `NODE_ENV` — in
// production it'll simply fail its own `existsSync(cards.db)` check and
// 500, same as any other dev-only route accidentally hit in prod.
import type { CardStatusBaseline, CardStatusColor, CardStatusBucket, CardStatusEntry } from '../../../functional-model/card-status';
import { cardStatusBaseline, cardStatusColor } from '../../../functional-model/card-status';
import type { PipelineStatus } from '../../../functional-model/pipeline-status';
import { readPipelineStatus } from '../../../functional-model/pipeline-status';
import finCardStatusData from '../../../data/fin/fin_card_status.json';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

interface CardStatusFile {
  generatedAt: string;
  set: string;
  cards: CardStatusEntry[];
}

// 2026-09-18: `/app/engine/cards` (the sole real consumer of this route)
// now renders under the SAME shared gray/purple/blue/yellow/green display
// axis `/app/engine/predicates` (`GET /api/sink-derivations`) and
// `/app/engine/features` (`GET /api/engine-status`) already use, instead of
// the checked-in 8-bucket classification's own bespoke 8-color scheme —
// see `functional-model/card-status.ts`'s own `cardStatusBaseline`/
// `cardStatusColor` doc comment for the full fold rationale. Deliberately
// applied HERE, at serve time, rather than by regenerating the checked-in
// `data/fin/fin_card_status.json` snapshot (`npm run card-status`'s own
// output) — that snapshot's real schema (`status`, the 8-bucket value)
// stays exactly as-is, still what `scripts/AI_FACT_ELIMINATION_PROCESS.md`/
// `app/lib/cardStatus.ts`/`CardDetailTabs.vue` all read; only THIS route's
// served shape gains the two extra `baseline`/`color` fields, same
// `baseline`-alongside-`color` overlay shape `SinkDerivationPageEntry`/
// `EngineStatusPageEntry` already serve for their own axes.
//
// **`status` is widened to `CardStatusBucket | PipelineStatus`
// (2026-09-18, later same day, added for `fdn`)** — for a `fin` entry this
// is still the real 8-bucket fact-authoring classification, unchanged. For
// an `fdn` entry it is instead the raw pipeline-STAGE value itself
// (`gray`/`purple`/`blue`/`yellow`/`green`) — see
// `computeFdnCardStatusPage` below. Same field name, GENUINELY DIFFERENT
// meaning depending on which set produced the entry — a consumer must
// treat this field as opaque display data (which is all `/app/engine/cards`
// itself ever does with it — see that page's own header), never assume
// it's always one of the 8 FIN buckets.
export interface CardStatusPageEntry extends Omit<CardStatusEntry, 'status'> {
  status: CardStatusBucket | PipelineStatus;
  baseline: CardStatusBaseline;
  color: CardStatusColor;
  /** Only ever set on an `fdn` entry — its `functional-model/fdn-cards/
   * <slug>/` folder name, so a caller (the Cards tab's own minimal FDN
   * detail view) can fetch/link its real on-disk source without having to
   * re-derive the slugify convention client-side. `undefined` for a `fin`
   * entry (identity there is `number`, already a real, direct route param). */
  slug?: string;
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

async function computeAllCardStatusLive(set: string): Promise<CardStatusFile> {
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync(join(process.cwd(), 'node_modules/.bin/vite-node'), [
    join(process.cwd(), 'functional-model/scripts/compute-all-card-status.mjs'),
    set,
  ]);
  return JSON.parse(stdout);
}

// ---------------------------------------------------------------------------
// `fdn` branch — a genuinely different computation, see this file's own
// header for the full rationale.

/** Same slugify convention `scripts/review-card.mjs`/`functional-model/
 * scripts/prep-card-context.mjs` already establish — duplicated here as a
 * one-liner rather than imported, same small cross-file-boundary
 * duplication trade this project already accepts elsewhere (e.g.
 * `card-status.ts`'s own `FactLike`/`SynergyLike`). */
function slugify(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface FdnCardRow {
  name: string;
  collector_number: string;
  is_normal: number;
  released_at: string;
}

/** `PipelineStatus` is already display-color-shaped (`gray`/`purple`/
 * `blue`/`yellow`/`green`) — the only fold this axis needs is `baseline`:
 * `yellow`/`green` are both real human-REVIEW overlays sitting on top of a
 * card that already passed the `blue` gate (`pipeline-status.ts`'s own
 * `applyPipelineReview` only ever transitions FROM `blue`), so both fold to
 * `blue` baseline — same "review overlay never changes the underlying
 * completeness baseline" split `card-status.ts`'s own `cardStatusBaseline`
 * already establishes for FIN's `verified`/`uncertain`/`re-review`. */
function pipelineStatusBaseline(status: PipelineStatus): CardStatusBaseline {
  return status === 'gray' || status === 'purple' ? status : 'blue';
}

function computeFdnCardStatusPage(root: string): CardStatusPageFile {
  const dbPath = join(root, 'data', 'cards.db');
  if (!existsSync(dbPath)) {
    throw new Error(`${dbPath} not found — fdn card-status needs the bulk-synced card DB (run: node scripts/sync-card-db.mjs). See this route's own header: fdn is dev-only, never shipped to production.`);
  }
  const db = new DatabaseSync(dbPath, { readOnly: true });
  let rows: FdnCardRow[];
  try {
    rows = db
      .prepare("SELECT name, collector_number, is_normal, released_at FROM cards WHERE set_code = 'fdn' ORDER BY name, is_normal DESC, released_at DESC")
      .all() as unknown as FdnCardRow[];
  } finally {
    db.close();
  }

  // Canonical row per name — first row per name group is already the
  // correct pick given the ORDER BY above (is_normal DESC, released_at
  // DESC within each name), same tiebreak `scripts/sync-card-db.mjs`'s own
  // `idx_cards_name_pick` index documents and `prep-card-context.mjs`'s
  // `resolveCard` already applies.
  const seen = new Set<string>();
  const canonicalRows: FdnCardRow[] = [];
  for (const row of rows) {
    if (seen.has(row.name)) continue;
    seen.add(row.name);
    canonicalRows.push(row);
  }

  const cards: CardStatusPageEntry[] = canonicalRows.map((row) => {
    const slug = slugify(row.name);
    const pipeline = readPipelineStatus(slug, root);
    // No folder/file at all -> the real "not started" baseline+color, same
    // visual meaning as FIN's own `gray` bucket ("nothing done yet") — NOT
    // an error; almost every real fdn row is in this state today (10 of
    // 771 have actually entered the pipeline as of this writing).
    const status: PipelineStatus = pipeline?.status ?? 'gray';
    const reasons = pipeline?.reasons?.length
      ? pipeline.reasons
      : pipeline
        ? []
        : ['not started — no functional-model/fdn-cards/ folder for this card yet'];
    return {
      number: row.collector_number,
      name: row.name,
      status,
      reasons,
      baseline: pipelineStatusBaseline(status),
      color: status,
      slug,
    };
  });

  return { generatedAt: new Date().toISOString(), set: 'fdn', cards };
}

export default defineEventHandler(async (event) => {
  const set = getRouterParam(event, 'set');
  if (!set) {
    throw createError({ statusCode: 400, statusMessage: 'Missing :set' });
  }

  if (set === 'fdn') {
    try {
      return computeFdnCardStatusPage(process.cwd());
    } catch (err) {
      throw createError({ statusCode: 500, statusMessage: `Failed to compute fdn card status: ${err instanceof Error ? err.message : String(err)}` });
    }
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
