// Single-card detail endpoint — everything the card detail page needs
// (Scryfall data and tagging relations) in one request, independent of the
// big client-side graph store (app/composables/useGraphStore.ts). That store
// assembles a whole set/query's worth of cards at once via buildGraph.ts;
// this route reuses buildGraph.ts's per-card mapping helpers so a single
// card renders identically without needing the rest of the corpus loaded.
//
// GET or POST /api/card/:set/:number — same identity Scryfall's own card URLs
// use (scryfall.com/card/<set>/<number>), so prev/next is a plain ±1 on
// :number. A POST body may carry `{ filterNames?: string[] }` — the active
// global filter's resolved card names (deck import OR Scryfall query, see
// useGraphStore.ts's `getActiveFilterMode()`) — which scopes the
// Interactions panel down to matches against just those cards instead of the
// whole functional-model corpus. GET (no body) still works identically to
// before, unscoped, same as a plain page reload with no filter active.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cardArtCrop, cardImages, cardKeywords, cardTokens, creatureSubtypes, slugify, BADGE_KEYWORDS } from '../../../../app/lib/buildGraph';
import type { ScryfallCard, RelationsEntry, TokensById } from '../../../../app/lib/buildGraph';
import type { CardData, EdgeData, Role, ThemeData } from '../../../../app/types';
import { findInteractionsForCard, annotateCardText } from '../../../../functional-model/synergy';
import type { InteractionGroup, Fact, AnnotatedText } from '../../../../functional-model/synergy';
import { loadCardSynergy, loadFunctionalModelPool } from '../../../utils/functionalModelPool';
import relationsData from '../../../../data/global_relations.json';
import finRelationsData from '../../../../data/fin/fin_relations.json';
import themesData from '../../../../data/global_themes.json';

// fin_relations.json wins over global_relations.json by name — see
// server/api/cards.ts for why (FIN not yet chronologically merged).
const relationsByName = new Map<string, RelationsEntry>([
  ...(relationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
  ...(finRelationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
]);

// Read fresh off disk on every request in dev (not a statically bundled
// import), so a hand-edited data file reflects immediately without a full
// dev-server restart. Falls back to `bundled` for a production build
// (different cwd, raw source tree not shipped).
function loadJsonFresh<T>(relativePath: string, bundled: T): T {
  if (process.env.NODE_ENV === 'production') return bundled;
  try {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8'));
  } catch {
    return bundled;
  }
}
// functional-model/cards/<slug>/ — a hand-authored, declarative
// CardDefinition (see functional-model/card.ts) run through
// functional-model/harness.ts's real, mutable game state
// (functional-model/state.ts) across its own scenarios.ts. No bundled
// fallback, dev-time comparison artifact — a miss here is the common case
// (only a hand-built subset of cards exist
// in this design so far, see functional-model/cards/), and regenerating
// trace.json after editing a card needs
// `npx vite-node functional-model/scripts/run-scenarios.mjs`.
//
// Supersedes the older functional-model/data/<slug>.ts generator (one
// exported function per Forge ability line, produced by
// app/lib/functionalTranslate.ts) — that design is retired; this route no
// longer reads from it.
interface FunctionalModelTraceResult {
  scenario: { setup: string; action: string; result: string };
  log: Record<string, unknown>[];
}
// loadCardSynergy (v2 SYNERGY_DESIGN.md attribute-bag facts) and
// loadFunctionalModelPool are shared with server/api/graph-links.ts — see
// server/utils/functionalModelPool.ts.
interface FunctionalModelData {
  source: string;
  synergy: { source: Fact[]; sink: Fact[] } | null;
  // Raw per-scenario output (functional-model/harness.ts's own
  // TraceResult[]) — kept as each scenario's own ordered log, for seeing
  // exactly what one specific scenario actually did.
  traces: FunctionalModelTraceResult[];
  // The card's own full text — title, mana cost, type line, then oracle text,
  // same order a real printed card reads — pre-split into plain/fact-linked
  // runs (functional-model/synergy.ts's annotateCardText) — computed here, in
  // the card data extraction flow, rather than client-side, so the card page
  // just renders segments and never re-parses card text itself. `null` when
  // there's no card text to annotate (a synergy-less card, or a DFC whose
  // oracle text this route doesn't carry — see `cardText` below).
  annotatedText: AnnotatedText | null;
  // cards/<slug>/progress.json's own `review` field — 'ai' (the common case,
  // never human-checked against the real card) vs 'human' (someone actually
  // played/verified it — see this session's own review process). `null` when
  // progress.json is missing/malformed rather than assumed either way — the
  // card page treats null the same as 'ai' (show the draft badge) since an
  // untracked card is certainly not confirmed human-reviewed.
  review: 'ai' | 'human' | null;
}
function loadFunctionalModel(name: string, cardText: string): FunctionalModelData | null {
  const slug = slugify(name);
  try {
    const source = readFileSync(join(process.cwd(), `functional-model/cards/${slug}/definition.ts`), 'utf8');
    const traces = JSON.parse(readFileSync(join(process.cwd(), `functional-model/cards/${slug}/trace.json`), 'utf8'));
    const synergy = loadCardSynergy(slug);
    const annotatedText = synergy && cardText ? annotateCardText(cardText, [...synergy.source, ...synergy.sink]) : null;
    let review: 'ai' | 'human' | null = null;
    try {
      const progress = JSON.parse(readFileSync(join(process.cwd(), `functional-model/cards/${slug}/progress.json`), 'utf8'));
      review = progress.review === 'human' ? 'human' : 'ai';
    } catch {
      // progress.json is optional — a card can exist without one
    }
    return { source, synergy, traces, annotatedText, review };
  } catch {
    return null;
  }
}

// data/fin/fin_scryfall.json — real, current Scryfall data for every FIN
// card (also the exact file the main graph visualizer's default browsing
// mode fetches client-side, public/fin -> data/fin symlink — this is NOT a
// stale snapshot, just the free/local fast path for the FIN cards that make
// up most of the functional-model corpus). Resolves a functional-model
// card's own real set/collectorNumber/image for a match thumbnail. A DFC
// (Jecht, Reluctant Guardian // Braska's Final Aeon) has no
// top-level `name` match against its own FRONT face's name (Scryfall's own
// top-level `name` is the full "A // B" string) — falls back to checking
// each `card_faces[].name` for exactly this reason.
interface FinScryfallCard {
  name: string;
  set: string;
  collector_number: string;
  image_uris?: { normal?: string };
  card_faces?: { name: string; image_uris?: { normal?: string } }[];
}
function resolveFinCardMeta(name: string): { set: string; collectorNumber: string; image: string | null } | null {
  const entries = loadJsonFresh('data/fin/fin_scryfall.json', [] as FinScryfallCard[]);
  for (const c of entries) {
    if (c.name === name) return { set: c.set, collectorNumber: c.collector_number, image: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null };
    const face = c.card_faces?.find((f) => f.name === name);
    if (face) return { set: c.set, collectorNumber: c.collector_number, image: face.image_uris?.normal ?? null };
  }
  return null;
}

// Live fallback for a functional-model card neither legacy pool below covers
// — the historical-sets tagging project has grown functional-model's own
// corpus (317 cards and counting) well past the ~12 cards BLB/FIN's static
// files were snapshotted for, across many real sets neither file ever
// claimed to cover. Goes through the same paced scryfallFetch every other
// live Scryfall call in this route uses, so a match list with several
// misses degrades to a few extra seconds rather than bursting past the rate
// limit. `exact` (not fuzzy) — a functional-model card's own `name` is
// already Scryfall's real name, no typo-tolerance needed.
async function resolveLiveCardMeta(name: string): Promise<{ set: string; collectorNumber: string; image: string | null } | null> {
  try {
    const res = await scryfallFetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const c: FinScryfallCard = await res.json();
    return { set: c.set, collectorNumber: c.collector_number, image: c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null };
  } catch {
    return null;
  }
}

// Real set/collectorNumber/image for a functional-model card's own name —
// tries FIN's real Scryfall data first (free, local, current), then a live
// Scryfall lookup (see resolveLiveCardMeta above) for whatever card isn't
// in the FIN set at all (the historical-sets tagging project's own cards).
async function resolveFunctionalModelCardMeta(name: string): Promise<{ set: string; collectorNumber: string; image: string | null } | null> {
  const fin = resolveFinCardMeta(name);
  if (fin) return fin;
  return resolveLiveCardMeta(name);
}

// InteractionGroup/InteractionMatch (functional-model/synergy.ts v2) carry
// no thumbnail metadata — matches are identified by card name only (`card`,
// renamed from the v1 shape's `name`). Enrich a copy here rather than
// mutating the matcher's own output, since InteractionMatch has no
// set/collectorNumber/image fields to mutate onto.
export interface EnrichedInteractionMatch {
  card: string;
  selfInteraction?: InteractionGroup['matches'][number]['selfInteraction'];
  set?: string;
  collectorNumber?: string;
  image: string | null;
}
export interface EnrichedInteractionGroup extends Omit<InteractionGroup, 'matches'> {
  matches: EnrichedInteractionMatch[];
}
// `filterNames`, when given (the active global filter — deck import OR
// Scryfall query, see useGraphStore.ts's `getActiveFilterMode()`), scopes
// matches down to just those cards instead of the whole functional-model
// corpus — the deckbuilding question is "what does this card actually
// synergize with IN MY DECK/POOL," not against every card this app happens
// to have modeled. `cardName` itself is always resolved against the FULL
// pool first (its own source/sink facts don't depend on whether it's in the
// filter — you're often checking a candidate card you don't own yet against
// a deck you do), and a self-interaction match (the same card against
// itself) always passes through regardless — a name list alone doesn't
// track quantities, so there's no way to know if a second copy is actually
// in the 60/100, and dropping self-interactions outright would just be
// wrong for cards that ARE genuinely in the deck.
async function loadInteractionGroups(cardName: string, filterNames?: Set<string>): Promise<EnrichedInteractionGroup[]> {
  const pool = await loadFunctionalModelPool();
  if (!pool.some((c) => c.name === cardName)) return [];
  const groups = findInteractionsForCard(cardName, pool);
  const enriched = await Promise.all(
    groups.map(async (group) => {
      const filtered = group.matches.filter((m) => !filterNames || m.selfInteraction || filterNames.has(m.card));
      const matches = await Promise.all(
        filtered.map(async (m): Promise<EnrichedInteractionMatch> => {
          const ref = await resolveFunctionalModelCardMeta(m.card);
          return { card: m.card, selfInteraction: m.selfInteraction, set: ref?.set, collectorNumber: ref?.collectorNumber, image: ref?.image ?? null };
        }),
      );
      return { ...group, matches };
    }),
  );
  return enriched.filter((group) => group.matches.length > 0);
}

const curatedThemes = themesData as ThemeData[];
const curatedThemeIds = new Set(curatedThemes.map((t) => t.id));

// Scryfall's own guideline: stay under 10 requests/second or risk a network
// block (confirmed the hard way mid-session — a burst of interaction-match
// image lookups across a 274-card pool, on top of this session's own
// verification traffic, tripped a real 429 with a 60s lockout). A
// concurrency cap alone doesn't bound rate if each request is fast; this
// paces request STARTS at least 110ms apart (~9/s) regardless of how many
// are queued, so a single card page with dozens of uncached matches degrades
// to a few extra seconds instead of a block. Every Scryfall call in this
// route goes through it — the main card, its tokens, and pool match art
// alike, not just the pool-image loop specifically.
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

async function fetchBySetNumber(set: string, number: string) {
  return scryfallFetch(`https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`);
}

export default defineEventHandler(async (event) => {
  const set = getRouterParam(event, 'set');
  const number = getRouterParam(event, 'number');
  if (!set || !number) {
    setResponseStatus(event, 400);
    return { error: 'missing set or number' };
  }

  // Optional POST body — see this file's own header comment. A GET request
  // (no filter active) has no body to read; readBody rejects on that,
  // caught the same defensive way loadJsonFresh's own reads are above.
  const body = await readBody(event).catch(() => null);
  const rawFilterNames = body?.filterNames;
  const filterNames = Array.isArray(rawFilterNames) && rawFilterNames.length > 0 ? new Set<string>(rawFilterNames) : undefined;

  const res = await fetchBySetNumber(set, number);
  if (res.status === 404) {
    setResponseStatus(event, 404);
    return { error: 'card not found' };
  }
  const card: ScryfallCard & { all_parts?: { id: string; component: string }[]; set?: string; collector_number?: string } =
    await res.json();
  if (!res.ok) {
    setResponseStatus(event, 502);
    return { error: 'Scryfall request failed' };
  }

  // Prev/next is computed client-side (±1 on the URL's :number) — see the
  // card page — so this route doesn't hold up the response validating
  // neighbors that exist Scryfall-side against the corpus.

  // Token art: fetched live per-card (there's no prebuilt tokens file at this
  // scope) — a card has at most a couple of `all_parts` token entries, so a
  // few extra Scryfall round-trips is cheap.
  const tokenIds = [...new Set((card.all_parts || []).filter((p) => p.component === 'token').map((p) => p.id))];
  const tokensById: TokensById = {};
  await Promise.all(
    tokenIds.map(async (tid) => {
      const tRes = await scryfallFetch(`https://api.scryfall.com/cards/${tid}`);
      if (!tRes.ok) return;
      const t = await tRes.json();
      tokensById[tid] = { name: t.name, image: t.image_uris?.normal ?? null };
    })
  );

  const cardData: CardData = {
    id: card.id,
    name: card.name,
    cmc: card.cmc ?? 0,
    colors: card.colors || (card.card_faces ? card.card_faces.flatMap((f) => f.colors || []) : []),
    colorIdentity: card.color_identity || [],
    typeLine: card.type_line || '',
    rarity: card.rarity || 'common',
    images: cardImages(card),
    artCrop: cardArtCrop(card),
    tokens: cardTokens(card, tokensById),
    scryfallUri: card.scryfall_uri,
    keywords: cardKeywords(card).filter((k) => BADGE_KEYWORDS.has(k)),
    set: card.set || set,
    collectorNumber: card.collector_number || number,
  };

  // Auto-generated creature-type themes (Human, Goblin, ...) — same rule as
  // buildGraph.ts, just scoped to this one card instead of a whole corpus.
  const typeThemeLabel = new Map<string, string>();
  for (const word of creatureSubtypes(card)) {
    const slug = slugify(word);
    if (!slug || curatedThemeIds.has(slug)) continue;
    if (!typeThemeLabel.has(slug)) typeThemeLabel.set(slug, word);
  }
  const themeIds = new Set([...curatedThemeIds, ...typeThemeLabel.keys()]);

  const entry = relationsByName.get(card.name);
  const edges: EdgeData[] = [];
  if (!entry) {
    edges.push({ card: card.id, theme: 'not-processed', role: 'atypical', weight: 1 });
  } else {
    for (const [role, byTheme] of Object.entries(entry.themes ?? {})) {
      for (const [theme, weight] of Object.entries(byTheme ?? {})) {
        if (theme !== 'not-processed' && !themeIds.has(theme)) continue;
        edges.push({ card: card.id, theme, role: role as Role, weight });
      }
    }
  }

  const usedThemeIds = new Set(edges.map((e) => e.theme));
  const themes: ThemeData[] = [
    ...curatedThemes.filter((t) => usedThemeIds.has(t.id)),
    ...[...typeThemeLabel.entries()].filter(([id]) => usedThemeIds.has(id)).map(([id, label]) => ({ id, label })),
    ...(usedThemeIds.has('not-processed') ? [{ id: 'not-processed', label: 'Not Processed' }] : []),
  ];

  // Scryfall's own oracle text/mana cost — a DFC has neither at the top
  // level, only per face (card_faces[].oracle_text/mana_cost), joined the
  // same "front // back" order the rest of this route already treats a DFC's
  // combined name as (see deckQty's own comment on the card detail page).
  const oracleText = card.oracle_text || (card.card_faces ? card.card_faces.map((f) => f.oracle_text || '').join('\n') : '');
  const manaCost = card.mana_cost || (card.card_faces ? card.card_faces.map((f) => f.mana_cost || '').join(' // ') : '');
  // Full card text, same order a real printed card reads — title, mana cost,
  // type line, then rules text — so annotateCardText's inline-linked view
  // (app/components/FunctionalModelText.vue) reads like the whole card, not
  // just its bottom rules-text box.
  const cardText = `${card.name}\t${manaCost}\n\n${card.type_line || ''}\n\n${oracleText}`;

  return {
    card: cardData,
    edges,
    themes,
    functionalModel: loadFunctionalModel(card.name, cardText),
    interactions: await loadInteractionGroups(card.name, filterNames),
  };
});
