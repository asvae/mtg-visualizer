// GET /api/card-status/sets — thin discovery endpoint for `/app/engine/sets`'
// own set-picker dropdown: which set codes actually have card-status-
// computable data, i.e. a checked-in `data/<set>/<set>_scryfall.json` — the
// exact file `functional-model/scripts/card-status-batch.mjs`'s own
// `computeAllCardStatuses` requires (see that file's own doc comment:
// "expects `data/<setSlug>/<setSlug>_scryfall.json` to exist"). A plain
// filesystem existence scan, nothing more — deliberately does NOT import or
// otherwise reach into `functional-model/` itself, same "thin data endpoint
// feeding a ui page" pattern already established by
// server/api/graph-links.ts / server/api/keywords/index.get.ts (this
// route's own sibling `[set].get.ts` is the one that actually computes/
// serves a given set's status; this one only answers "which sets could that
// route serve at all").
//
// Only `fin` exists today — returns just that — but picks up any newly
// added set automatically (no hardcoded list to maintain) the moment its own
// `data/<set>/<set>_scryfall.json` lands, e.g. a future FDN drop.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export default defineEventHandler(() => {
  const dataDir = join(process.cwd(), 'data');
  let dirs: string[] = [];
  try {
    dirs = readdirSync(dataDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
  return dirs.filter((set) => existsSync(join(dataDir, set, `${set}_scryfall.json`))).sort();
});
