import type { CardDefinition, Effect } from '../../card';

export const jumboCactuar: CardDefinition = {
  name: 'Jumbo Cactuar',
  manaCost: '{5}{G}{G}',
  typeLine: 'Creature — Plant',

  pt: [1, 7],

  triggers: [
    {
      name: 'onAttack',
      // Real "it gets +9999/+0 UNTIL END OF TURN" — `untilEndOfTurn: true`
      // (2026-09-15, same real gap-closure as `choco-seeker-of-paradise`/
      // `ambrosia-whiteheart` — see that card's own comment for the full
      // "why").
      effects: [{ kind: 'pumpSelf', power: 9999, toughness: 0, untilEndOfTurn: true } satisfies Effect],
    },
  ],
};
