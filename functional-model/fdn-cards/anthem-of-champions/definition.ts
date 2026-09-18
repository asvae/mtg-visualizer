import type { CardDefinition } from '../../card';

export const anthemOfChampions: CardDefinition = {
  name: 'Anthem of Champions',
  manaCost: '{G}{W}',
  typeLine: 'Enchantment',

  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false }],
};
