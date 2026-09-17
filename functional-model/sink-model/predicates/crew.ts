// Sink-derivation predicate #2: Crew cost activation path (702.121b/c).
//
// A direct function, not a data-driven declarative `Fact`-like object (per
// this task's own explicit constraint) — answers one specific question:
// "does crewing THIS card genuinely tap the creature(s) that pay its Crew
// cost, through the real engine path?" Verified against a real corpus in
// `crew.test.ts`, wired into `match-sink.ts`'s own occurrence derivation
// below via `crewTapOccurrences`.
//
// ## Why this needs a predicate at all (not just another `Effect`-walking case)
//
// `engine.ts`'s real Crew implementation (`canActivateAbility`/
// `activateAbility`, gated on `card.crewCost !== undefined`) taps every real
// `crewedBy: RealCard[]` creature the ACTIVATING PLAYER chooses at cast
// time — an arbitrary object never named anywhere in the Vehicle's own
// `CardDefinition`. No `Effect`/`Trigger` node on the Vehicle itself ever
// says "and this taps some other creature" — the existing hand-authored
// production recognizer for Crew (`crewCost-structural`) only ever emits a
// bare `{event:'crew', target:'self'}` tag ("this permanent HAS a crew
// cost"), never the actual tap consequence (confirmed directly against
// `cards/cargo-ship/synergy.json`'s own real fact). `sink-derivation-
// status.ts`'s own seeded `crew` entry names exactly this gap.
//
// ## The real, structural signal this predicate checks
//
// `engine.ts`'s `canActivateAbility` computes `activationCostFor(card,
// undefined)` FIRST — Crew's own convention never names an `abilityName`,
// so this is just `card.activationCost` — and rejects the WHOLE activation
// ("has no such activated ability") before its own `card.crewCost !==
// undefined` branch is ever reached, whenever that's falsy. So a Vehicle
// needs BOTH `crewCost` (the structured N) AND a non-empty `activationCost`
// (kept only as a descriptive label — see `card.ts`'s own `crewCost` doc
// comment) for a real tap to ever be possible. Once both are present,
// `activateAbility`'s own crew branch taps EVERY real `crewedBy` creature
// unconditionally (`for (const c of crewedBy!) engine.state.tap(c)`) —
// independent of `card.effects` (the `animate` resolution is a separate,
// later concern) — so this two-field check is exhaustive, not a heuristic:
// there is no third structural shape left to be unsure about.
//
// The Regalia (fin/58) is a real, currently-live negative case: `crewCost:
// 1` with NO `activationCost` at all (checked directly against its own
// `definition.ts`) — a real, live engine gap (not a hypothetical), verified
// against a real `canActivateAbility` rejection in `crew.test.ts`.
import type { CardDefinition } from '../../card';
import type { ProducerOccurrence } from '../match-sink';

export type CrewTapVerdict = 'produces-tap' | 'no-tap' | 'unknown';

export interface CrewTapResult {
  /** `false` when `card.crewCost` isn't declared at all — this predicate has
   * nothing to say about a non-Vehicle card. */
  applicable: boolean;
  verdict: CrewTapVerdict;
  via: string;
}

/**
 * Does crewing `card` genuinely tap the creature(s) that pay its Crew cost,
 * through the real engine path? See this module's own header for the full
 * reasoning; `crew.test.ts` for the real corpus this was verified against.
 */
export function crewTapResult(card: CardDefinition): CrewTapResult {
  if (card.crewCost === undefined) {
    return { applicable: false, verdict: 'unknown', via: 'no crewCost declared on this card at all' };
  }
  if (!card.activationCost) {
    return {
      applicable: true,
      verdict: 'no-tap',
      via:
        `crewCost is declared (${card.crewCost}) but activationCost is not — engine.ts's canActivateAbility ` +
        `computes activationCostFor(card, undefined) === card.activationCost FIRST (Crew's own convention of ` +
        `never naming an abilityName) and rejects with "has no such activated ability" before its own crewCost ` +
        `branch is ever reached, so no creature can ever be tapped through the real engine path for this card ` +
        `as currently defined (a real, live gap — see The Regalia, fin/58).`,
    };
  }
  return {
    applicable: true,
    verdict: 'produces-tap',
    via:
      `crewCost (${card.crewCost}) + a real activationCost together satisfy canActivateAbility's own crewCost ` +
      `branch; activateAbility's crew branch then unconditionally taps every real crewedBy creature ` +
      `("for (const c of crewedBy!) engine.state.tap(c)"), independent of card.effects.`,
  };
}

/**
 * The `ProducerOccurrence` this predicate contributes to `match-sink.ts`'s
 * own derivation — a real `tap` occurrence broadcasting to an arbitrary
 * creature the controller chooses (never a fixed subject — the real
 * `crewedBy` list is supplied by the activating player, not determined by
 * `card`'s own definition), precisely when `crewTapResult` verdicts
 * `'produces-tap'`. Empty for every other verdict — this predicate never
 * asserts an occurrence it isn't sure of.
 */
export function crewTapOccurrences(card: CardDefinition): ProducerOccurrence[] {
  const result = crewTapResult(card);
  if (result.verdict !== 'produces-tap') return [];
  return [
    {
      event: 'tap',
      controller: 'you',
      target: { types: { has: ['Creature'] } },
      via: `crew-cost-activation:${result.via}`,
    },
  ];
}
