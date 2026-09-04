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

  // Islandcycling {2} (discard this card from hand: search your library for
  // an Island) isn't modeled — same real gap malboro's own Swampcycling
  // comment documents: a special action FROM HAND, not a cast/activated/
  // triggered ability, no CardDefinition field fits it.
  staticAbilities: ['Islandcycling {2} ({2}, Discard this card: Search your library for an Island card, reveal it, put it into your hand, then shuffle.)'],

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
