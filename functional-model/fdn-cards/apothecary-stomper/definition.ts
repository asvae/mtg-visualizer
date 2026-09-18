import type { CardDefinition, Effect } from '../../card';

export const apothecaryStomper: CardDefinition = {
  name: 'Apothecary Stomper',
  manaCost: '{4}{G}{G}',
  typeLine: 'Creature — Elephant',
  pt: [4, 4],
  keywords: ['Vigilance'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'modal',
          modes: [
            {
              describe: 'Put two +1/+1 counters on target creature you control.',
              effects: [
                { kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 2, owner: 'you', qty: 1 } satisfies Effect,
              ],
            },
            {
              describe: 'You gain 4 life.',
              effects: [{ kind: 'gainLife', amount: 4 } satisfies Effect],
            },
          ],
        } satisfies Effect,
      ],
    },
  ],
};
