import type { CardDefinition, Effect } from '../../card';

// Real script (magic_damper.txt): `ValidTgts$ Creature.YouCtrl` for the
// pump/hexproof half, `Defined$ Targeted` (the SAME object) for the untap —
// all three now buildable declaratively: `pumpTarget`/`grantKeywordTarget`/
// `untapTarget` all gained an `owner` field today, and Untap now has its own
// Effect kind at all (`untapTarget`, new today). Nothing ties the three
// separate declarative picks to literally the same object, but all three
// pools are identical (creatures YOU control, nothing moves zones in
// between), so `chooseTarget`'s own deterministic first-pool-candidate rule
// lands on the same creature every time.
export const magicDamper: CardDefinition = {
  name: 'Magic Damper',
  manaCost: '{U}',
  typeLine: 'Instant',

  effects: [
    { kind: 'pumpTarget', power: 1, toughness: 1, owner: 'you' } satisfies Effect,
    { kind: 'grantKeywordTarget', keyword: 'Hexproof', validType: 'creature', owner: 'you' } satisfies Effect,
    { kind: 'untapTarget', validType: 'creature', owner: 'you' } satisfies Effect,
  ],
};
