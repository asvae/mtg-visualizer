// Whole-pool variant of `compute-one-card-status.mjs`, for
// `server/api/card-status/[set].get.ts`'s DEV branch (the `/app/status`
// grid page's own live-status fix, 2026-09-16 — companion to the
// single-card `cardStatus` fix on the card detail page): spawned ONCE per
// grid-page request via vite-node (same `execFileAsync` pattern
// `computeTracesLive`/`computeCardStatusLive` in
// `server/api/card/[set]/[number].ts` already use, and for the identical
// reason — a `.mjs` sibling of an already-dynamically-imported `.ts` file
// isn't traced/rewritten by Nitro's dev bundler the same way that route's
// other `.ts` imports are, so this has to run as a real subprocess, not an
// in-process import), it runs `card-status-batch.mjs`'s
// `computeAllCardStatuses` — the EXACT SAME recipe `compute-card-status.mjs`
// runs into `data/fin/fin_card_status.json`, just for the WHOLE in-scope
// pool in one process instead of fanning out one subprocess per card (which
// would be ~300x the vite-node startup overhead for no benefit — this
// script's own dynamic-import loop is already one process reusing one
// module cache, same cost shape `compute-card-status.mjs` itself already
// has; measured ~1.2s wall-clock for the full 306-card FIN pool including
// vite-node's own startup, see server/api/card-status/[set].get.ts's own
// header for the measurement this was sized against).
//
// Prints `{ generatedAt, set, cards }` as JSON to stdout — nothing else may
// write to stdout. Drops `tally`/`importErrorBySlug` (CLI-only diagnostics
// `compute-card-status.mjs` still prints for a human running `npm run
// card-status`; not meaningful payload for this route's client).
//
// Usage: npx vite-node functional-model/scripts/compute-all-card-status.mjs <set>
import { computeAllCardStatuses } from './card-status-batch.mjs';

const setSlug = process.argv[2];
if (!setSlug) {
  console.error('usage: compute-all-card-status.mjs <set>');
  process.exit(1);
}

const { generatedAt, set, cards } = await computeAllCardStatuses(setSlug);
process.stdout.write(JSON.stringify({ generatedAt, set, cards }));
