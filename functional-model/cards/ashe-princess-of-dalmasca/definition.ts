import type { CardDefinition, Effect } from '../../card';

export const ashePrincessOfDalmasca: CardDefinition = {
  name: 'Ashe, Princess of Dalmasca',
  manaCost: '{2}{W}',
  typeLine: 'Legendary Creature — Human Rebel Noble',

  triggers: [
    {
      name: 'onAttack',
      effects: [{ kind: 'dig', qty: 5, take: 1, validType: 'artifact', optional: true } satisfies Effect],
    },
  ],
};
