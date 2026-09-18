import type { CardDefinition, Effect } from '../../card';

export const highSocietyHunter: CardDefinition = {
  name: 'High-Society Hunter',
  manaCost: '{3}{B}{B}',
  typeLine: 'Creature — Vampire Noble',
  pt: [5, 3],

  keywords: ['Flying'],

  triggers: [
    {
      // Real Forge: `Mode$ Attacks | ValidCard$ Card.Self` — a real
      // self-attack auto-fire trigger. The sacrifice is a real COST on the
      // put-counter ability (`Cost$ Sac<1/Creature.Other/...>`) — same
      // "optional sacrifice, then the gated effect runs unconditionally"
      // pattern namazu-trader's own onAttack trigger already establishes
      // (no player-decision engine exists to model a DECLINED optional
      // sacrifice separately).
      name: 'onAttack',
      on: 'attacks',
      effects: [
        { kind: 'sacrifice', owner: 'you', validType: 'creature', notSelf: true, optional: true } satisfies Effect,
        { kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect,
      ],
    },
    {
      // Real Forge: `Mode$ ChangesZone | ValidCard$ Creature.!token+Other |
      // Origin$ Battlefield | Destination$ Graveyard` — "Whenever another
      // nontoken creature dies, draw a card." No `on` value exists for a
      // dies event; kept as a name-only trigger (same convention every
      // other not-yet-auto-fired trigger in this pool already uses).
      name: 'onCreatureDies',
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
