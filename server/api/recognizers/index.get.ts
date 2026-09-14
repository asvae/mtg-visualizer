// Recognizer coverage suite — GET /api/recognizers. Read-only reporting
// mirror of GET /api/keywords (server/api/keywords/index.get.ts), but for
// the automated-facts-extraction "recognizer" catalog
// (functional-model/recognizers/, see functional-model/
// PRD_AUTOMATED_AUTHORING.md's own "separate review lane for the parser
// itself" goal — a rule-catalog review, not a per-card one) instead of the
// keyword/mechanic registry.
//
// Every recognizer here is a REAL, already-wired function — there is no
// `not_implemented` case the way keywords/registry.ts has (a keyword can be
// a genuine engine gap; a recognizer that exists in this directory is, by
// construction, already applied pool-wide via
// `functional-model/scripts/apply-recognizers.mjs`). So every entry starts
// `ai_reviewed` and can only be upgraded to `human_reviewed` via the exact
// same override-file pattern keywords/index.get.ts already uses —
// `functional-model/recognizers/review-status.json` (written by this
// route's own sibling, `server/api/recognizers/review-status.ts`) layers a
// human-reviewed override on top at read time; the override can only
// upgrade, never downgrade, by construction (same as keywords').
//
// `id`/canonical list: imported directly from
// `server/api/recognizer-source/[rule].get.ts`'s own hand-kept
// `RECOGNIZER_IDS` (exported for this reuse) — that file's own comment
// explains why it's hand-kept rather than derived from the `RecognizerId`
// union at runtime; this route deliberately does NOT keep a second copy
// that could drift from it.
//
// `description`: extracted from each recognizer's OWN top-of-file module
// doc comment (the leading `//`-comment block before its first import),
// specifically just the comment's first paragraph — every one of the 5
// recognizer files opens with a single, self-contained "Recognizer X
// (...): '<plain-English definition of what it matches>'" paragraph, which
// is already a complete description on its own; deliberately not composing
// new prose to describe what a recognizer does; see `extractDescription`
// below. Read fresh off disk every request (dev convention, same as this
// route's own `loadFinScryfall`/`loadReviewOverrides` and every other
// "reflects a hand edit without a restart" reader in this codebase) rather
// than baked in at build time.
//
// `matchedCards`: every REAL card (functional-model/cards/<slug>/
// synergy.json) currently carrying a fact (in either its `source` or `sink`
// array) whose `provenance?.rule` equals this recognizer's id — built by
// scanning every synergy.json fresh off disk, same reasoning as
// `description` above (so re-running apply-recognizers.mjs reflects here
// without a restart). A card's own directory name IS the slug used
// everywhere else in this app (confirmed: `slugify()`, buildGraph.ts's own
// helper, applied to a Scryfall card's `name` round-trips cleanly onto every
// directory name in this pool, including multi-face names — e.g. "Crystal
// Fragments // Summon: Alexander" -> `crystal-fragments-summon-alexander`,
// a real directory in this pool); display `name`/`set`/`collectorNumber`
// are recovered by cross-referencing `data/fin/fin_scryfall.json` this way
// (the task's own suggested "simpler" option) rather than dynamically
// importing each card's own `definition.ts` (a real TS module with its own
// imports/side effects — much heavier than a JSON+string lookup for what's
// needed here).
//
// ~20 of the 325 real card directories in this pool are non-FIN
// crossover/design-reference cards (e.g. `breeding-pool`,
// `craterhoof-behemoth`) with no entry in `fin_scryfall.json` at all —
// confirmed directly (20 of 325, `Set.has` against every slugified
// fin_scryfall.json name). For those, `set`/`collectorNumber` are simply
// omitted and `name` falls back to a title-cased read of the slug itself;
// the page renders such a row as plain text (no `/app/card/<set>/<number>`
// link — that route needs both).
//
// `typeDerived` (2026-09-14, `ui` agent, "hide busywork Saga review rows"
// task): per-MATCHED-CARD flag — true when that specific match's fact(s)
// are entirely predictable from the card's own printed type/supertype
// alone (e.g. every Saga gets CR 714's lore-counter/sacrifice/dies facts
// purely by being a Saga, zero card-specific judgment involved), as
// opposed to a match that required reading THIS card's own specific
// written ability content (a `definition.ts`-authored `Effect`, or a
// literal trigger clause that only some cards of that type actually
// print). Deliberately a PER-MATCH field, not a bare recognizer-level
// boolean, per this feature's own task spec — a recognizer could in
// principle match some cards for purely-type reasons and others for
// substantive ones. In practice, checked directly against the real pool
// (every recognizer file's own module doc comment, 2026-09-14): only
// `saga-lore-and-sacrifice-structural` qualifies, and it qualifies for
// EVERY real match it has today (both its "3-fact" and its rarer
// "1-fact, sacrifice+dies pair conservatively declined" matches are
// equally structural — the decline itself is a structural read of the
// final chapter's own `Effect` kind, never oracle-text judgment). Every
// other recognizer in the pool keys off that SPECIFIC card's own written
// effect/trigger content (an authored `kind:'destroy'`/`'drawCard'`/etc.
// `Effect`, or requires a literal clause like "Whenever ~ dies," to
// actually appear on that card — not every card of the relevant type
// carries it), or requires an ABSENCE of override text specific to that
// card (`instant-sorcery-resolves-to-graveyard`/
// `permanent-enters-battlefield-normally`), so none of their matches
// qualify. `TYPE_DERIVED_RECOGNIZER_IDS` (imported below, not defined here
// any more — see its own doc comment in `functional-model/recognizers/
// types.ts` for why it was hoisted there 2026-09-14 by the `card` agent, so
// the card page's own Facts-tab "Show type-derived facts" checkbox shares
// this exact classification instead of hand-keeping a second copy) is
// therefore a recognizer-keyed lookup table (today's real pool genuinely IS
// all-or-nothing per recognizer) feeding a per-match field — if a future
// recognizer ever legitimately mixes type-derived and substantive matches,
// this field's shape already supports that without a redesign; only that
// lookup table would need to grow into something finer-grained.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { slugify } from '../../../app/lib/buildGraph';
import type { ScryfallCard } from '../../../app/lib/buildGraph';
import type { ReviewStatus } from '../../../app/types';
import { RECOGNIZER_IDS } from '../recognizer-source/[rule].get';
import { TYPE_DERIVED_RECOGNIZER_IDS } from '../../../functional-model/recognizers/types';

const RECOGNIZERS_DIR = join(process.cwd(), 'functional-model', 'recognizers');
const CARDS_DIR = join(process.cwd(), 'functional-model', 'cards');

// This route's own human-readable labels — not present anywhere else in the
// codebase (RECOGNIZER_IDS itself is just the bare rule-id strings).
const TITLES: Record<string, string> = {
  'destroy-effect-structural': 'Destroy (structural)',
  'drawCard-effect-structural': 'Draw card (structural)',
  'saga-lore-and-sacrifice-structural': 'Saga: lore & sacrifice (structural)',
  'putCounterSelf-effect-structural': 'Put counter on self (structural)',
  'putCounterMagnitude-clause-structural': 'Counter-count magnitude clause (structural)',
};

function loadReviewOverrides(): Record<string, true> {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'functional-model', 'recognizers', 'review-status.json'), 'utf8'));
  } catch {
    return {};
  }
}

function loadFinScryfall(): ScryfallCard[] {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'data', 'fin', 'fin_scryfall.json'), 'utf8'));
  } catch {
    return [];
  }
}

// Leading `//`-comment block's first paragraph, `//` prefixes stripped —
// see this file's own header comment for why this is extraction, not
// authorship.
function extractDescription(source: string): string {
  const lines = source.split('\n');
  const commentLines: string[] = [];
  for (const line of lines) {
    if (!line.startsWith('//')) break;
    commentLines.push(line.slice(2).replace(/^ /, ''));
  }
  const firstParagraph: string[] = [];
  for (const line of commentLines) {
    if (line.trim() === '') {
      if (firstParagraph.length) break;
      continue;
    }
    firstParagraph.push(line.trim());
  }
  return firstParagraph.join(' ');
}

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

interface FactLike {
  provenance?: { origin?: string; rule?: string };
}

export interface RecognizerMatchedCard {
  name: string;
  slug: string;
  set?: string;
  collectorNumber?: string;
  /** See this file's own header comment on `TYPE_DERIVED_RECOGNIZER_IDS`. */
  typeDerived: boolean;
}

export interface RecognizerPageEntry {
  id: string;
  title: string;
  description: string;
  status: ReviewStatus;
  matchedCards: RecognizerMatchedCard[];
  matchCount: number;
}

export default defineEventHandler((): RecognizerPageEntry[] => {
  const reviewOverrides = loadReviewOverrides();
  const scryfallPool = loadFinScryfall();
  const slugToScryfall = new Map(scryfallPool.map((c) => [slugify(c.name), c]));

  const cardDirs = readdirSync(CARDS_DIR).filter((name) => statSync(join(CARDS_DIR, name)).isDirectory());

  return RECOGNIZER_IDS.map((id) => {
    const filePath = join(RECOGNIZERS_DIR, `${id}.ts`);
    const description = existsSync(filePath) ? extractDescription(readFileSync(filePath, 'utf8')) : '';

    const matchedCards: RecognizerMatchedCard[] = [];
    for (const slug of cardDirs) {
      const synergyPath = join(CARDS_DIR, slug, 'synergy.json');
      if (!existsSync(synergyPath)) continue;
      let data: { source?: FactLike[]; sink?: FactLike[] };
      try {
        data = JSON.parse(readFileSync(synergyPath, 'utf8'));
      } catch {
        continue;
      }
      const facts = [...(data.source ?? []), ...(data.sink ?? [])];
      if (!facts.some((f) => f.provenance?.rule === id)) continue;
      const scryfallCard = slugToScryfall.get(slug);
      matchedCards.push({
        name: scryfallCard?.name ?? titleCaseSlug(slug),
        slug,
        set: scryfallCard?.set,
        collectorNumber: scryfallCard?.collector_number,
        typeDerived: TYPE_DERIVED_RECOGNIZER_IDS.has(id),
      });
    }
    matchedCards.sort((a, b) => a.name.localeCompare(b.name));

    return {
      id,
      title: TITLES[id] ?? titleCaseSlug(id),
      description,
      status: reviewOverrides[id] ? 'human_reviewed' : 'ai_reviewed',
      matchedCards,
      matchCount: matchedCards.length,
    };
  });
});
