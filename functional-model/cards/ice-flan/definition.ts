import type { CardDefinition, Effect } from '../../card';

// Real script (ice_flan.txt): `ValidTgts$ Artifact.OppCtrl,Creature.OppCtrl`
// — genuinely controller-restricted ("target artifact or creature an
// OPPONENT controls"), unlike Coeurl/Dion's own real "any target" text (see
// those two cards' own comments) — this is exactly the real bug case
// `tapTarget`/`putCounterTarget`'s new `owner` field exists to fix.
export const iceFlan: CardDefinition = {
  name: 'Ice Flan',
  manaCost: '{4}{U}{U}',
  typeLine: 'Creature — Elemental Ooze',

  pt: [5, 4],

  // Islandcycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) — see
  // cloudbound-moogle/definition.ts's own comment for the full real,
  // structured mechanism (`abilities`, `engine.ts`'s `costRequiresDiscardSelf`,
  // `move`'s `subtype`/`shuffleAfter`); same shape, searching for an Island
  // instead of a Plains.
  abilities: [
    {
      name: 'cycling',
      cost: '{2}, Discard this card',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, target: true, validType: 'land', subtype: 'Island', shuffleAfter: true } satisfies Effect],
    },
  ],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        // "tap target artifact or creature an opponent controls" — no
        // `tapTarget` validType covers the DISJUNCTION "artifact or
        // creature" in one pool (only `sacrifice`'s own validType union has
        // a `'creature-or-artifact'` option; `tapTarget`/`putCounterTarget`
        // don't). Narrowed to `'creature'` (Ice Flan's overwhelmingly
        // common real target) as the closest existing fit — flagged as a
        // real gap in this batch's own final report, not invented around.
        { kind: 'tapTarget', validType: 'creature', owner: 'opponents' } satisfies Effect,
        // "Put a stun counter on it" (`Defined$ Targeted` — the SAME object
        // just tapped). Nothing ties two separate declarative effects to
        // one shared chosen target, but both pools here are identical
        // (opponents' creatures, nothing moves zones in between), so
        // `chooseTarget`'s own deterministic first-pool-candidate rule
        // lands on the same creature both times — same reasoning
        // summon-shiva/ultros-obnoxious-octopus's own (now-obsolete)
        // `custom` workarounds used before `owner` existed on these kinds.
        { kind: 'putCounterTarget', validType: 'creature', counterType: 'stun', amount: 1, owner: 'opponents' } satisfies Effect,
      ],
    },
  ],
};
