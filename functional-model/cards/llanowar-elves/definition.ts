import type { CardDefinition } from '../../card';

export const llanowarElves: CardDefinition = {
  name: 'Llanowar Elves',
  manaCost: '{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [1, 1],

  // Real, structured `manaAbilities` entry (`Cost$ T | Produced$ G`,
  // `res/cardsfolder/l/llanowar_elves.txt`) — genuinely payable via
  // `mana.ts`'s `canAfford`/`payMana` (creature, so 302.6 summoning-sickness
  // applies, `engine.ts`'s `payableManaSources`).
  manaAbilities: [{ colors: ['G'] }],
};
