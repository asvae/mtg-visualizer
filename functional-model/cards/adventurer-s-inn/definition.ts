import type { CardDefinition, Effect } from '../../card';

// Real script (adventurers_inn.txt): a real nonbasic Land — Town.
// "When this land enters, you gain 2 life" is a real ETB trigger. The mana
// ability ("{T}: Add {C}") is a real, structured `manaAbilities` entry
// (`Cost$ T | Produced$ C`, `res/cardsfolder/a/adventurers_inn.txt`) — no
// mana POOL is tracked anywhere in this model (`mana.ts`'s own header), but
// `canAfford`/`payMana` genuinely recognize this as a payable source.
export const adventurersInn: CardDefinition = {
  name: "Adventurer's Inn",
  manaCost: '',
  typeLine: 'Land — Town',

  manaAbilities: [{ colors: ['C'] }],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'gainLife', amount: 2 } satisfies Effect],
    },
  ],
};
