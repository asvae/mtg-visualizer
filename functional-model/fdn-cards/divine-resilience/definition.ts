import type { CardDefinition, Effect } from '../../card';

export const divineResilience: CardDefinition = {
  name: 'Divine Resilience',
  manaCost: '{W}',
  typeLine: 'Instant',
  keywords: ['Kicker'],
  keywordCosts: [{ keyword: 'Kicker', cost: '{2}{W}' }],

  missingSchemaFunctionality: [
    {
      clause: 'any number of target creatures you control gain indestructible until end of turn instead',
      demand:
        'No "choose any number of targets" primitive exists — every existing targeted-effect shape (`grantKeywordTarget`, `selectUpTo`) either targets exactly one chosen target or up to a fixed, declared maximum; an unbounded, player-chosen-at-cast-time target count (601.2c "any number") has no declarative shape.',
    },
  ],

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
              describe: 'any number of target creatures you control gain indestructible until end of turn (see missingSchemaFunctionality[0])',
              run: (ctx) => {},
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
