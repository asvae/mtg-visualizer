import type { CardDefinition, Effect } from '../../card';

// Real script (adventurers_inn.txt): a real nonbasic Land — Town.
// "When this land enters, you gain 2 life" is a real ETB trigger. The mana
// ability ("{T}: Add {C}") stays real text only — no mana-producing
// Effect/Action exists anywhere in this model (deliberate, no mana pool
// tracked).
export const adventurersInn: CardDefinition = {
  name: "Adventurer's Inn",
  manaCost: '',
  typeLine: 'Land — Town',

  staticAbilities: ['{T}: Add {C}.'],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'gainLife', amount: 2 } satisfies Effect],
    },
  ],
};
