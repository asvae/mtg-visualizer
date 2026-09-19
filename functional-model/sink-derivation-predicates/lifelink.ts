// Sink-derivation predicate #5: Lifelink automatic lifegain (702.15e).
//
// A direct function, not a data-driven declarative `Fact`-like object (per
// this task's own explicit constraint) — answers one specific question:
// "does dealing damage with THIS card genuinely cause its controller to gain
// life, through the real engine path?" Verified against a real corpus in
// `lifelink.test.ts`, wired into `match-sink.ts`'s own occurrence derivation
// below via `lifelinkProductionOccurrences`.
//
// ## Why this needs a predicate at all (not just another `Effect`-walking case)
//
// Lifelink is a real, structurally-present `Keyword` (`card.ts`'s own closed
// `Keyword` union already has `'Lifelink'`) — but the lifegain it produces
// has NO corresponding `Effect` node anywhere on the card's own
// `definition.ts`. `state.ts`'s own `dealDamage` (real Forge citation,
// `GameAction.java` ~line 2732-2735, 702.15e) checks `effectiveKeywords(this,
// source).includes('Lifelink')` directly and calls `this.gainLife(...)`
// itself, entirely independent of whichever `Effect.kind` actually dealt the
// damage (`dealDamage`/`dealDamageTarget`/`dealDamageAnyTarget`, a
// `program`-AST `dealDamage` action, or ordinary COMBAT damage with no
// `Effect` involved at all). `matcher-model/match-query.ts`'s own header already
// flagged this exact gap ("Healer's Hawk's Lifelink is a KEYWORD, not an
// Effect, and `deriveOccurrences` deliberately doesn't walk `keywords`") —
// the real motivating card that forced closing it is Felidar Savior (FDN
// #12): a Lifelink creature with NO OTHER lifegain-shaped effect anywhere on
// its own definition, so without this predicate `deriveOccurrences` has
// nothing at all to say about it as a Lifegain producer.
//
// ## The real, structural signal this predicate checks
//
// A bare field read — `card.keywords?.includes('Lifelink')` — checked
// independently per face (front `card.keywords`, back `card.backFace
// .keywords`), since a transforming DFC's two faces are two genuinely
// independent `CardDefinition`s that could each print (or not print)
// Lifelink on their own. No conditional/derived case exists (unlike Saga's
// own chapter-effect walk or Crew's own activation-cost gate) — printing the
// keyword IS the whole real-world condition 702.15e checks, so this
// predicate has a deterministic, always-decisive verdict for every real
// `CardDefinition` (`applicable` is always `true` — see `LifelinkProduction
// Result.applicable`'s own doc comment for why this differs from Saga's/
// Crew's own narrower "doesn't apply to a non-Saga/non-Vehicle card at all"
// case).
import type { CardDefinition } from '../card';
import type { ProducerOccurrence } from '../matcher-model/match-query';

export type LifelinkProductionVerdict = 'produces-lifegain' | 'no-lifegain';

export interface LifelinkProductionResult {
  /** Always `true` — unlike Saga/Crew (gated on a card's own typeLine/
   * crewCost), this predicate's underlying question ("does this face print
   * Lifelink?") is meaningful and decisively answerable for every real
   * `CardDefinition`, permanent or not. Kept for interface-shape consistency
   * with `SagaChapterCompletionResult`/`CrewTapResult` (both real, distinct
   * "does this predicate have anything to say about this card" fields). */
  applicable: true;
  verdict: LifelinkProductionVerdict;
  /** Human-readable justification — which face decided the verdict, for
   * debuggability (same "always present, always human-readable" convention
   * `ProducerOccurrence.via` already establishes). */
  via: string;
}

/**
 * Does dealing damage with `card` (either real face) genuinely cause its
 * controller to gain life, through the real engine path (`state.ts`'s
 * `dealDamage`, 702.15e)? See this module's own header for the full
 * reasoning; `lifelink.test.ts` for the real corpus this was verified
 * against.
 */
export function lifelinkProductionResult(card: CardDefinition): LifelinkProductionResult {
  if (card.keywords?.includes('Lifelink')) {
    return { applicable: true, verdict: 'produces-lifegain', via: "front face prints Lifelink — state.ts's dealDamage grants its controller life on every damage instance dealt by this card (702.15e)" };
  }
  if (card.backFace?.keywords?.includes('Lifelink')) {
    return { applicable: true, verdict: 'produces-lifegain', via: "back face prints Lifelink — state.ts's dealDamage grants its controller life on every damage instance dealt by this card (702.15e)" };
  }
  return { applicable: true, verdict: 'no-lifegain', via: 'neither face prints Lifelink' };
}

/**
 * The `ProducerOccurrence` this predicate contributes to `match-sink.ts`'s
 * own derivation — the SAME `{event:'lifegain', controller:'you'}` shape
 * `walkEffects`'s own `case 'gainLife'` already produces for a real, direct
 * `gainLife` Effect (so this predicate's occurrence is indistinguishable, to
 * any consuming sink query, from a card whose lifegain IS spelled out as an
 * Effect) — precisely when `lifelinkProductionResult` verdicts
 * `'produces-lifegain'`. Empty for `'no-lifegain'` — this predicate never
 * asserts an occurrence it isn't sure of.
 */
export function lifelinkProductionOccurrences(card: CardDefinition): ProducerOccurrence[] {
  const result = lifelinkProductionResult(card);
  if (result.verdict !== 'produces-lifegain') return [];
  return [{ event: 'lifegain', controller: 'you', via: `lifelink-keyword:${result.via}` }];
}
