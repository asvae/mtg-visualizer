import type { CardDefinition, Effect } from '../../card';
import { anyPlayer, applyToBound, branch, compare, pumpEach, selectUpTo, you } from '../../combinator';

// Real Forge (`res/cardsfolder/y/youre_not_alone.txt`): `SVar:X:Count$Compare
// Y GE3.4.2` / `SVar:Y:Count$Valid Creature.YouCtrl` — a genuine threshold
// dispatch (3+ creatures you control → +4/+4, otherwise +2/+2), not a
// smoothly-scaling formula. `ValidTgts$ Creature` carries no owner
// restriction, so the pumped creature can be any player's.
// MIGRATED (2026-09-16, per the standing combinator-DSL-over-`custom`/
// `Computed` closure preference) off the prior `Computed<number>` closure
// on `pumpTarget` onto `Branch`+`compare` dispatching between two
// `pumpEach` calls — no new combinator vocabulary needed for this shape.
export const youreNotAlone: CardDefinition = {
  name: "You're Not Alone",
  manaCost: '{W}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'program',
      describe: 'target creature gets +2/+2 until end of turn. If you control three or more creatures, it gets +4/+4 until end of turn instead',
      program: selectUpTo(anyPlayer.creaturesInPlay(), 1, 'target', [
        branch(
          compare(you.creaturesInPlay().count(), '>=', 3),
          [applyToBound('target', 0, pumpEach(4, 4, true))],
          [applyToBound('target', 0, pumpEach(2, 2, true))]
        ),
      ]),
    } satisfies Effect,
  ],
};
