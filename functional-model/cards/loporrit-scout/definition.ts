import type { CardDefinition, Effect } from '../../card';

export const loporritScout: CardDefinition = {
  name: 'Loporrit Scout',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Rabbit Scout',

  pt: [3, 2],

  triggers: [
    {
      name: 'onOtherCreatureEnters',
      // Real "this creature gets +1/+1 UNTIL END OF TURN" — `untilEndOfTurn:
      // true` (2026-09-15, same real gap-closure as `choco-seeker-of-
      // paradise`/`ambrosia-whiteheart` — see that card's own comment for
      // the full "why").
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 1, untilEndOfTurn: true } satisfies Effect],
    },
  ],
};
