import type { CardDefinition, Effect } from '../../card';

export const archmageOfRunes: CardDefinition = {
  name: 'Archmage of Runes',
  manaCost: '{3}{U}{U}',
  typeLine: 'Creature — Giant Wizard',
  pt: [3, 6],

  // "Instant and sorcery spells you cast cost {1} less to cast."
  spellCostReductionGrants: [{ amount: 1, colors: [], cardTypes: ['Instant', 'Sorcery'] }],

  triggers: [
    {
      name: 'onInstantOrSorceryCast',
      on: 'castInstantOrSorcery',
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
