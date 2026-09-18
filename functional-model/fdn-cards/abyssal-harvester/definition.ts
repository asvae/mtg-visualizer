import type { CardDefinition } from '../../card';

export const abyssalHarvester: CardDefinition = {
  name: 'Abyssal Harvester',
  manaCost: '{1}{B}{B}',
  typeLine: 'Creature — Demon Warlock',
  pt: [3, 2],
  activationCost: '{T}',
  effects: [
    {
      kind: 'custom',
      describe: 'Exile target creature card from a graveyard that was put there this turn. Create a token that\'s a copy of it, except it\'s a Nightmare in addition to its other types. Then exile all other Nightmare tokens you control.',
      run: () => {
        // NOTE: This complex ability requires:
        // 1. Targeting a creature card in graveyard that was put there this turn
        // 2. Creating a copy with a modified type
        // 3. Exiling other tokens conditionally
        // This is not yet modeled in the available vocabulary.
      },
    },
  ],
};
