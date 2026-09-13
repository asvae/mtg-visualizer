// PRD 01 "Core concepts" (docs/prds/01-core-concepts.md) — the frontend-side
// card-detail cache: once a card's data is fetched once (a Scope add, a Deck
// add, a future search discover-preview — see PRD 03), it's served from here
// on any repeat access instead of re-hitting the backend. Card data is
// stable (no real freshness requirement — see the PRD's own design note), so
// this is long-lived and persisted (localStorage), with no TTL/expiry at
// all: `clearCardCache` below (manual, dev-facing) is the only invalidation
// path, per the PRD's own explicit call ("no cache-busting infrastructure
// needed").
//
// Reuses the existing `GET /api/card/:set/:number` route (already built for
// the card detail page — see server/api/card/[set]/[number].ts) rather than
// inventing a second fetch path, per PRD 01's own constraint. Only caches
// that response's own `card` field (a plain `CardData`) — not the whole
// payload (edges/themes/functionalModel/interactions are `card`/`engine`
// lane's own concerns, and irrelevant to rendering a Scope/Deck graph node).
// If the card detail page (owned by `card` lane) wants to adopt this same
// cache for its own full-response fetch, that's a separate call for that
// lane to make — not done here.
import type { CardData } from '../types';

const CACHE_STORAGE_KEY = 'mtg-visualizer-card-cache';

function loadPersistedCache(): Map<string, CardData> {
  const map = new Map<string, CardData>();
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) map.set(key, value as CardData);
    }
  } catch {
    // storage blocked/corrupt — just start with an empty cache, never throw
  }
  return map;
}

// Module-scope, not re-created per caller — every consumer (Scope add, Deck
// add, whatever else adopts this later) shares the exact same in-memory
// cache instance, not a fresh empty one per call site. Lazily initialized
// (not a top-level `new Map()`) so this module has no SSR-time
// `localStorage` access — this app's `/app` tree is SPA-only, but this file
// itself has no such guarantee about who imports it.
let cache: Map<string, CardData> | null = null;
function getCache(): Map<string, CardData> {
  if (!cache) cache = loadPersistedCache();
  return cache;
}

function persist() {
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(Object.fromEntries(getCache())));
  } catch {
    // storage full/blocked — cache still works in-memory for this tab/session
  }
}

// Same `set`/`number` identity the route itself is keyed by (Scryfall's own
// card-URL shape), lowercased so a differently-cased set code is still a
// cache hit.
function cacheKey(set: string, number: string): string {
  return `${set.toLowerCase()}/${number.toLowerCase()}`;
}

// In-flight requests, deduped by key — two near-simultaneous callers wanting
// the same not-yet-cached card (e.g. a fast double-click on an "add" button)
// share the one real network request instead of firing two.
const pending = new Map<string, Promise<CardData | null>>();

// `null` on a genuine miss (card not found, or a network/server error) —
// never throws, so a caller can treat it as "couldn't add this card" without
// its own try/catch.
export async function fetchCardBySetNumber(set: string, number: string): Promise<CardData | null> {
  const key = cacheKey(set, number);
  const cached = getCache().get(key);
  if (cached) return cached;
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const promise = (async (): Promise<CardData | null> => {
    try {
      const res = await fetch(`/api/card/${encodeURIComponent(set)}/${encodeURIComponent(number)}`);
      if (!res.ok) return null;
      const body = await res.json();
      const card = body?.card as CardData | undefined;
      if (!card) return null;
      getCache().set(key, card);
      persist();
      return card;
    } catch {
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, promise);
  return promise;
}

// Dev-facing manual clear — no automatic invalidation/TTL by design (see
// this file's own header comment). Not wired to any UI by this task (PRD 01
// is data-model/fetch/cache only, see its own PRD doc) — exported for
// whichever surface (a future settings panel, a dev console call) ends up
// wanting it.
export function clearCardCache(): void {
  getCache().clear();
  pending.clear();
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // storage blocked — in-memory cache is cleared either way
  }
}
