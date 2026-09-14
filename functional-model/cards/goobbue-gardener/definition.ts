import type { CardDefinition } from '../../card';

// Real script (goobbue_gardener.txt): a single mana ability, `AB$ Mana |
// Cost$ T | Produced$ G` — a real, structured `manaAbilities` entry,
// genuinely payable via `mana.ts`'s `canAfford`/`payMana` (creature, so
// 302.6 summoning-sickness applies, `engine.ts`'s `payableManaSources`).
export const goobbueGardener: CardDefinition = {
  name: 'Goobbue Gardener',
  manaCost: '{1}{G}',
  typeLine: 'Creature — Plant Beast',

  pt: [1, 3],

  manaAbilities: [{ colors: ['G'] }],
};
