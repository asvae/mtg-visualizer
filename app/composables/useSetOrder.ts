// Per-set "mechanically unique" collector-number order — the client-side
// cache for server/api/cards/set-order/[set].ts (see that route's own header
// for what "mechanically unique" means: one Scryfall `unique=cards`-style
// representative printing per real card name, so a set that reuses collector
// numbers for booster-fun/showcase/extended-art/surgefoil re-treatments of
// the SAME card — e.g. FIN's Aerith Gainsborough at #4/#374/#423/#519 — only
// produces one stop).
//
// Fetched once per set code and cached for the lifetime of the tab
// (module-scope Map, not inside the composable function — same "outlives one
// component instance" shape this app's other standing caches already use,
// e.g. server/api/card/[set]/[number].ts's own cardMetaCache) so repeated
// Previous/Next navigation within one set never re-fetches it — only a
// genuinely different set visited later triggers its own new fetch.
//
// 2026-09-18, standalone-page consolidation: this composable's own consumer
// moved from the old standalone `app/pages/app/card/[set]/[number].vue`
// (deleted) into `app/pages/app/engine/cards/[set]/[[number]].vue`'s own
// `genericMode` branch — the ONE real card-detail page now — same role,
// same "no active deck/query filter" default-Previous/Next path, just a
// different file. Deliberately NOT deleted alongside that old page (unlike
// that page's own now-dead deckQty/global-filter-scoped-Previous/Next
// logic): this composable/its server route
// (server/api/cards/set-order/[set].ts) were already written generic-over-
// any-set, not FIN-specific — confirmed by reading both before assuming
// either was safe to remove — and remain the one real mechanism for
// Previous/Next on a card whose `:set` isn't one of that page's own
// tracked-corpus sets (fin/fdn) at all, e.g. any live `?sf=`-query card.
// Caches the in-flight PROMISE (not just the settled value), so two
// near-simultaneous callers for the same not-yet-cached set share one
// request instead of racing two.

export interface SetOrderData {
  collectorNumbers: string[];
  representativeByNumber: Record<string, string>;
}

const EMPTY: SetOrderData = { collectorNumbers: [], representativeByNumber: {} };

const setOrderCache = new Map<string, Promise<SetOrderData>>();

async function fetchSetOrder(set: string): Promise<SetOrderData> {
  try {
    const res = await fetch(`/api/cards/set-order/${encodeURIComponent(set)}`);
    if (!res.ok) return EMPTY;
    const body = await res.json();
    if (!Array.isArray(body.collectorNumbers)) return EMPTY;
    return { collectorNumbers: body.collectorNumbers, representativeByNumber: body.representativeByNumber ?? {} };
  } catch {
    return EMPTY; // network hiccup — caller falls back to plain ±1, see the card page
  }
}

export function useSetOrder() {
  function getSetOrder(set: string): Promise<SetOrderData> {
    let cached = setOrderCache.get(set);
    if (!cached) {
      cached = fetchSetOrder(set);
      setOrderCache.set(set, cached);
    }
    return cached;
  }
  return { getSetOrder };
}

// Leading numeric run of a collector number ("374" -> 374, "4a" -> 4) — a
// genuinely non-numeric one (no leading digits at all) sorts/anchors last,
// consistently, rather than crashing. Only used as a FALLBACK below, for a
// number this set's own data has no representative mapping for at all (an
// unrecognized/typo'd number, or the live-Scryfall-fallback path, which
// can't see bonus/variant numbers at all — see the server route's own
// header comment).
function numericPrefix(cn: string): number {
  const m = /^\d+/.exec(cn);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}
function nearestNumericNeighbors(order: string[], current: string): { prev: string | null; next: string | null } {
  const currentValue = numericPrefix(current);
  let prev: string | null = null;
  let next: string | null = null;
  for (const cn of order) {
    const v = numericPrefix(cn);
    if (v < currentValue) prev = cn;
    else if (v > currentValue && next === null) next = cn;
  }
  return { prev, next };
}

// Given this set's own SetOrderData and the CURRENT card's raw collector
// number — which may be a bonus/variant number, not itself one of
// `collectorNumbers`' own entries, e.g. FIN's Aerith Gainsborough viewed
// directly at her own showcase-borderless "374" rather than her base "4" —
// finds the nearest unique-card neighbor on each side, anchored to the
// card's own TRUE representative position (`representativeByNumber`), not
// its raw on-screen number. Viewing Aerith at #4, #374, #423, or #519 all
// produce the IDENTICAL Previous/Next pair — whichever two unique cards
// actually sit next to her at her own true #4 position — rather than
// #374/#423/#519 each producing their own out-of-place, numerically-nearby
// (but otherwise meaningless) jump.
export function neighborsInSetOrder(data: SetOrderData, current: string): { prev: string | null; next: string | null } {
  const anchor = data.representativeByNumber[current] ?? current;
  const idx = data.collectorNumbers.indexOf(anchor);
  if (idx === -1) return nearestNumericNeighbors(data.collectorNumbers, current);
  return {
    prev: idx > 0 ? data.collectorNumbers[idx - 1]! : null,
    next: idx < data.collectorNumbers.length - 1 ? data.collectorNumbers[idx + 1]! : null,
  };
}
