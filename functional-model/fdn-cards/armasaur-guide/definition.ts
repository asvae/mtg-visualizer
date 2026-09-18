import type { CardDefinition, Effect } from '../../card';

export const armasaurGuide: CardDefinition = {
  name: 'Armasaur Guide',
  manaCost: '{4}{W}',
  typeLine: 'Creature — Dinosaur',
  pt: [4, 4],
  keywords: ['Vigilance'],

  // Whenever you attack with three or more creatures, put a +1/+1 counter on target creature you control.
  // Note: Trigger condition "when you attack with 3+ creatures" requires an unbuilt trigger type
  // (no 'attackersDeclared' or count-conditional `on` value exists yet — see ENGINE_GAPS.md).
  // Modeled as a named trigger for manual scenario invocation until that gap closes.
  triggers: [
    {
      name: 'onMassAttack',
      effects: [
        {
          kind: 'putCounterTarget',
          validType: 'creature',
          counterType: '+1/+1',
          amount: 1,
          owner: 'you',
        } satisfies Effect,
      ],
    },
  ],
};
