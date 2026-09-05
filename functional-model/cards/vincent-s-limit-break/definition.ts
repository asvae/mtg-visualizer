import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script: `A:SP$ Charm | Cost$ 1 B | Tiered$ True | Choices$
// DBGalianBeast,DBDeathGigas,DBHellmasker` — same "choose one, each with its
// own additional Tiered cost" shape tifa-s-limit-break already establishes;
// see that file's own header for why `modal` is the right fit and why the
// per-mode additional cost ({0}/{1}/{3}) has no field to live in (folded
// into each mode's own `describe` as documentary text).
//
// Each mode sets an ABSOLUTE base power/toughness (Galian Beast 3/2, Death
// Gigas 5/2, Hellmasker 7/2) — no declarative Effect kind sets an absolute
// P/T (only `pumpTarget`'s relative delta), so same `custom` + real
// getNetPower/getNetToughness delta-to-target translation ride-the-shoopuf's
// own "becomes a 7/7" effect already uses, just against a CHOSEN target
// (tifa-s-limit-break's own Meteor Strikes/Final Heaven) instead of `self`.
// Real text restricts the target to "target creature YOU control" —
// narrower than Tifa's own unrestricted "target creature" pool.
//
// The granted "When this creature dies, return it to the battlefield tapped
// under its owner's control" is a NEW triggered ability granted at
// resolution time — no Effect kind exists anywhere in this model for that
// (`triggers` is a fixed, static list on `CardDefinition`, not something an
// effect can append to at runtime) — same documented gap galuf-s-final-act's
// own granted death-trigger already establishes. No-op custom purely so
// synergyTags()/a human reading this file still sees the real text.
function setBasePT(power: number, toughness: number): Effect {
  return {
    kind: 'custom',
    describe: `target creature you control has base power and toughness ${power}/${toughness} until end of turn`,
    run: (ctx: EffectContext, actions: Actions) => {
      const pool = ctx.you.getCreaturesInPlay();
      if (pool.length === 0) return;
      const target = actions.chooseTarget(pool);
      actions.pump(target, power - target.getNetPower(), toughness - target.getNetToughness());
    },
  } satisfies Effect;
}
const grantsDiesReturn: Effect = {
  kind: 'custom',
  describe: 'target creature you control also gains "when this creature dies, return it to the battlefield tapped under its owner\'s control" until end of turn (no Effect kind exists for granting a new triggered ability)',
  run: () => {},
} satisfies Effect;

export const vincentsLimitBreak: CardDefinition = {
  name: "Vincent's Limit Break",
  manaCost: '{1}{B}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Galian Beast (+{0} cost) — target creature you control has base power/toughness 3/2 until end of turn and gains a death-return trigger',
          effects: [setBasePT(3, 2), grantsDiesReturn],
        },
        {
          describe: 'Death Gigas (+{1} cost) — target creature you control has base power/toughness 5/2 until end of turn and gains a death-return trigger',
          effects: [setBasePT(5, 2), grantsDiesReturn],
        },
        {
          describe: 'Hellmasker (+{3} cost) — target creature you control has base power/toughness 7/2 until end of turn and gains a death-return trigger',
          effects: [setBasePT(7, 2), grantsDiesReturn],
        },
      ],
    } satisfies Effect,
  ],
};
