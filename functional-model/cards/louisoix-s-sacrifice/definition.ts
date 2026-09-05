import type { CardDefinition, Effect } from '../../card';

// "Sacrifice a legendary creature OR pay {2}" (a mandatory additional cost,
// not an optional Kicker) maps onto the same `modal`/`ctx.mode` shape
// fire-magic's own "Tiered" and vayne-s-treachery's own Kicker already use
// for "choose one fixed branch, selected once per resolution" — each mode's
// own additional-cost payment lives in that mode's own effects, same
// precedent. `sacrifice`'s own `validType` vocabulary has no "legendary"
// filter (only creature/artifact/enchantment/token-or-not) — approximated
// as `validType: 'creature'`, same "no exact subtype filter, nearest
// available, document the gap" trade-off destroy's own `nonLand` (not
// "artifact"-specific) already accepts elsewhere.
const counterEffect: Effect = {
  kind: 'counter',
  describe: 'Counter target activated ability, triggered ability, or noncreature spell.',
};

export const louisoixsSacrifice: CardDefinition = {
  name: "Louisoix's Sacrifice",
  manaCost: '{U}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Sacrifice a legendary creature (additional cost) — counter target activated ability, triggered ability, or noncreature spell.',
          effects: [{ kind: 'sacrifice', owner: 'you', validType: 'creature', qty: 1 } satisfies Effect, counterEffect],
        },
        {
          describe: 'Pay {2} (additional cost) instead — counter target activated ability, triggered ability, or noncreature spell.',
          effects: [counterEffect],
        },
      ],
    } satisfies Effect,
  ],
};
