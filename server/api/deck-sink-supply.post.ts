// POST /api/deck-sink-supply — deck-scoped sink-supply endpoint backing a new
// graph-node annotation feature (ui-owned rendering, not this route's job):
// for every resolvable card in the caller's current Deck (PRD 01's own
// per-card-quantity sandbox concept), report how well-supplied each of that
// card's own SINK facts is by the REST of the deck, via
// functional-model/synergy.ts's `computeDeckSinkSupply` — see that
// function's own doc comment for the exact quantity-weighted counting rules
// (self-supply `qty - 1` withholding, one row per distinct sink label, etc.).
//
// Request:  body `{ deck: [{ set: string, number: string, qty: number }] }`
//           — the same set/number identity every card route in this app uses
//           (scryfall.com/card/<set>/<number>), one entry per physical deck
//           line. Doubles as BOTH the targets to compute a report for AND the
//           pool of potential sources — every deck card's own sinks get
//           checked against every OTHER deck card's own sources, per
//           `computeDeckSinkSupply`'s own semantics.
// Response: `{ results: [{ set, number, rows: [{ label, count }] }] }` — one
//           entry per INPUT deck line, in the same order, SKIPPING (not
//           erroring on) any line that doesn't resolve to a real, modeled
//           functional-model card (unknown set/number, or a real card with
//           no functional-model/cards/<slug> directory yet / not yet
//           v2-authored — the same "gray/untouched" bucket
//           functional-model/card-status.ts's own classifyCardStatus already
//           names). See .claude/contracts/api-contract.md.
//
// Card resolution reuses server/utils/functionalModelPool.ts's own
// loadFunctionalModelPool() (same whole-pool PoolCard[] loader
// server/api/card/[set]/[number].ts and server/api/graph-links.ts already
// use, cached per-process) rather than hand-building a second PoolCard
// construction path. set/number -> Scryfall name resolution below is a
// small, deliberate duplicate of server/api/card/[set]/[number].ts's own
// lookupCardBySetNumber — same precedent server/api/card/review-status.ts's
// own lookupOracleCard already set (that file's header comment: "a small,
// deliberate duplicate here... rather than importing an unexported helper
// out of that file", since this route only needs the read-only
// single-field case, not that route's token/interaction/relations
// machinery).

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { augmentPoolCards, computeDeckSinkSupply } from '../../functional-model/synergy';
import type { DeckEntry, PoolCard, SinkSupplyRow } from '../../functional-model/synergy';
import { loadFunctionalModelPool } from '../utils/functionalModelPool';

// data/cards.db — see server/api/cards.ts's own header comment for the full
// story; gitignored, dev-only fast path, null in prod (falls back to a live,
// paced Scryfall call below, same as every other route in this family).
const CARDS_DB_PATH = join(process.cwd(), 'data', 'cards.db');
const cardsDb = existsSync(CARDS_DB_PATH) ? new DatabaseSync(CARDS_DB_PATH, { readOnly: true }) : null;
const dbBySetNumberStmt = cardsDb?.prepare('SELECT raw_json FROM cards WHERE set_code = ? AND collector_number = ?') ?? null;

// Same pacing convention as server/api/card/[set]/[number].ts's own
// scryfallFetch (module-scoped `lastScryfallStart`, own independent budget)
// — this route's own worst case (a 40-100 card deck with no local
// data/cards.db, i.e. a deployed instance) is exactly the bulk-lookup shape
// that "stay under 10 requests/second" guideline exists for.
let lastScryfallStart = 0;
const SCRYFALL_MIN_INTERVAL_MS = 110;
async function scryfallFetch(url: string): Promise<Response> {
  const now = Date.now();
  const scheduled = Math.max(now, lastScryfallStart + SCRYFALL_MIN_INTERVAL_MS);
  lastScryfallStart = scheduled;
  const wait = scheduled - now;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  return fetch(url, { headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' } });
}

interface MinimalScryfallCard {
  name: string;
  card_faces?: { name?: string }[];
}

// A DFC's own top-level Scryfall `name` is "Front // Back" but every
// functional-model `CardDefinition.name` (and therefore `PoolCard.name`) is
// the FRONT face's own name alone (confirmed against
// jill-shiva-s-dominant-shiva-warden-of-ice / jecht-reluctant-guardian-...
// definition.ts) — same front-face convention
// server/api/card/[set]/[number].ts's own dbExactNameStmt/resolveFinCardMeta
// already work around, applied here to the reverse (set/number -> name)
// direction.
async function lookupPoolCardName(set: string, number: string): Promise<string | null> {
  let card: MinimalScryfallCard | null = null;
  if (dbBySetNumberStmt) {
    const row = dbBySetNumberStmt.get(set, number) as { raw_json: string } | undefined;
    if (row) card = JSON.parse(row.raw_json);
  }
  if (!card) {
    const res = await scryfallFetch(`https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`);
    if (!res.ok) return null;
    card = (await res.json()) as MinimalScryfallCard;
  }
  return card.card_faces?.[0]?.name ?? card.name ?? null;
}

interface DeckLineInput {
  set: string;
  number: string;
  qty: number;
}

function parseDeckBody(body: unknown): DeckLineInput[] | null {
  const deck = (body as { deck?: unknown } | null)?.deck;
  if (!Array.isArray(deck)) return null;
  const lines: DeckLineInput[] = [];
  for (const raw of deck) {
    const set = (raw as { set?: unknown } | null)?.set;
    const number = (raw as { number?: unknown } | null)?.number;
    const qtyRaw = (raw as { qty?: unknown } | null)?.qty;
    if (typeof set !== 'string' || !set || typeof number !== 'string' || !number) return null;
    const qty = typeof qtyRaw === 'number' && Number.isFinite(qtyRaw) ? Math.max(0, Math.floor(qtyRaw)) : 0;
    lines.push({ set, number, qty });
  }
  return lines;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const lines = parseDeckBody(body);
  if (!lines) {
    setResponseStatus(event, 400);
    return { error: 'expected body { deck: [{ set: string, number: string, qty: number }] }' };
  }

  const pool = await loadFunctionalModelPool();
  const poolByName = new Map(pool.map((c) => [c.name, c] as const));

  // Resolve every input line to a real, modeled PoolCard up front — a line
  // that doesn't resolve (bad set/number, or a real card with no
  // functional-model coverage yet) is carried through as `null` so the
  // final response can skip it without losing every OTHER line's own
  // position/order.
  const resolved = await Promise.all(
    lines.map(async (line): Promise<{ line: DeckLineInput; card: PoolCard } | null> => {
      const name = await lookupPoolCardName(line.set, line.number).catch(() => null);
      if (!name) return null;
      const card = poolByName.get(name);
      if (!card) return null;
      return { line, card };
    }),
  );

  // Deck-wide quantity, aggregated by resolved card NAME (not by input
  // line) — two deck lines for the same card under different printings
  // (different set/number, same functional-model PoolCard by name) must
  // combine into one real quantity for computeDeckSinkSupply's own
  // self-supply `qty - 1` withholding to mean "how many other real copies
  // of this card are in the deck," not silently double-discount across
  // split printings.
  const qtyByName = new Map<string, number>();
  const cardByName = new Map<string, PoolCard>();
  for (const entry of resolved) {
    if (!entry) continue;
    qtyByName.set(entry.card.name, (qtyByName.get(entry.card.name) ?? 0) + entry.line.qty);
    cardByName.set(entry.card.name, entry.card);
  }

  // augmentPoolCards must see the WHOLE resolved deck at once (per
  // computeDeckSinkSupply's own doc comment) — the synthetic self-cast/
  // self-enters/self-graveyard facts it injects are load-bearing for correct
  // matching, and every deck card must see the SAME augmented producer facts
  // computeDeckSinkSupply itself would otherwise re-derive per entry.
  const augmentedCards = augmentPoolCards([...cardByName.values()]);
  const augmentedByName = new Map(augmentedCards.map((c) => [c.name, c] as const));
  const deckEntries: DeckEntry[] = augmentedCards.map((card) => ({ card, qty: qtyByName.get(card.name) ?? 0 }));

  const results = resolved.flatMap((entry) => {
    if (!entry) return [];
    const target = augmentedByName.get(entry.card.name)!;
    const rows: SinkSupplyRow[] = computeDeckSinkSupply(target, deckEntries);
    return [{ set: entry.line.set, number: entry.line.number, rows }];
  });

  return { results };
});
