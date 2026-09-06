// Keyword/mechanic coverage suite — GET /api/keywords. Serves
// functional-model/keywords/registry.ts's own entries, each `covered` one
// paired with its real engine-piloted trace (functional-model/keywords/
// <bundle>/trace.json) plus the real card art/keywords/power/toughness
// (data/fin/fin_scryfall.json — every card in this pool is FIN) its
// scenario demonstrates with, in the SAME shape ScenarioReplay.vue already
// consumes on the per-card detail page (see that component's own props).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { KEYWORD_REGISTRY } from '../../../functional-model/keywords/registry';
import type { Scenario, LogEntry } from '../../../functional-model/harness';

interface ScryfallCardFace {
  power?: string;
  toughness?: string;
  image_uris?: { normal?: string };
}
interface ScryfallCard {
  name: string;
  power?: string;
  toughness?: string;
  keywords?: string[];
  image_uris?: { normal?: string };
  card_faces?: ScryfallCardFace[];
}

// Read fresh off disk (dev convention — see server/api/card/[set]/[number].ts's
// own `loadJsonFresh`), so a hand-edited fixture reflects without a restart.
function loadFinScryfall(): ScryfallCard[] {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'data', 'fin', 'fin_scryfall.json'), 'utf8'));
  } catch {
    return [];
  }
}

interface CardArt {
  name: string;
  images: string[];
  keywords: string[];
  power?: string;
  toughness?: string;
}

function cardArtFor(name: string, pool: ScryfallCard[]): CardArt | null {
  const card = pool.find((c) => c.name === name);
  if (!card) return null;
  const images = [card.image_uris?.normal, ...(card.card_faces ?? []).map((f) => f.image_uris?.normal)].filter((u): u is string => !!u);
  return {
    name: card.name,
    images,
    keywords: card.keywords ?? [],
    power: card.power ?? card.card_faces?.[0]?.power,
    toughness: card.toughness ?? card.card_faces?.[0]?.toughness,
  };
}

export interface KeywordPageEntry {
  key: string;
  title: string;
  keywords: string[];
  ruleCite: string;
  category: 'evergreen' | 'fin-mechanic';
  status: 'covered' | 'gap';
  gapNote?: string;
  cards: CardArt[];
  traces: { scenario: { setup: string; action: string; result: string; raw?: Scenario }; log: LogEntry[]; actions?: { label: string; from: number }[] }[];
}

export default defineEventHandler((): KeywordPageEntry[] => {
  const pool = loadFinScryfall();
  return KEYWORD_REGISTRY.map((entry) => {
    const cards = entry.cardNames.map((n) => cardArtFor(n, pool)).filter((c): c is CardArt => !!c);
    let traces: KeywordPageEntry['traces'] = [];
    if (entry.status === 'covered' && entry.bundle) {
      const tracePath = join(process.cwd(), 'functional-model', 'keywords', entry.bundle, 'trace.json');
      if (existsSync(tracePath)) {
        try {
          traces = JSON.parse(readFileSync(tracePath, 'utf8'));
        } catch {
          traces = [];
        }
      }
    }
    return {
      key: entry.key,
      title: entry.title,
      keywords: entry.keywords,
      ruleCite: entry.ruleCite,
      category: entry.category,
      status: entry.status,
      gapNote: entry.gapNote,
      cards,
      traces,
    };
  });
});
