import type { CardDefinition, Effect } from '../../card';

export const vampireGourmand: CardDefinition = {
  name: 'Vampire Gourmand',
  manaCost: '{1}{B}',
  typeLine: 'Creature — Vampire',
  pt: [2, 2],

  // Real Forge: `Mode$ Attacks | ValidCard$ Card.Self` — a real
  // self-attack auto-fire trigger. The sacrifice is a real COST
  // (`Cost$ Sac<1/Creature.Other/...>`) gating the draw+unblockable —
  // same "optional sacrifice, then the gated effect runs unconditionally"
  // pattern namazu-trader's own onAttack trigger already establishes (no
  // player-decision engine exists to model a DECLINED optional
  // sacrifice separately). "Can't be blocked this turn" is the real
  // `'Unblockable'` keyword grant (card.ts's own doc comment: approximated
  // via the same `grantKeywordSelf`/`hasKeyword` machinery a real keyword
  // grant already uses).
  triggers: [
    {
      name: 'onAttack',
      on: 'attacks',
      effects: [
        { kind: 'sacrifice', owner: 'you', validType: 'creature', notSelf: true, optional: true } satisfies Effect,
        { kind: 'drawCard', amount: 1 } satisfies Effect,
        { kind: 'grantKeywordSelf', keyword: 'Unblockable', untilEndOfTurn: true } satisfies Effect,
      ],
    },
  ],
};
