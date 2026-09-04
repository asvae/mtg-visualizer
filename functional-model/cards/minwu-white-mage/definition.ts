import type { CardDefinition, Effect } from '../../card';

export const minwuWhiteMage: CardDefinition = {
  name: 'Minwu, White Mage',
  manaCost: '{3}{W}{W}',
  typeLine: 'Legendary Creature — Human Cleric',

  pt: [3, 3],
  keywords: ['Vigilance', 'Lifelink'],

  triggers: [
    {
      name: 'onLifeGained',
      effects: [{ kind: 'putCounterAll', predicate: 'creatures-you-control', counterType: '+1/+1', amount: 1, subtype: 'Cleric' } satisfies Effect],
    },
  ],
};
