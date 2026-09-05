import type { CardDefinition } from '../../card';

export const willowrushVerge: CardDefinition = {
  name: 'Willowrush Verge',
  manaCost: '',
  typeLine: 'Land',

  // Both mana abilities are documentary (no engine support). The second
  // ability's own "Activate only if you control a Forest or an Island"
  // condition is moot regardless — untestable either way.
  staticAbilities: ['{T}: Add {U}.', '{T}: Add {G}. Activate only if you control a Forest or an Island.'],
};
