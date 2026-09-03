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
import { cardImages, cardKeywords, cardTokens, creatureSubtypes, slugify, BADGE_KEYWORDS } from '../../../../app/lib/buildGraph';
import type { ScryfallCard, RelationsEntry, TokensById } from '../../../../app/lib/buildGraph';
import type { CardData, EdgeData, Role, SynergyFlow, SynergyNode, SynergyExamResult, ThemeData } from '../../../../app/types';
import { parseForgeScript } from '../../../../app/lib/forgeScript';
import { translateForgeCard } from '../../../../app/lib/forgeTranslate';
import { groupInteractionsForCard } from '../../../../app/lib/synergyInteractions';
import type { InteractionGroup, ThingResolver } from '../../../../app/lib/synergyInteractions';
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

// Worked-example pools for app/lib/synergyInteractions.ts — a real
// cross-card join needs every OTHER card's synergy data available at once,
// which nothing in this app assembles yet (buildGraph.ts builds a whole
// set's worth of theme edges, not synergy-model nodes). Rather than fake a
// corpus-wide join, each file under forge-model/pools/ lists one curated (or,
// for blb.json, the entire real) set of cards this session prepared Forge
// scripts for. A card belongs to at most one pool file; querying by name
// finds which file (if any) and runs the join against that file's members.
// See forge-model/README.md.
interface PoolEntry {
  name: string;
  typeLine: string;
  set: string;
  collectorNumber: string;
  // Precomputed (see forge-model/README.md's "Cards outside FIN" note) —
  // never fetched live at request time, see poolCardImage below for why.
  image?: string | null;
}
const POOL_FILES = ['fdn-cats.json', 'blb.json'];
function loadPool(file: string): PoolEntry[] {
  return loadJsonFresh(`forge-model/pools/${file}`, [] as PoolEntry[]);
}
function findPoolFor(name: string): PoolEntry[] | null {
  for (const file of POOL_FILES) {
    const entries = loadPool(file);
    if (entries.some((e) => e.name === name)) return entries;
  }
  return null;
}
// Every pool's entries, name -> ref, for the match-thumbnail lookups below —
// a match can be from a different pool than the one being viewed only in
// the sense that its own set/collectorNumber still needs resolving the same
// way regardless of which pool it came from, so this merges all of them.
function allPoolEntriesByName(): Map<string, PoolEntry> {
  const map = new Map<string, PoolEntry>();
  for (const file of POOL_FILES) for (const e of loadPool(file)) map.set(e.name, e);
  return map;
}

// TokenScript$ ids any pool's Forge scripts create, resolved for
// app/lib/synergyInteractions.ts's self-interaction pass (SCHEMA §7
// "self-sufficiency") — e.g. Arahbo's own trigger makes a Cat token that its
// own anthem then buffs. Shared across all pools (Forge's TokenScript ids
// are its own global namespace, not scoped to one set) — a demo-scoped
// registry, same reasoning as the pool files themselves (see
// forge-model/README.md's "Cards outside FIN" note) — NOT
// synergy-model/data/registries.json, which is FIN-scoped reviewed data.
// set/collectorNumber are real token-sheet prints (Scryfall's dedicated
// token sets, e.g. `tfdn` for `fdn`) matching what each script actually
// creates — a token match gets the same clickable real art every other
// match gets, not a synthesized placeholder.
// `image` is precomputed (forge-model/pools/*.json get theirs the same way,
// see forge-model/README.md) — a live per-request Scryfall lookup here was
// the actual cause of the rate-limit block below: a densely-matching card's
// interaction groups can reference a hundred-plus distinct pool cards, and
// even paced under Scryfall's 10/s limit that's tens of seconds of latency
// on a cold cache, every time, for data that's static. Precomputing once
// removes both the latency and the rate-limit exposure entirely.
const POOL_TOKEN_REGISTRY: Record<string, { labels: string[]; token: boolean; name: string; set: string; collectorNumber: string; image: string | null }> = {
  w_1_1_cat: { labels: ['creature', 'cat', 'white', 'token'], token: true, name: '1/1 white Cat token', set: 'tfdn', collectorNumber: '1', image: 'https://cards.scryfall.io/normal/front/2/8/2885d54c-9fb2-4f01-8937-54f8ac1ce5bc.jpg?1783908593' },
  w_1_1_cat_lifelink: {
    labels: ['creature', 'cat', 'white', 'token'],
    token: true,
    name: '1/1 white Cat token (lifelink)',
    set: 'tfdn',
    collectorNumber: '27',
    image: 'https://cards.scryfall.io/normal/front/8/6/86701490-17ac-4253-810d-6cfd7a46594c.jpg?1783908586',
  },
  // BLB's own token sheet (Scryfall `tblb`) — every TokenScript$ id BLB's
  // 274 real cards actually create (found via a translator run over the
  // whole set's unmapped output, then matched against `set:tblb`).
  w_1_1_rabbit: { labels: ['creature', 'rabbit', 'white', 'token'], token: true, name: 'Rabbit token', set: 'tblb', collectorNumber: '3', image: 'https://cards.scryfall.io/normal/front/8/1/81de52ef-7515-4958-abea-fb8ebdcef93c.jpg?1783909772' },
  c_a_food_sac: { labels: ['artifact', 'food', 'token'], token: true, name: 'Food token', set: 'tblb', collectorNumber: '27', image: 'https://cards.scryfall.io/normal/front/0/d/0dce2241-e58b-41d4-b57c-9794fc8ee004.jpg?1783909763' },
  u_1_1_fish: { labels: ['creature', 'fish', 'blue', 'token'], token: true, name: 'Fish token', set: 'tblb', collectorNumber: '7', image: 'https://cards.scryfall.io/normal/front/d/e/de0d6700-49f0-4233-97ba-cef7821c30ed.jpg?1783909771' },
  ur_1_1_otter_prowess: { labels: ['creature', 'otter', 'blue', 'red', 'token'], token: true, name: 'Otter token', set: 'tblb', collectorNumber: '25', image: 'https://cards.scryfall.io/normal/front/e/6/e6b2c465-c446-4dee-9101-763105dcf813.jpg?1783909764' },
  w_0_4_wall_defender: { labels: ['creature', 'wall', 'white', 'token'], token: true, name: 'Wall token', set: 'tblb', collectorNumber: '4', image: 'https://cards.scryfall.io/normal/front/2/2/229a41de-91dd-4696-bfc1-10d702787c3e.jpg?1783909772' },
  sword: { labels: ['artifact', 'equipment', 'token'], token: true, name: 'Sword token', set: 'tblb', collectorNumber: '28', image: 'https://cards.scryfall.io/normal/front/b/b/bb1e78e6-a9e7-48a4-9231-61fb331c5837.jpg?1783909763' },
  g_1_1_squirrel: { labels: ['creature', 'squirrel', 'green', 'token'], token: true, name: 'Squirrel token', set: 'tblb', collectorNumber: '23', image: 'https://cards.scryfall.io/normal/front/5/a/5a6ec62e-0e9b-4312-bfe8-cc85d76fd9e0.jpg?1783909765' },
  b_1_1_bat_flying: { labels: ['creature', 'bat', 'black', 'token'], token: true, name: 'Bat token', set: 'tblb', collectorNumber: '10', image: 'https://cards.scryfall.io/normal/front/1/0/100c0127-49dd-4a78-9c88-1881e7923674.jpg?1783909768' },
  cragflame: { labels: ['artifact', 'equipment', 'legendary', 'token'], token: true, name: 'Cragflame token', set: 'tblb', collectorNumber: '26', image: 'https://cards.scryfall.io/normal/front/c/7/c76fa1c6-6000-47b2-9188-9c15b2c73f8f.jpg?1783909763' },
  b_1_1_rat_relentless: { labels: ['creature', 'rat', 'black', 'token'], token: true, name: 'Rat token', set: 'tblb', collectorNumber: '13', image: 'https://cards.scryfall.io/normal/front/1/c/1c0977b2-3342-4b7e-b1c7-f06bd8ab7fbf.jpg?1783909768' },
};
const resolvePoolThing: ThingResolver = (thing) => POOL_TOKEN_REGISTRY[thing] ?? null;

// Every match name InteractionGroup can produce resolves to a real
// set/collectorNumber/image this way — any pool file for a printed card, or
// POOL_TOKEN_REGISTRY (keyed by its own display `name`) for a self-produced
// token. Shared by the "link to this card" and "fetch its art" needs below.
const POOL_TOKEN_REGISTRY_BY_NAME = new Map(Object.values(POOL_TOKEN_REGISTRY).map((t) => [t.name, t]));
function poolRef(name: string): { set: string; collectorNumber: string; image?: string | null } | null {
  return allPoolEntriesByName().get(name) ?? POOL_TOKEN_REGISTRY_BY_NAME.get(name) ?? null;
}

function loadInteractionGroups(cardName: string, cardTypeLine: string): InteractionGroup[] {
  const poolEntries = findPoolFor(cardName);
  if (!poolEntries) return [];
  const self = resolveSynergy(cardName);
  if (!self) return [];
  const pool = poolEntries.map((c) => {
    const s = resolveSynergy(c.name);
    return s ? { name: c.name, typeLine: c.typeLine, nodes: s.nodes } : null;
  }).filter((c): c is { name: string; typeLine: string; nodes: Record<string, SynergyNode> } => c !== null);
  const groups = groupInteractionsForCard({ name: cardName, typeLine: cardTypeLine, nodes: self.nodes }, pool, resolvePoolThing);

  // No live Scryfall call here on purpose — see PoolEntry's `image` comment
  // above. Every match name resolves to a real ref (its own pool entry, or
  // POOL_TOKEN_REGISTRY for a self-produced token) with art already on it.
  for (const group of groups) {
    for (const m of group.matches) {
      const ref = poolRef(m.name);
      m.set = ref?.set;
      m.collectorNumber = ref?.collectorNumber;
      m.image = ref?.image ?? null;
    }
  }
  return groups;
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
    interactions: loadInteractionGroups(card.name, cardData.typeLine),
  };
});
