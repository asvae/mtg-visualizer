import type { CardDefinition, Effect } from '../../card';

export const shinraReinforcements: CardDefinition = {
  name: 'Shinra Reinforcements',
  manaCost: '{2}{B}',
  typeLine: 'Creature — Human Soldier',

  pt: [2, 3],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        // Mill 3 — a real, unchosen batch move off the TOP of the library
        // (see state.ts's own `move` action: it slices from the front of
        // the zone array, real library-top order), which is exactly what
        // the untargeted `move` Effect already does; no separate `mill`
        // Effect kind exists (interfaces.ts's own `declare function mill`
        // is never wired into card.ts's Actions/Effect union at all).
        { kind: 'move', owner: 'you', from: 'Library', to: 'Graveyard', qty: 3 } satisfies Effect,
        { kind: 'gainLife', amount: 3 } satisfies Effect,
      ],
    },
  ],
};
