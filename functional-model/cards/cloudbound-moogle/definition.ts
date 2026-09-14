import type { CardDefinition, Effect } from '../../card';

export const cloudboundMoogle: CardDefinition = {
  name: 'Cloudbound Moogle',
  manaCost: '{3}{W}{W}',
  typeLine: 'Creature — Moogle',

  keywords: ['Flying'],
  // Plainscycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) — now a
  // real, structured, engine-piloted activated ability (`abilities`, not
  // free text): a genuine 602.1 activation FROM HAND, cost = {2} + discard
  // this card itself (`engine.ts`'s `costRequiresDiscardSelf` — a REAL
  // Hand->Graveyard move, not merely trusted), resolving to a real library
  // search (`move` with `subtype:'Plains'`, `shuffleAfter:true`). Real
  // Forge citation: `res/cardsfolder/t/timeless_dragon.txt`'s own
  // `K:TypeCycling:Plains:2` -> `CardFactoryUtil.java` ~line 3733-3745.
  abilities: [
    {
      name: 'cycling',
      cost: '{2}, Discard this card',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, target: true, validType: 'land', subtype: 'Plains', shuffleAfter: true } satisfies Effect],
    },
  ],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, qty: 1 } satisfies Effect],
    },
  ],
};
