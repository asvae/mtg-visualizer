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
    // no owner restriction. `owner` omitted (fixed 2026-09-06, see card.ts's
    // own `move` case) means the real combined, unrestricted pool.
    // `nonLand: true` — real printed text excludes lands; previously
    // missing (a real, separate bug — `validType: 'any'` alone let a land
    // through), fixed alongside the owner gap since it's the same effect.
    { kind: 'move', from: 'Battlefield', to: 'Hand', qty: 1, validType: 'any', nonLand: true, target: true } satisfies Effect,
    { kind: 'drawCard' } satisfies Effect,
  ],
};
