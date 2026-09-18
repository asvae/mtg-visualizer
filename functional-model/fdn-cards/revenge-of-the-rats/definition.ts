import type { CardDefinition, Effect } from '../../card';
import { flashback } from '../../flashback';

export const revengeOfTheRats: CardDefinition = {
  name: 'Revenge of the Rats',
  manaCost: '{2}{B}{B}',
  typeLine: 'Sorcery',

  alternateCosts: [flashback('{2}{B}{B}')],

  // "Create a tapped 1/1 black Rat creature token for each creature card
  // in your graveyard."
  effects: [
    {
      kind: 'createToken',
      token: {
        name: 'Rat',
        manaCost: '0',
        types: ['Creature', 'Rat'],
        basePower: 1,
        baseToughness: 1,
      },
      amount: (ctx) => ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature()).length,
      tapped: true,
    } satisfies Effect,
  ],
};
