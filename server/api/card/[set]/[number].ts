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

// No hand-authored edges.json entry -> translate the Forge script on the fly
// (app/lib/forgeTranslate.ts) instead of showing nothing. Same "not yet
// human-reviewed" treatment the card page already gives an AI decomposition
// — see forge-model/README.md's "Cards outside FIN" note.
function resolveSynergy(name: string): { nodes: Record<string, SynergyNode>; flow: SynergyFlow; review: 'ai' | 'human' | null } | null {
  const hand = loadSynergyEntries()[name];
  if (hand) return { nodes: hand.nodes, flow: hand.flow, review: loadSynergyStatus()[name]?.review ?? null };
  const forge = loadForgeScript(name);
  if (!forge) return null;
  const translated = translateForgeCard(parseForgeScript(forge));
  return { nodes: translated.nodes, flow: translated.flow, review: 'ai' };
}

// Small, explicit worked-example pool for app/lib/synergyInteractions.ts —
// a real cross-card join needs every OTHER card's synergy data available at
// once, which nothing in this app assembles yet (buildGraph.ts builds a
// whole set's worth of theme edges, not synergy-model nodes). Rather than
// fake a corpus-wide join, this lists the Cat cards from FDN (plus the
// original Slashing Tiger worked example, a different set) this session
// specifically prepared Forge scripts for. See forge-model/README.md.
const CAT_POOL: { name: string; typeLine: string; set: string; collectorNumber: string }[] = [
  { name: 'Arahbo, the First Fang', typeLine: 'Legendary Creature — Cat Avatar', set: 'fdn', collectorNumber: '2' },
  { name: 'Slashing Tiger', typeLine: 'Creature — Cat', set: 'me3', collectorNumber: '133' },
  { name: "Ajani's Pridemate", typeLine: 'Creature — Cat Soldier', set: 'fdn', collectorNumber: '135' },
  { name: 'Dawnwing Marshal', typeLine: 'Creature — Cat Soldier', set: 'fdn', collectorNumber: '570' },
  { name: 'Felidar Cub', typeLine: 'Creature — Cat Beast', set: 'fdn', collectorNumber: '573' },
  { name: 'Felidar Savior', typeLine: 'Creature — Cat Beast', set: 'fdn', collectorNumber: '12' },
  { name: 'Helpful Hunter', typeLine: 'Creature — Cat', set: 'fdn', collectorNumber: '16' },
  { name: 'Ingenious Leonin', typeLine: 'Creature — Cat Soldier', set: 'fdn', collectorNumber: '495' },
  { name: 'Jazal Goldmane', typeLine: 'Legendary Creature — Cat Warrior', set: 'fdn', collectorNumber: '497' },
  { name: 'Leonin Skyhunter', typeLine: 'Creature — Cat Knight', set: 'fdn', collectorNumber: '498' },
  { name: 'Leonin Vanguard', typeLine: 'Creature — Cat Soldier', set: 'fdn', collectorNumber: '499' },
  { name: 'Nine-Lives Familiar', typeLine: 'Creature — Cat', set: 'fdn', collectorNumber: '66' },
  { name: 'Prideful Parent', typeLine: 'Creature — Cat', set: 'fdn', collectorNumber: '21' },
  { name: 'Regal Caracal', typeLine: 'Creature — Cat', set: 'fdn', collectorNumber: '579' },
  { name: 'Savannah Lions', typeLine: 'Creature — Cat', set: 'fdn', collectorNumber: '146' },
  { name: 'Skyknight Squire', typeLine: 'Creature — Cat Scout', set: 'fdn', collectorNumber: '23' },
  { name: 'Wary Thespian', typeLine: 'Creature — Cat Druid', set: 'fdn', collectorNumber: '235' },
];
const CAT_POOL_BY_NAME = new Map(CAT_POOL.map((c) => [c.name, c]));

// TokenScript$ ids the CAT_POOL's own Forge scripts create, resolved for
// app/lib/synergyInteractions.ts's self-interaction pass (SCHEMA §7
// "self-sufficiency") — e.g. Arahbo's own trigger makes a Cat token that its
// own anthem then buffs. This is a small demo-scoped registry, same
// reasoning as CAT_POOL itself (see forge-model/README.md's "Cards outside
// FIN" note) — NOT synergy-model/data/registries.json, which is FIN-scoped
// reviewed data; these token scripts belong to a different corpus entirely.
// set/collectorNumber here are the ACTUAL Foundations token sheet prints
// (Scryfall `tfdn` — the dedicated token set for `fdn`) matching what these
// scripts create: `t:cat set:tfdn` turns up exactly a plain 1/1 (tfdn/1) and
// a lifelink 1/1 (tfdn/27). Real card refs, not synthesized — a token match
// gets the same clickable real art every other match gets.
const POOL_TOKEN_REGISTRY: Record<string, { labels: string[]; token: boolean; name: string; set: string; collectorNumber: string }> = {
  w_1_1_cat: { labels: ['creature', 'cat', 'white', 'token'], token: true, name: '1/1 white Cat token', set: 'tfdn', collectorNumber: '1' },
  w_1_1_cat_lifelink: {
    labels: ['creature', 'cat', 'white', 'token'],
    token: true,
    name: '1/1 white Cat token (lifelink)',
    set: 'tfdn',
    collectorNumber: '27',
  },
};
const resolvePoolThing: ThingResolver = (thing) => POOL_TOKEN_REGISTRY[thing] ?? null;

// Every match name InteractionGroup can produce resolves to a real
// set/collectorNumber this way — CAT_POOL for a printed card, or
// POOL_TOKEN_REGISTRY (keyed by its own display `name`) for a self-produced
// token. Shared by the "link to this card" and "fetch its art" needs below.
const POOL_TOKEN_REGISTRY_BY_NAME = new Map(Object.values(POOL_TOKEN_REGISTRY).map((t) => [t.name, t]));
function poolRef(name: string): { set: string; collectorNumber: string } | null {
  return CAT_POOL_BY_NAME.get(name) ?? POOL_TOKEN_REGISTRY_BY_NAME.get(name) ?? null;
}

// Match thumbnails need real Scryfall art — cached per server process (these
// are real, static printings, never change) instead of re-fetching Scryfall
// on every single card-page view that happens to show a match from this
// pool. Keyed by name since that's all InteractionGroup's matches carry.
const poolImageCache = new Map<string, Promise<string | null>>();
function poolCardImage(name: string): Promise<string | null> {
  const cached = poolImageCache.get(name);
  if (cached) return cached;
  const ref = poolRef(name);
  const promise = ref
    ? fetchBySetNumber(ref.set, ref.collectorNumber)
        .then((r) => (r.ok ? r.json() : null))
        .then((c) => c?.image_uris?.normal ?? c?.card_faces?.[0]?.image_uris?.normal ?? null)
        .catch(() => null)
    : Promise.resolve(null);
  poolImageCache.set(name, promise);
  return promise;
}

async function loadInteractionGroups(cardName: string, cardTypeLine: string): Promise<InteractionGroup[]> {
  if (!CAT_POOL_BY_NAME.has(cardName)) return [];
  const self = resolveSynergy(cardName);
  if (!self) return [];
  const pool = CAT_POOL.map((c) => {
    const s = resolveSynergy(c.name);
    return s ? { name: c.name, typeLine: c.typeLine, nodes: s.nodes } : null;
  }).filter((c): c is { name: string; typeLine: string; nodes: Record<string, SynergyNode> } => c !== null);
  const groups = groupInteractionsForCard({ name: cardName, typeLine: cardTypeLine, nodes: self.nodes }, pool, resolvePoolThing);

  const names = new Set(groups.flatMap((g) => g.matches.map((m) => m.name)));
  const images = new Map(await Promise.all([...names].map(async (n): Promise<[string, string | null]> => [n, await poolCardImage(n)])));
  for (const group of groups) {
    for (const m of group.matches) {
      const ref = poolRef(m.name);
      m.set = ref?.set;
      m.collectorNumber = ref?.collectorNumber;
      m.image = images.get(m.name) ?? null;
    }
  }
  return groups;
}

const curatedThemes = themesData as ThemeData[];
const curatedThemeIds = new Set(curatedThemes.map((t) => t.id));

async function fetchBySetNumber(set: string, number: string) {
  const r = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(number)}`, {
    headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' },
  });
  return r;
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
      const tRes = await fetch(`https://api.scryfall.com/cards/${tid}`, {
        headers: { 'User-Agent': 'mtg-visualizer/0.1', Accept: 'application/json' },
      });
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
    interactions: await loadInteractionGroups(card.name, cardData.typeLine),
  };
});
