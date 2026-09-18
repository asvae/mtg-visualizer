import type { CardDefinition, Effect } from '../../card';

export const divineResilience: CardDefinition = {
  name: 'Divine Resilience',
  manaCost: '{W}',
  typeLine: 'Instant',
  keywords: ['Kicker'],

  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Target creature you control gains indestructible until end of turn.',
          effects: [
            {
              kind: 'grantKeywordTarget',
              keyword: 'Indestructible',
              validType: 'creature',
              owner: 'you',
              untilEndOfTurn: true,
            } satisfies Effect,
          ],
        },
        {
          describe: 'If this spell was kicked, any number of target creatures you control gain indestructible until end of turn instead.',
          effects: [
            {
              kind: 'custom',
              describe: 'any number of target creatures you control gain indestructible until end of turn',
              run: (ctx) => {},
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
