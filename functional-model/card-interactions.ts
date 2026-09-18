// Card-page "Interactions" section — pure aggregation over the sink-only
// matcher (2026-09-18). Task brief: given ONE card's own `CardDefinition`
// and a POOL of `CardDefinition`s (whatever set is currently in view — FIN's
// ~300 or FDN's 10, per `.claude/contracts/card-schema.md`'s own "current
// scope" note; this file itself does no fs/db reads, a caller assembles the
// pool), produce one row per real synergy CATEGORY this card structurally
// participates in — `{ category, count, matchingCardNames }` — shaped like
// the graph's own node display ("Lifegain [7] v"), with the card's own
// `CardDefinition` always checked against its own derived categories too
// (no `notSelf`/self-exclusion anywhere in this file, by explicit
// instruction).
//
// ---------------------------------------------------------------------------
// THE REAL DESIGN QUESTION, investigated before writing a line of matching
// code — worked example throughout: Ajani's Pridemate
// (`fdn-cards/ajani-s-pridemate/definition.ts`):
//
//   triggers: [{ name: 'onLifeGained', effects: [{ kind: 'putCounter', ... }] }]
//
// No curated `sink-model/sink-query.ts` `SinkQuery` exists for this trigger
// today (that's a LATER pipeline stage — see the task brief / this project's
// `project_sink_only_synergy_experiment` memory — not reached for any of the
// 10 FDN cards yet). Two options were on the table:
//
//   (a) On-the-fly derivation: given a card's own trigger, derive a MINIMAL
//       `SinkQuery` automatically from its STRUCTURAL shape (no hand-
//       curation) — e.g. "this trigger's condition implies: any card with a
//       `gainLife` effect."
//   (b) Determine `name: 'onLifeGained'` is NOT a real, closed, auto-fired
//       engine signal at all (just a naming CONVENTION), in which case (a)
//       would be building on sand — and fall back to the narrower, always-
//       safe alternative: categorize by the trigger's/card's OWN EFFECT
//       KIND directly, regardless of what triggers it.
//
// **Checked against the real engine first, per the task's own instruction —
// verdict: (b), confirmed from THREE independent angles, not assumed:**
//
// 1. `card.ts`'s own `Trigger.on` field (the engine's ONLY real, closed,
//    auto-fired trigger-precondition vocabulary) is a fixed union —
//    `'enter' | 'upkeep' | 'endStep' | 'tapLandForMana' | 'attacks' |
//    'equippedAttacks'` — with NO `'lifeGained'`/`'gainLife'` member.
//    Ajani's Pridemate's own trigger sets neither `on` at all; only `name`.
// 2. `Trigger.name`'s own doc comment (`card.ts`, on `CardDefinition.
//    authoredFacts`) says this explicitly, citing THIS EXACT case: "
//    `Trigger.name` is a free-text label (`harness.ts`'s own
//    `Scenario.trigger` match key), not a closed, typed vocabulary the way
//    `Trigger.on` is ... so there is no SAFE general structural rule to
//    derive 'this named trigger's precondition is event X'." Ashe, Princess
//    of Dalmasca's `onAttack` and Ambrosia Whiteheart's `onLandfall` are
//    named as the SAME shape of gap.
// 3. The project ALREADY tried to solve this exact trigger name for real,
//    twice — `recognizers/lifegain-trigger-structural.ts` (grepped every
//    real `name: 'onLifeGained'` trigger pool-wide: excalibur-ii, minwu-
//    white-mage, aerith-gainsborough — note Aerith is the SAME trigger name
//    Ajani's Pridemate reuses) — and it did NOT trust the trigger name
//    either: it matches the literal ORACLE TEXT clause "Whenever you gain
//    life" instead, falling back to name-based inference not at all. FDN
//    `CardDefinition`s (checked every one of the 10 files) carry NO
//    `oracleText` field whatsoever — so even that more-robust, already-
//    established fallback isn't available here. There is genuinely no
//    structural signal on an FDN card weaker than "trust the free-text
//    trigger name," which the engine's own docs already call unsafe.
//
// **Conclusion: (a) does not hold up beyond `Trigger.on`'s closed enum.**
// Building a generic "trigger name implies event X" inference (even a small
// hand-curated one) would be re-introducing exactly the kind of per-card,
// per-name curation the sink-only experiment's whole premise is to remove
// (see `project_sink_only_synergy_experiment` — "supersedes source-fact
// recognizers") — just moved from oracle text onto an equally-unreliable
// free-text label. Declined, per the task's own instruction: "anything not
// cleanly derivable this way should be flagged/omitted, never guessed at
// with a wrong category."
//
// **What this file actually builds instead — narrower, real, general, zero
// curation**: reuses `sink-model/match-sink.ts`'s existing
// `deriveOccurrences` (already the sink-only model's own answer to "what
// does this card structurally, unconditionally guarantee" — it already
// walks every `effects`/`triggers[].effects`/`abilities[].effects` array,
// `program`-AST nodes, and the 2 baseline + 2 engine-automation-predicate
// families) and turns EACH of a card's own derived `ProducerOccurrence`s
// into its own pool-wide category, labeled via `synergy.ts`'s own
// `describeFact` — reusing the EXACT categorization vocabulary the OLD
// paired source+sink Fact model already established ("life gain", "dying",
// "counters", "damage", ...) rather than inventing a parallel one, per the
// task's own explicit instruction. This is a real generalization of the
// sink-only model in its own right: given ANY `CardDefinition`, its own
// occurrences ARE the query to run against the pool — no curated
// `SinkQuery` needed for THIS card, only reuse of the ALREADY-EXISTING
// matcher.
//
// **Consequence for the worked example, reported plainly, not oversold**:
// under this honest design, Ajani's Pridemate's own derived categories are
// "enters the battlefield" (baseline — it's a normal creature) and
// "counters" (from its own `putCounter` trigger effect) — **not**
// "Lifegain". Getting Ajani specifically into a "Lifegain" bucket needs
// either (i) the later curated per-card `SinkQuery`-authoring pipeline
// stage this project's own plan already anticipates for exactly this
// reason, or (ii) a genuine `Trigger` schema extension adding a REAL closed
// precondition vocabulary entry (the same kind of change `on:
// 'tapLandForMana'` was, when a real card needed it) — neither attempted
// here; doing either silently would be exactly the "guessed wrong category"
// the task warned against. See this project's own `match-sink.test.ts`'s
// sink B/B' pair for precedent: the identical "the honest structural shape
// doesn't line up with the historically-hand-authored one" situation,
// documented rather than silently forced to agree.
//
// ---------------------------------------------------------------------------
// CATALOG-FIRST CATEGORIZATION (2026-09-18, follow-up pass, same day as the
// sink-attachment revert — see `pipeline-status.ts`'s own header note and
// this project's own `.claude/contracts/card-schema.md` for the full
// "tried, then reverted" writeup on the attachment concept this replaces).
//
// The user's own explicit instruction: no persisted per-card decision of
// any kind — "which cards own the sink and which cards are selected for
// the sink... these we can derive on-the-fly for now." Real `SINK_CATALOG`
// entries (`sink-model/catalog/*.ts`) now exist with real category labels
// ("Lifegain", "Graveyard fodder") — so `computeCardInteractions` checks
// `definition` against EVERY usable (`blue`/`green`, `isSinkCatalogEntryUsable`)
// catalog entry's own `query` FIRST, via the exact same `matchSink` the
// catalog's own corpus tests already use (`matchSink(entry.query,
// definition, root)`). A match means `definition` itself structurally
// satisfies that entry's query — the catalog's real `query.category` label
// is used instead of the raw `describeFact` label, and the pool-wide count/
// matchingCardNames for that category is computed against the SAME
// `entry.query` (self-inclusive, same convention as the raw path). The
// occurrence that satisfied the catalog entry (`SinkMatchResult.via`) is
// marked "consumed" so it doesn't ALSO show up a second time under its own
// raw structural label — an occurrence not consumed by any catalog entry
// still falls back to the pre-existing raw `describeFact` labeling.
//
// **Honest limit, not fixed here**: `matchSink` returns only the FIRST
// occurrence (in `deriveOccurrences` order) whose `via` satisfies a given
// query — if a card had two DIFFERENT occurrences that would each
// independently satisfy the SAME catalog entry, only the first is marked
// consumed; the second would still separately appear under its own raw
// label. No real FDN card in the 10-card pool hits this today (checked);
// flagged rather than silently assumed impossible.
//
// **SUPERSEDED, 2026-09-18, later the same day — Ajani's Pridemate DOES now
// get "Lifegain."** The paragraph immediately below (kept verbatim as a
// historical record of the real investigation that preceded this
// correction — nothing in its reasoning about `query` being PRODUCER-shaped
// was wrong) concluded there was no safe way to recognize a genuine
// consumer-side card like Ajani. The user corrected the framing, not the
// conclusion about oracle text: `Trigger.name` IS a real, deliberately-
// authored structural handle (`card.ts`'s own doc comment on `Trigger.name`
// itself: "Matches a scenario's own `trigger` field" — already a genuine,
// intentional signal used elsewhere, not decoration); the standing caution
// against trusting it is specifically about driving ENGINE FIRING/
// simulation behavior, a materially higher-stakes concern than using it as
// a display/categorization signal with this catalog's own human-reviewed
// gate as the real check on false positives. Oracle/printed text is still
// never touched anywhere in this file or `sink-model/` — that constraint
// stands unchanged. See `SinkCatalogEntry.consumerTriggerNames`
// (`sink-model/catalog/entry.ts`) and `sink-model/match-sink.ts`'s
// `matchesConsumerTriggerNames` for the real mechanism this added, and
// `card-interactions.test.ts` for the updated, now-passing assertion.
//
// **Flagged, not forced — a catalog entry's query is PRODUCER-shaped, never
// a consumer/want signal, so this does NOT make every intuitively-related
// card land in the "right" category** (superseded in part by the note
// above — a catalog entry MAY now also declare a real, structural
// consumer-side signal via `consumerTriggerNames`, but that's an explicit,
// curated, per-entry opt-in, never an automatic consequence of `query`
// alone). Concretely: Ajani's Pridemate's own `name:'onLifeGained'` trigger
// did NOT used to make it categorize under "Lifegain" here — confirmed live
// at the time: `matchSink(lifegainQuery, ajanisPridemate)` is `false`,
// because Ajani's Pridemate doesn't itself have a `gainLife` effect; its
// trigger only REACTS to some OTHER source of lifegain, a consumer-side
// signal this file's own EARLIER investigation (below, "the real design
// question") found has no safe, closed-vocabulary structural derivation
// AS A PRODUCER query (`Trigger.name` is free-text, `Trigger.on`'s closed
// enum has no lifegain member). That investigation's conclusion about
// `query`/`Trigger.on` is unchanged; only the follow-up decision to also
// decline `Trigger.name` entirely as a CONSUMER signal was reversed, per
// the note above. Making the catalog query real, on its own, still only
// gives a real, reusable label for cards that genuinely ARE producers of a
// cataloged category (Day of Judgment's own "destroy all creatures" now
// correctly shows "Graveyard fodder" instead of the old raw "destroy"
// label) — reaching a genuine consumer-side card like Ajani additionally
// needs its catalog entry to declare a real `consumerTriggerNames` list,
// which `lifegain` now does.
//
// **Self-inclusion is real and unconditional** (explicit task requirement):
// `poolDefinitions` is walked with NO exclusion of `definition` itself —
// if `definition`'s own derived occurrences satisfy `definition`'s own
// derived category, `definition.name` appears in that category's own
// `matchingCardNames`. Demonstrated for real by Ajani's Pridemate's own
// "counters" category (it puts a counter on itself, satisfying its own
// bare "counters" want) and Day of Judgment's own "destroy" category (its
// own `destroy all creatures` program satisfies its own unconstrained
// destroy-a-creature want) in `card-interactions.test.ts` — no synthetic
// fixture needed for either.
import type { CardDefinition } from './card';
import { deriveOccurrences, matchesConsumerTriggerNames, matchSink } from './sink-model/match-sink';
import type { ProducerOccurrence } from './sink-model/match-sink';
import type { SinkQuery } from './sink-model/sink-query';
import type { Fact } from './synergy';
import { describeFact } from './synergy';
import { SINK_CATALOG } from './sink-model/catalog/index';
import { isSinkCatalogEntryUsable } from './sink-catalog-status';

export interface CardInteractionCategory {
  /** Human-readable label, reused verbatim from `synergy.ts`'s own
   * `describeFact` vocabulary ("life gain", "dying", "counters", ...) — see
   * this file's own header for why a parallel vocabulary was NOT invented. */
  category: string;
  /** Count of `poolDefinitions` entries (INCLUDING `definition` itself, if
   * it structurally satisfies its own derived category) that match. */
  count: number;
  /** `name` of every matching pool card, sorted for a stable, testable
   * order — not an index/id, matching this project's own "card identity key
   * is Scryfall name" convention. */
  matchingCardNames: string[];
}

/**
 * Strips the fields that only make sense for a SPECIFIC occurrence's own
 * identity (`via` — debug provenance; `resolvedAttrs` — a created token's
 * own resolved stats; `subject`/a bare `target: 'self'` — both always mean
 * "this same card," which has no meaning once generalized into a pool-wide
 * query) — keeping a `target` that's a real `Constraints` OBJECT (a genuine
 * filter, e.g. Day of Judgment's own `target: {types: {has: ['Creature']}}`
 * on its `destroy` occurrence), since that's real, general constraint data,
 * not a self-reference.
 */
function toSinkQuery(occ: ProducerOccurrence, category: string): SinkQuery {
  const { via, resolvedAttrs, subject, target, ...rest } = occ;
  const keepTarget = target !== undefined && typeof target === 'object' ? target : undefined;
  return { ...rest, ...(keepTarget !== undefined ? { target: keepTarget } : {}), category };
}

/**
 * Human-readable label for one occurrence — a thin, direct reuse of
 * `synergy.ts`'s own `describeFact` (the EXACT same function the old
 * paired source+sink Fact model already used to render a Facts-tab label),
 * not a re-derived parallel vocabulary. `describeFact` only ever reads
 * `role`/`event`/`zone`/`to`/`from` off its argument — a synthetic
 * `role: 'source'` wrapper is enough for a correct label; the cast bypasses
 * `Fact.annotations`'s own required-tuple type (SYNERGY_DESIGN.md: "no
 * annotation if undefined" doesn't apply here — this object is never
 * served/persisted as a real `Fact`, purely a label-rendering shim).
 */
function labelFor(occ: ProducerOccurrence): string {
  const { via, ...rest } = occ;
  return describeFact({ role: 'source', ...rest } as unknown as Fact);
}

/**
 * Every real interaction category `definition` structurally participates
 * in, against `poolDefinitions` (whatever set/pool is currently in view —
 * the caller's job to assemble; this function does no fs/db reads of its
 * own). Pure — same `root` passthrough convention `deriveOccurrences`/
 * `matchSink` already establish (only a test simulating a not-yet-blue
 * sink-derivation mechanism would ever override it).
 *
 * `definition` is NOT excluded from `poolDefinitions` internally — pass a
 * pool that already excludes it if a caller wants self-matches dropped
 * (same "this function itself takes no stance" convention `match-sink.ts`'s
 * own `countMatchesForSink` already documents); per this task's own
 * explicit requirement, the default here is to include it.
 */
export function computeCardInteractions(definition: CardDefinition, poolDefinitions: CardDefinition[], root: string = process.cwd()): CardInteractionCategory[] {
  const occurrences = deriveOccurrences(definition, root);
  const matchesByCategory = new Map<string, Set<string>>();
  // Which derived occurrence(s) (`via`) already got a real catalog-entry
  // category below — see this file's own "CATALOG-FIRST CATEGORIZATION"
  // header for why the raw fallback loop must skip these.
  const consumedVia = new Set<string>();

  for (const entry of SINK_CATALOG) {
    if (!isSinkCatalogEntryUsable(entry.slug, root)) continue; // not-yet-verified catalog data must never drive real matching
    // A candidate belongs to this entry's category via EITHER recognition
    // mode: the producer-shaped `query` (does `definition` itself cause the
    // event), OR the consumer-shaped `consumerTriggerNames` (does
    // `definition` carry a named trigger that REACTS to the event) — see
    // `SinkCatalogEntry.consumerTriggerNames`'s own doc comment
    // (`sink-model/catalog/entry.ts`) for why this is a safe, structural,
    // oracle-text-free signal. Either is sufficient; both may hold.
    const selfProducerMatch = matchSink(entry.query, definition, root);
    const selfConsumerMatch = matchesConsumerTriggerNames(entry.consumerTriggerNames, definition);
    if (!selfProducerMatch.matched && !selfConsumerMatch) continue;
    if (selfProducerMatch.matched && selfProducerMatch.via) consumedVia.add(selfProducerMatch.via);
    const category = entry.query.category;
    const matchedNames = matchesByCategory.get(category) ?? new Set<string>();
    for (const candidate of poolDefinitions) {
      if (matchSink(entry.query, candidate, root).matched || matchesConsumerTriggerNames(entry.consumerTriggerNames, candidate)) {
        matchedNames.add(candidate.name);
      }
    }
    matchesByCategory.set(category, matchedNames);
  }

  for (const occ of occurrences) {
    if (occ.via && consumedVia.has(occ.via)) continue; // already categorized under a real catalog entry above
    const category = labelFor(occ);
    const query = toSinkQuery(occ, category);
    const matchedNames = matchesByCategory.get(category) ?? new Set<string>();
    for (const candidate of poolDefinitions) {
      if (matchSink(query, candidate, root).matched) matchedNames.add(candidate.name);
    }
    matchesByCategory.set(category, matchedNames);
  }

  return [...matchesByCategory.entries()]
    .map(([category, names]) => ({ category, count: names.size, matchingCardNames: [...names].sort() }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}
