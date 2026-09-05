import type { CardDefinition } from '../../card';

export const overgrownZealot: CardDefinition = {
  name: 'Overgrown Zealot',
  manaCost: '{1}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [0, 4],

  // Both abilities are plain mana abilities — no engine support (same gap
  // llanowar-elves/druid-of-the-cowl hit). The second ability's own
  // "Spend this mana only to turn permanents face up" restriction is moot
  // here regardless (no morph/face-down mechanic modeled anywhere either).
  staticAbilities: ['{T}: Add one mana of any color.', '{T}: Add two mana of any one color. Spend this mana only to turn permanents face up.'],
};
