import type { CardDefinition, Effect } from '../../card';

export const eject: CardDefinition = {
  name: 'Eject',
  manaCost: '{3}{U}',
  typeLine: 'Instant',

  // Real R:Event$ Counter | ValidCard$ Card.Self | ValidSA$ Spell | Layer$
  // CantHappen — a replacement rule ("this spell can't be countered"), not
  // a resolvable effect; recorded as static text only, same convention
  // fate-of-the-sun-cryst's own cost-reduction rule already uses for an
  // Instant.
  staticAbilities: ["This spell can't be countered."],

  effects: [
    // Real ValidTgts$ Permanent.nonLand — ANY player's nonland permanent,
    // no owner restriction. This model's `move` effect (target:true
    // branch) only pools ONE player's own zone per `playersFor` iteration
    // — no combined cross-player pool the way `destroy`'s own
    // battlefield-wide pool already is — so there's no way to express
    // "target any player's permanent" exactly. `owner: 'opponents'` stands
    // in for the representative/common case (bouncing an opponent's
    // permanent); flagged as a general batch gap (a targeted `move` with a
    // combined pool, mirroring `destroy`, would remove this
    // approximation).
    { kind: 'move', owner: 'opponents', from: 'Battlefield', to: 'Hand', qty: 1, validType: 'any', target: true } satisfies Effect,
    { kind: 'drawCard' } satisfies Effect,
  ],
};
