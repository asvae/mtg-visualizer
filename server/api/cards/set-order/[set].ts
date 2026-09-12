// Per-set ordered list of "mechanically unique" collector numbers — one
// representative printing per real card NAME, collapsed the same way
// Scryfall's own `unique=cards` search param already does elsewhere in this
// app (server/api/cards.ts, server/api/cards/by-names.ts,
// server/api/card/[set]/[number].ts's own fetchStandardPrintForName) — so a
// set that reuses collector numbers for booster-fun/showcase/extended-art/
// surgefoil re-treatments of the SAME card (FIN's own 300+/400+/500+ ranges,
// e.g. Aerith Gainsborough at #4/#374/#423/#519) produces exactly ONE stop
// for that card, not four.
//
// GET /api/cards/set-order/:set -> { collectorNumbers: string[]; representativeByNumber:
// Record<string, string> }.
//
// `collectorNumbers` is sorted numerically ascending by each representative
// printing's own collector number (a leading numeric prefix; a genuinely
// non-numeric one — e.g. a rare "4★" collector number — sorts last via
// string order, stably, rather than crashing).
//
// `representativeByNumber` maps EVERY real printing's own collector number
// in this set (including a bonus/variant one, e.g. "374") to whichever
// number in `collectorNumbers` actually represents that same card (e.g.
// "4") — a plain identity entry for a number that's already its own
// representative. This is what lets a caller currently VIEWING a
// bonus/variant printing directly (a direct URL visit, not arrived at via
// Previous/Next) treat itself as sitting at the card's own TRUE position in
// the sequence, rather than at its own out-of-place raw number — e.g.
// viewing Aerith Gainsborough's #374 showcase print should offer the SAME
// Previous/Next neighbors as viewing her at #4 does, not whatever
// numerically happens to sit near 374 (which, for a bonus/showcase range,
// can be a huge, meaningless jump).
//
// Consumed by app/composables/useSetOrder.ts, which fetches this once per
// set code and caches the result client-side (the card detail page's default
// — no active deck/query filter — Previous/Next path), so repeated
// Previous/Next clicks within the same set never re-fetch it.
//
// Generic per :set (not FIN-hardcoded): local dev path reads data/cards.db
// (see server/api/card/[set]/[number].ts's own cardsDb — same file, same
// "gitignored, dev-only, regenerated via scripts/sync-card-db.mjs"
// contract), which already covers every set the historical-sets tagging
// project has touched, not just FIN. A set that isn't in the local DB (or a
// deployed instance, where cardsDb never exists at all — Netlify Functions
// ship only what's in the repo) falls back to a live, paginated Scryfall
// search with `unique=cards`, same real param this app already relies on
// for the same collapsing purpose — that path can't see every OTHER
// printing's own number (Scryfall's `unique=cards` only ever hands back its
// own one arbitrary pick per name, not the full print run), so
// `representativeByNumber` on that path is identity-only; a bonus/variant
// number visited directly in that mode falls back to the composable's own
// numeric-"nearest" fallback instead (see that file's own comment) — an
// accepted, documented degradation for the no-local-DB case, not a bug.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const CARDS_DB_PATH = join(process.cwd(), 'data', 'cards.db');
const cardsDb = existsSync(CARDS_DB_PATH) ? new DatabaseSync(CARDS_DB_PATH, { readOnly: true }) : null;
// English only — a foreign-language reprint can share a set code with a
// distinct collector_number of its own (or, in some sets, the very same
// one), and isn't a "different card" worth its own Previous/Next stop.
const bySetStmt = cardsDb?.prepare("SELECT name, collector_number, is_normal, released_at FROM cards WHERE set_code = ? AND lang = 'en'") ?? null;

interface SetRow {
  name: string;
  collector_number: string;
  is_normal: number;
  released_at: string;
}

interface SetOrderResult {
  collectorNumbers: string[];
  representativeByNumber: Record<string, string>;
}

function numericPrefix(cn: string): number {
  const m = /^\d+/.exec(cn);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}
function sortCollectorNumbers(numbers: string[]): string[] {
  return [...numbers].sort((a, b) => numericPrefix(a) - numericPrefix(b) || a.localeCompare(b));
}

// Picks one representative printing per NAME — same "prefer the standard/
// normal-art printing" tie-break `is_normal`/`released_at` already
// establish for this exact purpose (see server/api/card/[set]/[number].ts's
// own dbExactNameStmt: `ORDER BY is_normal DESC, released_at DESC`) — a
// showcase/extended-art/surgefoil row for the same name loses to the plain
// one whenever both exist, so the resulting collector number is (almost
// always) the card's own lowest/base one. Also builds the full
// number->representative map described in this file's own header, off the
// SAME rows (every printing this set has, not just the winners).
function collapseToUniqueOrder(rows: SetRow[]): SetOrderResult {
  const best = new Map<string, { collectorNumber: string; isNormal: number; releasedAt: string }>();
  for (const r of rows) {
    const existing = best.get(r.name);
    const isNormal = r.is_normal ?? 0;
    const releasedAt = r.released_at ?? '';
    if (!existing || isNormal > existing.isNormal || (isNormal === existing.isNormal && releasedAt > existing.releasedAt)) {
      best.set(r.name, { collectorNumber: r.collector_number, isNormal, releasedAt });
    }
  }
  const collectorNumbers = sortCollectorNumbers([...best.values()].map((v) => v.collectorNumber));
  const representativeByNumber: Record<string, string> = {};
  for (const r of rows) {
    const rep = best.get(r.name);
    if (rep) representativeByNumber[r.collector_number] = rep.collectorNumber;
  }
  return { collectorNumbers, representativeByNumber };
}

// Live fallback, same polite-pagination shape server/api/cards.ts's own
// search loop already uses (100ms stagger between pages) — `unique=cards`
// does Scryfall's own one-printing-per-card collapse server-side, so no
// further de-dup pass is needed on this path, just the numeric sort.
// `representativeByNumber` is identity-only here — see this file's own
// header comment for why a fuller map isn't available on this path.
async function liveSetOrder(set: string): Promise<SetOrderResult> {
  const numbers: string[] = [];
  let nextUrl: string | null = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`set:${set}`)}&unique=cards&order=set&dir=asc`;
  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' } });
    if (res.status === 404) break; // no matches — empty set code
    if (!res.ok) break;
    const data: any = await res.json();
    for (const c of data.data ?? []) if (c.collector_number) numbers.push(c.collector_number);
    nextUrl = data.has_more ? data.next_page : null;
    if (nextUrl) await new Promise((r) => setTimeout(r, 100));
  }
  const collectorNumbers = sortCollectorNumbers(numbers);
  const representativeByNumber: Record<string, string> = {};
  for (const n of collectorNumbers) representativeByNumber[n] = n;
  return { collectorNumbers, representativeByNumber };
}

export default defineEventHandler(async (event): Promise<SetOrderResult | { error: string }> => {
  const set = getRouterParam(event, 'set');
  if (!set) {
    setResponseStatus(event, 400);
    return { error: 'missing set' };
  }

  if (bySetStmt) {
    const rows = bySetStmt.all(set) as unknown as SetRow[];
    if (rows.length) return collapseToUniqueOrder(rows);
  }

  return liveSetOrder(set);
});
