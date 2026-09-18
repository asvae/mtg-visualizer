import type { CardDefinition, Effect } from '../../card';

export const beastKinRanger: CardDefinition = {
  name: 'Beast-Kin Ranger',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Elf Ranger',
  pt: [3, 3],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onOtherCreatureEnters',
      on: 'otherPermanentEnters',
      otherPermanentEntersMatch: { sameController: true },
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 0, untilEndOfTurn: true } satisfies Effect],
    },
  ],
};
