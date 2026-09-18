import type { CardDefinition, Effect } from '../../card';
import { flashback } from '../../flashback';

export const revengeOfTheRats: CardDefinition = {
  name: 'Revenge of the Rats',
  manaCost: '{2}{B}{B}',
  typeLine: 'Sorcery',

  alternateCosts: [flashback('{2}{B}{B}')],

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
      // `Card` has no `.typeLine` (only `Player.getCardsIn`/`Card.isCreature()`).
      amount: (ctx) => ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature()).length,
      tapped: true,
    } satisfies Effect,
  ],
};
