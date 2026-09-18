import type { CardDefinition, Effect } from '../../card';

export const sylvanScavenging: CardDefinition = {
  name: 'Sylvan Scavenging',
  manaCost: '{1}{G}{G}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onEndStep',
      on: 'endStep',
      effects: [
        {
          kind: 'modal',
          modes: [
            {
              describe: 'Put a +1/+1 counter on target creature you control.',
              effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, owner: 'you', qty: 1 } satisfies Effect],
            },
            {
              describe: 'Create a 3/3 green Raccoon creature token if you control a creature with power 4 or greater.',
              effects: [
                {
                  kind: 'createToken',
                  token: { name: 'Raccoon', manaCost: '0', types: ['Creature', 'Raccoon'], basePower: 3, baseToughness: 3 },
                  amount: 1,
                } satisfies Effect,
              ],
            },
          ],
        } satisfies Effect,
      ],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: 'Create a 3/3 green Raccoon creature token if you control a creature with power 4 or greater.',
      demand:
        'No Query/Filter/Aggregate predicate tests an individual creature\'s own POWER (only `subtype`/`cardType`/`excludeSelf`/`sameNameAsSelf`) — needs a power-threshold existence-check predicate to gate this mode\'s token creation for real instead of the current unconditional approximation.',
    },
  ],
};
