import type { CardDefinition } from '../../card';

export const absoluteVirtue: CardDefinition = {
  name: 'Absolute Virtue',
  manaCost: '{6}{W}{U}',
  typeLine: 'Legendary Creature — Avatar Warrior',

  pt: [8, 8],
  keywords: ['Flying'],

  staticAbilities: [
    "This spell can't be countered.",
    'You have protection from each of your opponents. (You can’t be dealt damage, enchanted, or targeted by anything controlled by your opponents.)',
  ],
};
