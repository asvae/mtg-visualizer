import type { CardDefinition, Effect } from '../../card';

export const makeYourMove: CardDefinition = {
  name: 'Make Your Move',
  manaCost: '{2}{W}',
  typeLine: 'Instant',

  missingSchemaFunctionality: [
    {
      clause: 'target artifact, enchantment, or creature with power 4 or greater',
      demand: '`destroy`\'s own `validType` (`\'permanent\'|\'creature\'|\'land\'`) is a single closed-enum pick, never an OR of several types, and its `minPower` field applies pool-wide once set — there is no way to gate power>=4 on ONLY the creature branch of a type disjunction while leaving the artifact/enchantment branches unconditional (`validType:\'permanent\'`+`minPower:4` would wrongly also exclude every artifact/enchantment target, which the real card never restricts by power at all).',
    },
  ],

  effects: [
    {
      kind: 'custom',
      describe:
        'destroy target artifact, enchantment, or creature with power 4 or greater (no Effect kind exists for disjunctive type-and-power-based target restrictions)',
      run: () => {},
    } satisfies Effect,
  ],
};
