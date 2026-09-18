import type { CardDefinition, Effect } from '../../card';

export const makeYourMove: CardDefinition = {
  name: 'Make Your Move',
  manaCost: '{2}{W}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'custom',
      describe:
        'destroy target artifact, enchantment, or creature with power 4 or greater (no Effect kind exists for disjunctive type-and-power-based target restrictions)',
      run: () => {},
    } satisfies Effect,
  ],
};
