import type { CardDefinition, Effect } from '../../card';
import { basicLandcycling } from '../../cycling';

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
  //
  // `target: true` REMOVED (2026-09-15, real bug fix, `recognizers/
  // moveSearchLibrary-effect-structural.ts`'s own pool run surfaced it):
  // real Landcycling (701.19/CR 118.9) is a SEARCH of a hidden zone, never
  // a CR 601.2c targeted action — `target: true` was only ever set here
  // because `move`'s own `subtype` field used to be read ONLY on the
  // targeted branch (`card.ts`'s own now-superseded doc comment), the sole
  // way to get subtype-filtering into this effect at authoring time. Now
  // that `subtype` is read on the untargeted branch too (2026-09-15, Cloud
  // Midgar Mercenary's own tutor-Equipment fix), this workaround is no
  // longer needed — reverted to the CR-correct untargeted shape (real
  // runtime outcome is unaffected: both branches source from `effect.from`,
  // `'Library'` either way; only the trace's own log-entry shape changes,
  // `fn:'move'` instead of a per-card `fn:'moveTo'` — `trace.json`
  // regenerated to match via `run-scenarios.mjs`).
  //
  // Retrofitted onto `cycling.ts`'s own shared `basicLandcycling` factory
  // (2026-09-15) — pure refactor, byte-identical `abilities[0]` output to
  // the raw literal this used to be (see that module's own doc comment for
  // the real, whole-pool check confirming every basic-landcycling card
  // shares this exact shape, differing only in mana cost/subtype).
  abilities: [basicLandcycling('Plains', '{2}')],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, qty: 1 } satisfies Effect],
    },
  ],
};
