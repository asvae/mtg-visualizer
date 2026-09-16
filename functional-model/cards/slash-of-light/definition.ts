import type { CardDefinition, Effect } from '../../card';
import { add, anyPlayer, applyToBound, dealDamageEach, selectUpTo, you } from '../../combinator';

// Real Forge (`res/cardsfolder/s/slash_of_light.txt`): `SVar:X:Count$Valid
// Creature.YouCtrl/Plus.Y` / `SVar:Y:Count$Valid Equipment.YouCtrl` — a
// literal SUM of two independent counts (creatures you control PLUS
// Equipment you control), not a single unioned-pool count; confirmed
// against the real script (a permanent that's both a creature AND an
// Equipment would double-count under this real, literal semantics,
// matching Forge's own). `ValidTgts$ Creature` carries no owner
// restriction, so the damaged creature can be any player's.
// MIGRATED (2026-09-16, engine-core's own `AddValue`/`dealDamageEach`
// combinator additions built specifically for this card) off the prior
// `Computed<number>` closure on `dealDamageTarget` onto the combinator DSL:
// the closure was already opaque to synergy matching, and `AddValue`'s own
// two-count-sum shape now expresses the same real logic as inspectable
// data instead.
export const slashOfLight: CardDefinition = {
  name: 'Slash of Light',
  manaCost: '{1}{W}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'program',
      describe: 'deals damage equal to the number of creatures you control plus the number of Equipment you control to target creature',
      program: selectUpTo(anyPlayer.creaturesInPlay(), 1, 'target', [
        applyToBound('target', 0, dealDamageEach(add(you.creaturesInPlay().count(), you.permanentsInPlay().filter('subtype', 'Equipment').count()))),
      ]),
    } satisfies Effect,
  ],
};
