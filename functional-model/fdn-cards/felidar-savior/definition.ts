import type { CardDefinition, Effect } from '../../card';

export const felidarSavior: CardDefinition = {
  name: 'Felidar Savior',
  provenance: 'forge-json-compiler',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Cat Beast',
  pt: [2, 3],
  keywords: ['Lifelink'],
  triggers: [
    {
      name: 'onChangesZone',
      cause: {
        on: 'enter',
      },
      effects: [
        {
          kind: 'program',
          describe: 'put a +1/+1 counter on each of up to two other target creatures you control',
          program: {
            kind: 'selectUpTo',
            from: {
              kind: 'filter',
              input: {
                kind: 'query',
                source: 'creaturesInPlay',
                owner: 'you',
              },
              predicate: {
                field: 'excludeSelf',
              },
            },
            max: 2,
            as: 'target',
            then: [
              {
                kind: 'applyToBound',
                name: 'target',
                index: 0,
                action: {
                  action: 'putCounter',
                  counterType: '+1/+1',
                  amount: {
                    kind: 'literal',
                    value: 1,
                  },
                },
              },
              {
                kind: 'applyToBound',
                name: 'target',
                index: 1,
                action: {
                  action: 'putCounter',
                  counterType: '+1/+1',
                  amount: {
                    kind: 'literal',
                    value: 1,
                  },
                },
              },
            ],
          },
        } satisfies Effect,
      ],
    },
  ],
};
