// GET /api/card-status/sets — thin discovery endpoint for `/app/engine/cards`'
// (route renamed from `/app/engine/sets`, 2026-09-18, later same day — see
// `app/components/engine-console/EngineConsoleTabs.vue`) own set-picker
// dropdown: which set codes actually have card-status-computable data. A
// plain filesystem/DB existence scan, nothing more — deliberately does NOT
// import or otherwise reach into `functional-model/` itself, same
// "thin data endpoint feeding a ui page" pattern already established by
// server/api/graph-links.ts / server/api/keywords/index.get.ts (this
// route's own sibling `[set].get.ts` is the one that actually computes/
// serves a given set's status; this one only answers "which sets could that
// route serve at all").
//
// **Two genuinely different discovery rules for two genuinely different
// kinds of "set," not one generalized rule** (2026-09-18, later same day —
// see `[set].get.ts`'s own header for why FDN's whole computation is a
// separate branch, not a generic fold):
//   - `fin` (and any future set following the SAME old per-set-snapshot
//     convention): a checked-in `data/<set>/<set>_scryfall.json` — the
//     exact file `functional-model/scripts/card-status-batch.mjs`'s own
//     `computeAllCardStatuses` requires (see that file's own doc comment:
//     "expects `data/<setSlug>/<setSlug>_scryfall.json` to exist"). Picks up
//     any newly added set automatically (no hardcoded list to maintain) the
//     moment its own snapshot file lands.
//   - `fdn`: NOT a snapshot file at all — its real Scryfall data lives in
//     the bulk-synced `data/cards.db` (`set_code='fdn'`, 771 rows — see
//     `functional-model/scripts/prep-card-context.mjs`'s own header for the
//     full "why no `data/fdn/` snapshot" story). Available iff `cards.db`
//     exists AND has at least one real `fdn` row — same `node:sqlite`
//     `DatabaseSync` pattern `prep-card-context.mjs`/`scripts/
//     sync-card-db.mjs` already use. `cards.db` is gitignored/local-only
//     (631MB+), so this is a dev-machine-only availability check by
//     construction — in production (no `cards.db` shipped) `fdn` simply
//     never appears in this list, which is fine: nothing about this feature
//     is wired for production serving.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function finLikeSets(dataDir: string): string[] {
  let dirs: string[] = [];
  try {
    dirs = readdirSync(dataDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
  return dirs.filter((set) => existsSync(join(dataDir, set, `${set}_scryfall.json`)));
}

function hasFdnRows(dbPath: string): boolean {
  if (!existsSync(dbPath)) return false;
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const row = db.prepare("SELECT 1 FROM cards WHERE set_code = 'fdn' LIMIT 1").get();
    return !!row;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export default defineEventHandler(() => {
  const dataDir = join(process.cwd(), 'data');
  const sets = new Set(finLikeSets(dataDir));
  if (hasFdnRows(join(dataDir, 'cards.db'))) sets.add('fdn');
  return [...sets].sort();
});
