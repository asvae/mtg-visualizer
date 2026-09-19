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
// No curated `matcher-model/matcher-query.ts` `MatcherQuery` exists for this trigger
// today (that's a LATER pipeline stage — see the task brief / this project's
// `project_sink_only_synergy_experiment` memory — not reached for any of the
// 10 FDN cards yet). Two options were on the table:
//
//   (a) On-the-fly derivation: given a card's own trigger, derive a MINIMAL
//       `MatcherQuery` automatically from its STRUCTURAL shape (no hand-
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
// curation**: reuses `matcher-model/match-query.ts`'s existing
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
// `MatcherQuery` needed for THIS card, only reuse of the ALREADY-EXISTING
// matcher.
//
// **Consequence for the worked example, reported plainly, not oversold**:
// under this honest design, Ajani's Pridemate's own derived categories are
// "enters the battlefield" (baseline — it's a normal creature) and
// "counters" (from its own `putCounter` trigger effect) — **not**
// "Lifegain". Getting Ajani specifically into a "Lifegain" bucket needs
// either (i) the later curated per-card `MatcherQuery`-authoring pipeline
// stage this project's own plan already anticipates for exactly this
// reason, or (ii) a genuine `Trigger` schema extension adding a REAL closed
// precondition vocabulary entry (the same kind of change `on:
// 'tapLandForMana'` was, when a real card needed it) — neither attempted
// here; doing either silently would be exactly the "guessed wrong category"
// the task warned against. See this project's own `match-query.test.ts`'s
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
// the sink... these we can derive on-the-fly for now." Real `MATCHER_CATALOG`
// entries (`matcher-model/catalog/*.ts`) now exist with real category labels
// ("Lifegain", "Graveyard fodder") — so `computeCardInteractions` checks
// `definition` against EVERY usable (`blue`/`green`, `isMatcherCatalogEntryUsable`)
// catalog entry's own `query` FIRST, via the exact same `matchQuery` the
// catalog's own corpus tests already use (`matchQuery(entry.query,
// definition, root)`). A match means `definition` itself structurally
// satisfies that entry's query — the catalog's real `query.category` label
// is used instead of the raw `describeFact` label, and the pool-wide count/
// matchingCardNames for that category is computed against the SAME
// `entry.query` (self-inclusive, same convention as the raw path). The
// occurrence that satisfied the catalog entry (`MatchResult.via`) is
// marked "consumed" so it doesn't ALSO show up a second time under its own
// raw structural label — an occurrence not consumed by any catalog entry
// still falls back to the pre-existing raw `describeFact` labeling.
//
// **Honest limit, not fixed here**: `matchQuery` returns only the FIRST
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
// never touched anywhere in this file or `matcher-model/` — that constraint
// stands unchanged. See `MatcherCatalogEntry.consumerTriggerNames`
// (`matcher-model/catalog/entry.ts`) and `matcher-model/match-query.ts`'s
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
// at the time: `matchQuery(lifegainQuery, ajanisPridemate)` is `false`,
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
//
// ---------------------------------------------------------------------------
// **SUPERSEDED, 2026-09-18, later still — catalog-only now, the raw
// structural fallback below no longer contributes to this function's
// returned categories at all.** Everything above (the whole "raw fallback,
// same `describeFact` vocabulary the old paired source+sink Fact model
// used" design, and the "CATALOG-FIRST CATEGORIZATION" section right below
// it) is kept verbatim as the real investigation that led here — nothing in
// it was wrong, it's just no longer what this function DOES. The user's own
// correction: the Interactions panel should "only consider sink resources
// there" — a raw, uncurated `describeFact` label like "enters the
// battlefield"/"counters" (Ajani's Pridemate's own pre-this-change output,
// alongside its real "Lifegain" catalog match) is noise next to a genuine,
// human-reviewed `MATCHER_CATALOG` entry, not a useful second-tier category.
// Concretely: Ajani's Pridemate now returns ONLY `"Lifegain"`; Day of
// Judgment now returns ONLY `"Graveyard fodder"`. A card with zero
// catalog-covered occurrences now returns `[]` (same empty-array shape as
// always — `CardDetailTabs.vue`'s own `v-if="fdnInteractions.length"` guard
// already handles that with no further change needed).
//
// `toMatcherQuery`/`labelFor` (the raw-occurrence-to-category machinery) and
// the `deriveOccurrences` call that fed them are DELETED outright, not just
// unused-in-place — confirmed nothing else in the repo imports either
// function (grepped before removing), so keeping them around as dead code
// would just be a second, silent way to reintroduce the fallback later by
// accident. `deriveOccurrences`/`matchQuery`'s own sink-only-model machinery
// is untouched — this file is still the same thin aggregation layer over
// it, just catalog-entries-only now.
//
// **SUPERSEDED, 2026-09-18, later still — a card's own CONSUMER match no
// longer makes it a MATCH in its own (or anyone else's) `matchingCardNames`.**
// A real bug in the very first `consumerTriggerNames` cut (immediately
// above): the inner per-candidate loop counted a candidate as a match via
// EITHER `matchQuery` (producer) OR `matchesConsumerTriggerNames` (consumer)
// — so Ajani's Pridemate showed up inside its own `"Lifegain"` category's
// `matchingCardNames`, even though it has no `gainLife` effect of its own.
// The user's own correction: "It doesn't [have lifegain] — it's purely a
// sink 'whenever you gain life'." Consumer mode now does exactly ONE job —
// deciding whether `definition` OWNS/cares about a category at all (so it
// appears in `definition`'s own output) — never whether a candidate counts
// as a match. Matches are PRODUCER-only, always. This is the original
// "self-source" rule taken literally: a card appears among its own matches
// only when it genuinely IS the source of its own category, never merely
// because it asks the question. Ajani's Pridemate now returns a real
// `"Lifegain"` row (it owns the category) whose `matchingCardNames`
// contains real producers only (Felidar Savior, Healer's Hawk) and never
// itself; a pool with no producer at all still yields the row, with
// `count: 0`/`matchingCardNames: []` — an honest "you care about this, but
// nothing in scope produces it yet," not a hidden/omitted row.
// ---------------------------------------------------------------------------
import type { CardDefinition } from './card';
import { matchesBattlefieldPresenceConsumer, matchesConsumerTriggerNames, matchesConsumerTriggerOn, matchQuery } from './matcher-model/match-query';
import { MATCHER_CATALOG } from './matcher-model/catalog/index';
import type { Matcher } from './matcher-model/catalog/entry';
import { isMatcherCatalogEntryUsable } from './matcher-catalog-status';

/**
 * Real producer/consumer match detail for ONE `MATCHER_CATALOG` entry against
 * ONE candidate.
 *
 * **PRODUCER** — uniform whether `entry` is a plain, non-callable
 * `MatcherCatalogEntry` (`lifegain`/`graveyard-fodder`/`etb`, still matched via
 * a direct `matchQuery(entry.query, ...)` call, same as always) or a real,
 * invocable `Matcher` (every `battlefield-presence-*`/`counters-*`
 * member, built by `BattlefieldPresenceMatcher`/`CountersMatcher`) — a callable
 * entry answers the producer question with its own plain-boolean call
 * (`entry(candidate, root)`, 2026-09-19 — see `matcher-model/catalog/entry.ts`'s
 * own `Matcher` doc comment for the full "3rd real design iteration on
 * this callable contract" writeup); `predicateDerived` comes from the
 * callable's own `isPredicateDerived` accessor for that case,
 * `matchQuery(...).predicateDerived` for the non-callable case.
 *
 * **Why routing through the callable is still load-bearing for the
 * producer question specifically (2026-09-18, `CountersMatcher`
 * producer-mechanism rewrite):** `CountersMatcher`'s own entries carry no
 * `query` at all (`MatcherCatalogEntry.query` is optional — see that field's
 * own doc comment, `matcher-model/catalog/entry.ts`) — calling
 * `matchQuery(entry.query, ...)` directly for a `counters-*` entry would pass
 * `undefined` and throw. Every real `Matcher` (family-built, including
 * `counters-*`) is ALWAYS callable, so routing through `entry(candidate,
 * root)` for those and falling back to the old direct `matchQuery` call only
 * for a plain, non-callable `MatcherCatalogEntry` (which still always has a
 * real `query`) is both correct today and forward-compatible with a future
 * family that drops `query` the same way.
 *
 * **CONSUMER (2026-09-19, boolean-return rewrite)** — no longer routed
 * through the callable at ALL, whether `entry` is callable or not: the
 * three consumer-check functions (`matchesConsumerTriggerNames`/
 * `matchesConsumerTriggerOn`/`matchesBattlefieldPresenceConsumer`) are
 * called directly against `entry`'s own plain data fields
 * (`consumerTriggerNames`/`consumerTriggerOn`/`consumerBattlefieldPresence`)
 * uniformly — a callable `Matcher` carries these same data fields too
 * (the factory `Object.assign`s them onto the function value alongside
 * `slug`/`query`/...), so there is no real distinction left to branch on for
 * the consumer side at all anymore. This is the SAME real fix `server/api/
 * sink-catalog/index.get.ts`'s own `instanceConsumerMatched` needed for the
 * identical reason, applied here too.
 */
function matchEntry(entry: (typeof MATCHER_CATALOG)[number], candidate: CardDefinition, root: string): { producerMatched: boolean; predicateDerived: boolean; consumerMatched: boolean } {
  let producerMatched: boolean;
  let predicateDerived: boolean;
  if (typeof entry === 'function') {
    const instance = entry as unknown as Matcher;
    producerMatched = instance(candidate, root);
    predicateDerived = producerMatched && !!instance.isPredicateDerived?.(candidate, root);
  } else {
    const producer = matchQuery(entry.query!, candidate, root);
    producerMatched = producer.matched;
    predicateDerived = !!producer.predicateDerived;
  }
  const consumerMatched =
    matchesConsumerTriggerNames(entry.consumerTriggerNames, candidate) ||
    matchesConsumerTriggerOn(entry.consumerTriggerOn, candidate) ||
    matchesBattlefieldPresenceConsumer(entry.consumerBattlefieldPresence, candidate);
  return { producerMatched, predicateDerived, consumerMatched };
}

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
 * Every real, CATALOG-COVERED interaction category `definition`
 * structurally participates in, against `poolDefinitions` (whatever
 * set/pool is currently in view — the caller's job to assemble; this
 * function does no fs/db reads of its own). Pure — same `root` passthrough
 * convention `matchQuery` already establishes (only a test simulating a
 * not-yet-blue sink-derivation mechanism would ever override it).
 *
 * **Catalog-only, 2026-09-18, later still** — see this file's own header
 * "SUPERSEDED" note for the full writeup: a category is real ONLY when a
 * usable `MATCHER_CATALOG` entry actually matches (producer-shaped `query` via
 * `matchQuery`, or consumer-shaped `consumerTriggerNames`). There is
 * deliberately no raw structural fallback anymore — a `definition` with no
 * catalog-covered occurrence at all returns `[]`, not a lower-quality
 * "at least something" category.
 *
 * `definition` is NOT excluded from `poolDefinitions` internally — pass a
 * pool that already excludes it if a caller wants self-matches dropped
 * (same "this function itself takes no stance" convention `match-query.ts`'s
 * own `countMatchesForQuery` already documents); per this task's own
 * explicit requirement, the default here is to include it.
 */
export function computeCardInteractions(definition: CardDefinition, poolDefinitions: CardDefinition[], root: string = process.cwd()): CardInteractionCategory[] {
  const matchesByCategory = new Map<string, Set<string>>();

  for (const entry of MATCHER_CATALOG) {
    if (!isMatcherCatalogEntryUsable(entry.slug, root)) continue; // not-yet-verified catalog data must never drive real matching
    // A candidate belongs to this entry's category via EITHER recognition
    // mode: the producer-shaped `query` (does `definition` itself cause the
    // event), OR the consumer-shaped `consumerTriggerNames` (does
    // `definition` carry a named trigger that REACTS to the event) — see
    // `MatcherCatalogEntry.consumerTriggerNames`'s own doc comment
    // (`matcher-model/catalog/entry.ts`) for why this is a safe, structural,
    // oracle-text-free signal. Either is sufficient; both may hold.
    const self = matchEntry(entry, definition, root);
    // A predicate-derived producer match (Lifelink's automatic lifegain,
    // Saga chapter-completion death, Crew's tap activation — see
    // `ProducerOccurrence.predicateDerived`'s own doc comment) is real
    // enough to make `definition` a MATCH for someone else's category (the
    // reverse direction, below, is unaffected), but never enough to make
    // `definition` OWN/self-display the category on its own page: the
    // category isn't a genuine, directly-authored statement of what this
    // card does (compare Day of Judgment's own real `destroy all
    // creatures` program, a direct effect walk) — it's a structural
    // inference the engine happens to guarantee as a side effect. 2026-09-18,
    // added for the real Healer's Hawk/Felidar Savior bug: both used to
    // self-display "Lifegain" purely off their own Lifelink keyword, with
    // no `gainLife` effect anywhere on either card.
    const selfDirectProducerMatch = self.producerMatched && !self.predicateDerived;
    // Three independent consumer-side signals — a candidate may declare any
    // combination (`etb`'s own `consumerTriggerOn: ['enter']`, `lifegain`'s
    // own `consumerTriggerNames: ['onLifeGained']`, the `battlefield-
    // presence-cats`/`battlefield-presence-creatures` pair's own
    // `consumerBattlefieldPresence`, 2026-09-18 — Claws Out's own real
    // "Affinity for Cats"/bare "Creatures you control get +2/+2" shapes);
    // see each field's own doc comment (`matcher-model/catalog/entry.ts`) for
    // why `Trigger.on` (closed enum), `Trigger.name` (free text), and
    // `CostReduction.perControlled`/`pumpAll`/`putCounterAll` (a genuinely
    // different, non-trigger-based structural shape) each needed their own
    // check — all folded uniformly into `matchEntry` above (including, for a
    // callable `Matcher`, `CountersMatcher`'s own `consumerTriggerNames`
    // check).
    const selfConsumerMatch = self.consumerMatched;
    // Real bug fix (2026-09-18, found live: Helpful Hunter — a genuine,
    // printed Cat — self-displayed "Cats" on its OWN page purely for BEING
    // a Cat, no cost-reduction/anthem effect of its own at all). Every
    // OTHER catalog entry treats a direct producer match as sufficient for
    // self-ownership on its own (Bigfin Bouncer's real bounce effect, Day
    // of Judgment's real destroy-all program — genuine authored abilities).
    // That's the WRONG rule for "Battlefield presence": merely BEING a
    // Cat/Creature is passive type/subtype membership, not a deliberate
    // ability — bare membership alone must never grant self-ownership, or
    // literally every Cat/Creature card in the pool would self-display it.
    // `entry.requireConsumerForSelfOwnership` (see its own doc comment,
    // `matcher-model/catalog/entry.ts`) narrows self-ownership down to
    // `selfConsumerMatch` ALONE for exactly the 2 entries that need it
    // (`battlefield-presence-cats`/`-creatures`) — every other entry keeps
    // its pre-existing `selfDirectProducerMatch || selfConsumerMatch` rule
    // unchanged. The REVERSE direction (the per-candidate loop just below,
    // deciding who counts as a MATCH for whoever does own the category) is
    // completely unaffected either way — Helpful Hunter still correctly
    // appears in Claws Out's own "Cats" `matchingCardNames`.
    const selfOwnsCategory = entry.requireConsumerForSelfOwnership ? selfConsumerMatch : selfDirectProducerMatch || selfConsumerMatch;
    if (!selfOwnsCategory) continue;
    // `entry.category` — a real, top-level display label (2026-09-18, added
    // for `CountersMatcher`'s own no-`query`-at-all entries; see that field's
    // own doc comment, `matcher-model/catalog/entry.ts`) — takes precedence
    // when present; every entry that still has a real `query` (every
    // non-Counters entry today) falls back to `query.category`, unchanged.
    const category = entry.category ?? entry.query!.category;
    const matchedNames = matchesByCategory.get(category) ?? new Set<string>();
    // Only PRODUCER matches ever count as a match here — consumer mode
    // above decides whether `definition` owns/cares about this category at
    // all (so it appears in its own output), never whether a candidate
    // (including `definition` itself) counts as one of the matches. A
    // consumer-only card (Ajani's Pridemate: reacts to lifegain, produces
    // none) has no lifegain interaction of its own and must not appear in
    // its own "Lifegain" matches — the original "self-source" rule was
    // always conditioned on the card genuinely being a SOURCE/producer of
    // its own category, never unconditional self-inclusion.
    for (const candidate of poolDefinitions) {
      if (matchEntry(entry, candidate, root).producerMatched) {
        matchedNames.add(candidate.name);
      }
    }
    matchesByCategory.set(category, matchedNames);
  }

  return [...matchesByCategory.entries()]
    .map(([category, names]) => ({ category, count: names.size, matchingCardNames: [...names].sort() }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}
