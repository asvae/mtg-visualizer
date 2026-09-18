import type { CardDefinition, Effect } from '../../card';

export const joustThrough: CardDefinition = {
  name: 'Joust Through',
  manaCost: '{W}',
  typeLine: 'Instant',

  missingSchemaFunctionality: [
    {
      clause: 'target attacking or blocking creature',
      demand: '`dealDamageTarget` (and every other targeted Effect) has no combat-role filter — only `owner`/`tapped` restrict the candidate pool today, never "is currently attacking or blocking" (508/509 combat-status), so this spell\'s real target restriction can\'t be narrowed at all.',
    },
  ],

  effects: [
    {
      kind: 'dealDamageTarget',
      amount: 3,
    } satisfies Effect,
    {
      kind: 'gainLife',
      amount: 1,
    } satisfies Effect,
  ],
};
