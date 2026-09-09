// Keyword/mechanic coverage suite — GET /api/keywords. Serves
// functional-model/keywords/registry.ts's own entries, each `ai_reviewed`/
// `human_reviewed` one paired with its real engine-piloted trace
// (functional-model/keywords/<bundle>/trace.json) plus the real card art/
// keywords/power/toughness (data/fin/fin_scryfall.json — every card in this
// pool is FIN) its scenario demonstrates with, in the SAME shape
// ScenarioReplay.vue already consumes on the per-card detail page (see that
// component's own props).
//
// 2026-09-09 (engine handoff landed): registry.ts's own `KeywordEntry.status`
// is now the shared 3-way `ReviewStatus` vocabulary directly (app/types.ts:
// 'not_implemented' | 'ai_reviewed' | 'human_reviewed') — the earlier
// two-field `status`/`reviewStatus` split (kept while registry.ts was still
// binary 'covered'/'gap') has collapsed back into one `status` field, per
// this file's own prior TODO. `functional-model/keywords/review-status.json`
// (server/api/keywords/review-status.ts) still layers a human-reviewed
// OVERRIDE on top at read time — a registry entry statically saying
// `ai_reviewed` is upgraded to `human_reviewed` if the override file names
// its key; `not_implemented` is never overridden (nothing to review); the
// override can only upgrade, never downgrade, by construction.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { KEYWORD_REGISTRY } from '../../../functional-model/keywords/registry';
import type { KeywordCategory, KeywordStatus } from '../../../functional-model/keywords/registry';
import type { Scenario, LogEntry } from '../../../functional-model/harness';

// Read fresh off disk every request (dev convention, same as
// review-status.ts's own sibling in server/api/card/ and this file's own
// `loadFinScryfall` below) — a hand-flipped override reflects without a
// restart.
function loadReviewOverrides(): Record<string, true> {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'functional-model', 'keywords', 'review-status.json'), 'utf8'));
  } catch {
    return {};
  }
}

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
  category: KeywordCategory;
  status: KeywordStatus;
  gapNote?: string;
  /** See registry.ts's own `KeywordEntry.setsUsed` doc comment — only ever populated for a `'set-specific'` entry. */
  setsUsed?: string[];
  cards: CardArt[];
  traces: { scenario: { setup: string; action: string; result: string; raw?: Scenario }; log: LogEntry[]; actions?: { label: string; from: number }[] }[];
}

export default defineEventHandler((): KeywordPageEntry[] => {
  const pool = loadFinScryfall();
  const reviewOverrides = loadReviewOverrides();
  return KEYWORD_REGISTRY.map((entry) => {
    const cards = entry.cardNames.map((n) => cardArtFor(n, pool)).filter((c): c is CardArt => !!c);
    let traces: KeywordPageEntry['traces'] = [];
    if (entry.status !== 'not_implemented' && entry.bundle) {
      const tracePath = join(process.cwd(), 'functional-model', 'keywords', entry.bundle, 'trace.json');
      if (existsSync(tracePath)) {
        try {
          traces = JSON.parse(readFileSync(tracePath, 'utf8'));
        } catch {
          traces = [];
        }
      }
    }
    // The human-reviewed override can only ever upgrade an already-real
    // `ai_reviewed` entry — never invents review status for a
    // `not_implemented` one (nothing to review) and never downgrades.
    const status: KeywordStatus =
      entry.status === 'ai_reviewed' && reviewOverrides[entry.key] ? 'human_reviewed' : entry.status;
    return {
      key: entry.key,
      title: entry.title,
      keywords: entry.keywords,
      ruleCite: entry.ruleCite,
      category: entry.category,
      status,
      gapNote: entry.gapNote,
      setsUsed: entry.setsUsed,
      cards,
      traces,
    };
  });
});
