import type { CardDefinition, Effect } from '../../card';

export const fateOfTheSunCryst: CardDefinition = {
  name: 'Fate of the Sun-Cryst',
  manaCost: '{4}{W}',
  typeLine: 'Instant',

  // Real Forge citation, res/cardsfolder/f/fate_of_the_sun_cryst.txt:
  // `S:Mode$ ReduceCost | ValidCard$ Card.Self | Type$ Spell | Amount$ 2 |
  // EffectZone$ All | ValidTarget$ Creature.tapped` — a genuine CR 601.2f
  // dynamic cost reduction keyed on THIS spell's own chosen target's tapped
  // state at cast time. Real, executable engine vocabulary now exists for
  // this shape (`card.ts`'s `CostReduction`, ENGINE_GAPS.md gap #7, closed
  // for the target-conditional case): `engine.ts`'s `canCastSpell`/
  // `castSpell` take an optional caller-supplied `declaredTarget` and
  // genuinely discount the generic portion of `manaCost` when it's tapped
  // — see this card's own `scenarios.ts` for both real branches (discounted
  // vs. not) actually exercised through the real engine pilot.
  costReduction: { amount: 2, condition: 'tappedCreatureTarget' },

  effects: [{ kind: 'destroy', validType: 'permanent', nonLand: true, qty: 1 } satisfies Effect],
};
