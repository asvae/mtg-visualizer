import type { CardDefinition, Effect } from '../../card';

export const joustThrough: CardDefinition = {
  name: 'Joust Through',
  manaCost: '{W}',
  typeLine: 'Instant',

  // Spell that targets attacking or blocking creature, deals 3 damage to it,
  // and you gain 1 life.
  // NOTE: The targeting restriction "attacking or blocking creature" is a
  // spell-level mechanic not currently expressed in the effects vocabulary.
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
