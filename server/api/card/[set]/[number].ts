// Single-card detail endpoint — everything the card detail page needs
// (Scryfall data and tagging relations) in one request, independent of the
// big client-side graph store (app/composables/useGraphStore.ts). That store
// assembles a whole set/query's worth of cards at once via buildGraph.ts;
// this route reuses buildGraph.ts's per-card mapping helpers so a single
// card renders identically without needing the rest of the corpus loaded.
//
// GET /api/card/:set/:number  — same identity Scryfall's own card URLs use
// (scryfall.com/card/<set>/<number>), so prev/next is a plain ±1 on :number.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cardArtCrop, cardImages, cardKeywords, cardTokens, creatureSubtypes, slugify, BADGE_KEYWORDS } from '../../../../app/lib/buildGraph';
import type { ScryfallCard, RelationsEntry, TokensById } from '../../../../app/lib/buildGraph';
import type { CardData, EdgeData, Role, SynergyFlow, SynergyNode, SynergyExamResult, ThemeData } from '../../../../app/types';
import { parseForgeScript } from '../../../../app/lib/forgeScript';
import { translateForgeCard } from '../../../../app/lib/forgeTranslate';
import { findInteractionsForCard } from '../../../../functional-model/synergy';
import type { InteractionGroup, Fact } from '../../../../functional-model/synergy';
import { loadCardSynergy, loadFunctionalModelPool } from '../../../utils/functionalModelPool';
import relationsData from '../../../../data/global_relations.json';
import finRelationsData from '../../../../data/fin/fin_relations.json';
import themesData from '../../../../data/global_themes.json';
import bundledSynergyEdges from '../../../../synergy-model/data/edges.json';
import bundledSynergyStatus from '../../../../synergy-model/data/edges_status.json';

// fin_relations.json wins over global_relations.json by name — see
// server/api/cards.ts for why (FIN not yet chronologically merged).
const relationsByName = new Map<string, RelationsEntry>([
  ...(relationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
  ...(finRelationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
]);

// Read fresh off disk on every request in dev (not the statically bundled
// import) — synergy-model/data/edges.json is being hand-edited card by card
// right now, and a static import only reflects a full dev-server restart.
// Same trick as the old shorthand endpoint used. Falls back to the bundled
// copy for a production build (different cwd, raw source tree not shipped) —
// synergy-model isn't wired into any prod path yet, this is just so the
// import doesn't break one if it ever is.
function loadJsonFresh<T>(relativePath: string, bundled: T): T {
  if (process.env.NODE_ENV === 'production') return bundled;
  try {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8'));
  } catch {
    return bundled;
  }
}
interface SynergyEntry {
  name: string;
  nodes: Record<string, SynergyNode>;
  flow: SynergyFlow;
}
interface SynergyStatus {
  decomposition: 'ai' | 'human';
  review: 'ai' | 'human';
}
function loadSynergyEntries(): Record<string, { nodes: Record<string, SynergyNode>; flow: SynergyFlow }> {
  const entries = loadJsonFresh('synergy-model/data/edges.json', bundledSynergyEdges as unknown as SynergyEntry[]);
  return Object.fromEntries(entries.map((e) => [e.name, { nodes: e.nodes, flow: e.flow }]));
}
function loadSynergyStatus(): Record<string, SynergyStatus> {
  return loadJsonFresh('synergy-model/data/edges_status.json', bundledSynergyStatus as Record<string, SynergyStatus>);
}

// synergy-model/EXAM_PROCESS.md's round-trip results: one sparse JSON file
// per decomposed-and-tested card, filename = slugify(name), no bundled
// fallback (exam results are a dev-time artifact of synergy-model, never
// shipped to a production build).
function loadSynergyExamResult(name: string): SynergyExamResult | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), `synergy-model/exams/${slugify(name)}.result.json`), 'utf8'));
  } catch {
    return null;
  }
}

// forge-model/data/<slug>.txt — a real Card-Forge cardsfolder script, copied
// verbatim (see forge-model/README.md) for whichever cards synergy-model
// also covers. Read raw, unparsed (app/lib/forgeScript.ts parses it
// client-side, same split as synergyNodes/synergyFlow vs the page's own
// walkFlowStep). No bundled fallback — like the exam results above, this is
// a dev-time comparison artifact, not shipped to a production build.
function loadForgeScript(name: string): string | null {
  try {
    return readFileSync(join(process.cwd(), `forge-model/data/${slugify(name)}.txt`), 'utf8');
  } catch {
    return null;
  }
}

// functional-model/cards/<slug>/ — a hand-authored, declarative
// CardDefinition (see functional-model/card.ts) run through
// functional-model/harness.ts's real, mutable game state
// (functional-model/state.ts) across its own scenarios.ts. Same "no bundled
// fallback, dev-time comparison artifact" treatment as loadForgeScript above
// — a miss here is the common case (only a hand-built subset of cards exist
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
  synergy: { produces: Fact[]; wants: Fact[] } | null;
  // Raw per-scenario output (functional-model/harness.ts's own
  // TraceResult[]) — kept as each scenario's own ordered log, for seeing
  // exactly what one specific scenario actually did.
  traces: FunctionalModelTraceResult[];
}
function loadFunctionalModel(name: string): FunctionalModelData | null {
  const slug = slugify(name);
  try {
    const source = readFileSync(join(process.cwd(), `functional-model/cards/${slug}/definition.ts`), 'utf8');
    const traces = JSON.parse(readFileSync(join(process.cwd(), `functional-model/cards/${slug}/trace.json`), 'utf8'));
    return { source, synergy: loadCardSynergy(slug), traces };
  } catch {
    return null;
  }
}

// Parsing + translating a Forge script is pure (same input text -> same
// output) but not free — an interactions pool this size (274 cards for BLB)
// re-running it for every pool member on every single request would add up
// fast, so cache by name for the life of the server process. Same tradeoff
// as poolImageCache below: a dev-server restart is what picks up an edited
// forge-model/data/*.txt file, same as it already does for the pool JSON.
const translateCache = new Map<string, { nodes: Record<string, SynergyNode>; flow: SynergyFlow }>();
function translateForgeScriptCached(name: string, raw: string) {
  const cached = translateCache.get(name);
  if (cached !== undefined) return cached;
  const translated = translateForgeCard(parseForgeScript(raw));
  const result = { nodes: translated.nodes, flow: translated.flow };
  translateCache.set(name, result);
  return result;
}

// No hand-authored edges.json entry -> translate the Forge script on the fly
// (app/lib/forgeTranslate.ts) instead of showing nothing. Same "not yet
// human-reviewed" treatment the card page already gives an AI decomposition
// — see forge-model/README.md's "Cards outside FIN" note.
function resolveSynergy(name: string): { nodes: Record<string, SynergyNode>; flow: SynergyFlow; review: 'ai' | 'human' | null } | null {
  const hand = loadSynergyEntries()[name];
  if (hand) return { nodes: hand.nodes, flow: hand.flow, review: loadSynergyStatus()[name]?.review ?? null };
  const forge = loadForgeScript(name);
  if (!forge) return null;
  const translated = translateForgeScriptCached(name, forge);
  return { nodes: translated.nodes, flow: translated.flow, review: 'ai' };
}

// forge-model/pools/*.json — kept ONLY for BLB card metadata resolution now
// (name -> real set/collectorNumber/image), not for computing interactions
// anymore (functional-model/synergy.ts does that, see loadInteractionGroups
// below). Warren Elder is the one functional-model card that's BLB, not
// FIN — this is how its own real print gets resolved for a match thumbnail.
interface PoolEntry {
  name: string;
  typeLine: string;
  set: string;
  collectorNumber: string;
  image?: string | null;
}
const POOL_FILES = ['fdn-cats.json', 'blb.json'];
function loadPool(file: string): PoolEntry[] {
  return loadJsonFresh(`forge-model/pools/${file}`, [] as PoolEntry[]);
}
function allPoolEntriesByName(): Map<string, PoolEntry> {
  const map = new Map<string, PoolEntry>();
  for (const file of POOL_FILES) for (const e of loadPool(file)) map.set(e.name, e);
  return map;
}

// data/fin/fin_scryfall.json — real Scryfall data for every FIN card, used
// the same way allPoolEntriesByName() is used for BLB above: resolving a
// functional-model card's own real set/collectorNumber/image for a match
// thumbnail. A DFC (Jecht, Reluctant Guardian // Braska's Final Aeon) has no
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

// Real set/collectorNumber/image for a functional-model card's own name —
// tries the BLB pool first, then FIN's real Scryfall data. A card genuinely
// missing from both (none currently, all 12 existing functional-model cards
// are covered) would need a live Scryfall lookup added here — deliberately
// NOT built speculatively ahead of a real card actually needing it, same
// "don't build ahead of need" discipline the rest of functional-model/ uses.
function resolveFunctionalModelCardMeta(name: string): { set: string; collectorNumber: string; image: string | null } | null {
  const blb = allPoolEntriesByName().get(name);
  if (blb) return { set: blb.set, collectorNumber: blb.collectorNumber, image: blb.image ?? null };
  return resolveFinCardMeta(name);
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
async function loadInteractionGroups(cardName: string): Promise<EnrichedInteractionGroup[]> {
  const pool = await loadFunctionalModelPool();
  if (!pool.some((c) => c.name === cardName)) return [];
  const groups = findInteractionsForCard(cardName, pool);
  return groups.map((group) => ({
    ...group,
    matches: group.matches.map((m): EnrichedInteractionMatch => {
      const ref = resolveFunctionalModelCardMeta(m.card);
      return { card: m.card, selfInteraction: m.selfInteraction, set: ref?.set, collectorNumber: ref?.collectorNumber, image: ref?.image ?? null };
    }),
  }));
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

  const synergyEntry = resolveSynergy(card.name);
  return {
    card: cardData,
    edges,
    themes,
    synergyNodes: synergyEntry?.nodes ?? null,
    synergyFlow: synergyEntry?.flow ?? null,
    synergyReview: synergyEntry?.review ?? null,
    synergyExam: loadSynergyExamResult(card.name),
    forgeScript: loadForgeScript(card.name),
    functionalModel: loadFunctionalModel(card.name),
    interactions: await loadInteractionGroups(card.name),
  };
});
