import type { CardDefinition, Effect } from '../../card';

export const ashePrincessOfDalmasca: CardDefinition = {
  name: 'Ashe, Princess of Dalmasca',
  manaCost: '{2}{W}',
  typeLine: 'Legendary Creature — Human Rebel Noble',

  triggers: [
    {
      name: 'onAttack',
      effects: [{ kind: 'dig', qty: 5, take: 1, validType: 'artifact', optional: true } satisfies Effect],
      // PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, scoped trial) — whole
      // trigger-condition + effect clause together (this is the entire
      // oracle text, one paragraph, no separate lines to split).
      annotation: {
        highlight:
          'Whenever Ashe attacks, look at the top five cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.',
        line: 0,
      },
    },
  ],
};
