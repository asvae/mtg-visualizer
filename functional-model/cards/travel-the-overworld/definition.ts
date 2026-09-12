import type { CardDefinition, Effect } from '../../card';

export const travelTheOverworld: CardDefinition = {
  name: 'Travel the Overworld',
  manaCost: '{5}{U}{U}',
  typeLine: 'Sorcery',

  // Real Forge K:Affinity:Town — CLOSED (2026-09-12, ENGINE_GAPS.md gap #7):
  // a real, board-state-COUNTED cast-cost discount (CR 601.2f), same
  // underlying mechanism as Qiqirn Merchant's own activated-ability
  // discount (`ActivationCostReduction`), now generalized to a spell's own
  // cast cost via `card.ts`'s new `CostReduction.perControlled` —
  // `engine.ts`'s `effectiveCastCost` genuinely counts real Town-subtype
  // permanents `caster` controls and discounts the {5} generic portion
  // accordingly, replacing the old documentary-only `staticAbilities`
  // string, same "structured field replaces free text once real"
  // convention `continuousKeywordGrants`/`costReduction`'s other cards
  // already established.
  costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Town' } },

  effects: [{ kind: 'drawCard', amount: 4 } satisfies Effect],
};
