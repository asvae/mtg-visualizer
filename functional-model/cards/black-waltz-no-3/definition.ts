import type { CardDefinition, Effect } from '../../card';

export const blackWaltzNo3: CardDefinition = {
  name: 'Black Waltz No. 3',
  manaCost: '{2}{B}{R}',
  typeLine: 'Legendary Creature — Wizard',

  pt: [2, 2],
  keywords: ['Flying', 'Deathtouch'],

  triggers: [
    {
      name: 'onNoncreatureSpellCast',
      effects: [{ kind: 'dealDamage', target: 'opponents', amount: 2 } satisfies Effect],
    },
  ],
};
