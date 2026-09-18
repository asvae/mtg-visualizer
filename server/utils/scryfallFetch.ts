// Shared, paced fetch wrapper for every LIVE Scryfall network call this
// server process makes — extracted (2026-09-18) from
// `server/api/card/[set]/[number].ts`'s own private `scryfallFetch` so a
// second importer (`server/utils/cardMeta.ts`'s own live-lookup leg, used by
// both that route and `server/api/sink-catalog/index.get.ts`) draws down the
// SAME single per-process pacer, not a second independent 110ms clock — the
// whole point of pacing is staying under Scryfall's real 10req/s guideline
// for the process as a WHOLE, not per importing file (an unpaced duplicate
// pacer would let two routes' bursts double the effective rate and
// reintroduce the exact 429 this was built to avoid — see this file's own
// origin comment history for the real lockout that motivated it).
//
// Only actually exercised when the local `data/cards.db` bulk sync is
// unavailable (prod, or a dev box that hasn't run `scripts/sync-card-db.mjs`)
// — every DB-backed lookup path skips this entirely.
let lastScryfallStart = 0;
const SCRYFALL_MIN_INTERVAL_MS = 110;

export async function scryfallFetch(url: string): Promise<Response> {
  const now = Date.now();
  const scheduled = Math.max(now, lastScryfallStart + SCRYFALL_MIN_INTERVAL_MS);
  lastScryfallStart = scheduled;
  const wait = scheduled - now;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  return fetch(url, { headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' } });
}
