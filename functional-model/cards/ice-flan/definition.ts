import type { CardDefinition, Effect } from '../../card';
import { basicLandcycling } from '../../cycling';

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
  // instead of a Plains. `target: true` removed 2026-09-15, same real bug
  // fix as that card — see its own comment for the full reasoning.
  //
  // Retrofitted onto `cycling.ts`'s own shared `basicLandcycling` factory
  // (2026-09-15, pure refactor — see that module's own doc comment).
  abilities: [basicLandcycling('Island', '{2}')],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        // "tap target artifact or creature an opponent controls" — real,
        // pre-existing bug fixed 2026-09-15 (`recognizers/tapTarget-
        // effect-structural.ts`'s own pool run surfaced it as a hard
        // `kind:'mismatch'`): the comment this replaces claimed `tapTarget`
        // had no `'creature-or-artifact'` validType option at all, but it
        // does (`card.ts`'s own `TapTarget` union, likely added after this
        // comment was first written) — `validType:'creature'` was silently
        // narrower than the real "artifact or creature" disjunction this
        // whole time. Corrected to the real, precise value.
        { kind: 'tapTarget', validType: 'creature-or-artifact', owner: 'opponents' } satisfies Effect,
        // "Put a stun counter on it" (`Defined$ Targeted` — the SAME object
        // just tapped). Nothing ties two separate declarative effects to
        // one shared chosen target, so BOTH pools must stay identical
        // (opponents' artifacts-or-creatures, nothing moves zones in
        // between) for `chooseTarget`'s own deterministic first-pool-
        // candidate rule to actually land on the same object both times —
        // `validType` corrected to `'creature-or-artifact'` alongside the
        // `tapTarget` effect above (2026-09-15 fix): the two pools had
        // silently DIVERGED (this one creature-only, the other now
        // artifact-or-creature), a real functional bug whenever the tapped
        // object happened to be an artifact, not just a documentation
        // mismatch.
        { kind: 'putCounterTarget', validType: 'creature-or-artifact', counterType: 'stun', amount: 1, owner: 'opponents' } satisfies Effect,
      ],
    },
  ],
};
