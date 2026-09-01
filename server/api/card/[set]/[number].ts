// Single-card detail endpoint — everything the card detail page needs
// (Scryfall data, tagging relations, and our homebrew shorthand notes) in one
// request, independent of the big client-side graph store (app/composables/
// useGraphStore.ts). That store assembles a whole set/query's worth of cards
// at once via buildGraph.ts; this route reuses buildGraph.ts's per-card
// mapping helpers so a single card renders identically without needing the
// rest of the corpus loaded.
//
// GET /api/card/:set/:number  — same identity Scryfall's own card URLs use
// (scryfall.com/card/<set>/<number>), so prev/next is a plain ±1 on :number.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cardImages, cardKeywords, cardTokens, creatureSubtypes, slugify, BADGE_KEYWORDS } from '../../../../app/lib/buildGraph';
import type { ScryfallCard, RelationsEntry, TokensById } from '../../../../app/lib/buildGraph';
import type { CardData, EdgeData, Role, ThemeData } from '../../../../app/types';
import relationsData from '../../../../data/global_relations.json';
import finRelationsData from '../../../../data/fin/fin_relations.json';
import themesData from '../../../../data/global_themes.json';
import bundledShorthands from '../../../../data/card_shorthands.json';
import bundledShorthandStatus from '../../../../data/card_shorthand_status.json';

// Read fresh off disk on every request in dev, instead of the statically
// bundled imports — these files are being hand-edited card by card right
// now, and a static import only reflects a full dev-server restart (Nitro
// doesn't hot-reload data imported into server routes the way Vite
// hot-reloads the client). `import.meta.url` isn't reliable here — Nitro's
// dev bundle rewrites it to point at a rolled-up chunk, not this source
// file — so resolve from `process.cwd()` (the repo root the dev server runs
// from) instead. Falls back to the bundled copy so a production build
// (different cwd, raw `data/` source tree not shipped) still works.
function loadJsonFresh<T>(relativePath: string, bundled: T): T {
  if (process.env.NODE_ENV === 'production') return bundled;
  try {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8'));
  } catch {
    return bundled;
  }
}
interface ShorthandStatus {
  shorthand: 'ai' | 'human';
  review: 'ai' | 'human';
}
function loadShorthands(): Record<string, string> {
  return loadJsonFresh('data/card_shorthands.json', bundledShorthands as Record<string, string>);
}
function loadShorthandStatus(): Record<string, ShorthandStatus> {
  return loadJsonFresh('data/card_shorthand_status.json', bundledShorthandStatus as Record<string, ShorthandStatus>);
}

// fin_relations.json wins over global_relations.json by name — see
// server/api/cards.ts for why (FIN not yet chronologically merged).
const relationsByName = new Map<string, RelationsEntry>([
  ...(relationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
  ...(finRelationsData as unknown as RelationsEntry[]).map((r): [string, RelationsEntry] => [r.name, r]),
]);

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

  return {
    card: cardData,
    edges,
    themes,
    shorthand: loadShorthands()[card.name] ?? null,
    shorthandReview: loadShorthandStatus()[card.name]?.review ?? null,
  };
});
