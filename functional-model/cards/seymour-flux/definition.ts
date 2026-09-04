import type { CardDefinition, Effect } from '../../card';

// Real script (seymour_flux.txt): "you may pay 1 life. If you do, draw a
// card and put a +1/+1 counter on CARDNAME" — the "may"/"if you do" pair is
// documentary only (no legal-but-declined engine exists — see card.ts's own
// doc comment on `move`/`sacrifice`'s own `optional` field for the same
// convention dark-knight-s-greatsword's own life-payment cost already
// uses): the payment and its consequence always both happen.
export const seymourFlux: CardDefinition = {
  name: 'Seymour Flux',
  manaCost: '{4}{B}',
  typeLine: 'Legendary Creature — Spirit Avatar',

  pt: [5, 5],

  triggers: [
    {
      name: 'onUpkeep',
      effects: [
        { kind: 'loseLife', owner: 'you', amount: 1 } satisfies Effect,
        { kind: 'drawCard' } satisfies Effect,
        { kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect,
      ],
    },
  ],
};
