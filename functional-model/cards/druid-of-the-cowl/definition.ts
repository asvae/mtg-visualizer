import type { CardDefinition } from '../../card';

export const druidOfTheCowl: CardDefinition = {
  name: 'Druid of the Cowl',
  manaCost: '{1}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [1, 3],

  // Real, structured `manaAbilities` entry (`Cost$ T | Produced$ G`,
  // `res/cardsfolder/d/druid_of_the_cowl.txt`) — same shape llanowar-elves
  // uses; both are creatures, so 302.6 summoning-sickness genuinely applies
  // (`engine.ts`'s `payableManaSources`).
  manaAbilities: [{ colors: ['G'] }],
};
