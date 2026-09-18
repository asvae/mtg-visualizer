import type { CardDefinition, Effect } from '../../card';

export const archmageOfRunes: CardDefinition = {
  name: 'Archmage of Runes',
  manaCost: '{3}{U}{U}',
  typeLine: 'Creature — Giant Wizard',
  pt: [3, 6],

  // Real Forge: S:Mode$ ReduceCost | ValidCard$ Instant,Sorcery | ...
  // "Instant and sorcery spells you cast cost {1} less to cast."
  // The SpellCostReductionGrant interface only supports color-gated reductions
  // (e.g. "White spells you cast cost {1} less"), not card-type-gated ones.
  // No cost-reduction field can express this gap — flagged in final report.

  triggers: [
    {
      name: 'onInstantOrSorceryCast',
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
