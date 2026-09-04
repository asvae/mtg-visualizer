import type { CardDefinition, Effect } from '../../card';

export const vaynesTreachery: CardDefinition = {
  name: "Vayne's Treachery",
  manaCost: '{1}{B}',
  typeLine: 'Instant',

  // Kicker (an additional cost, real Sac<1/Creature;Artifact/...>) branches
  // the resolved effect exactly like a real "choose one —" would (real
  // Forge's own `Count$Kicked.6.2` SVar reads the SAME binary fact this
  // reuses `modal`/`ctx.mode` for) — no Kicker-specific field exists
  // anywhere in EffectContext/CardDefinition, so this repurposes the
  // existing `modal` mechanism (mode 0 = not kicked, mode 1 = kicked) for
  // the identical "one of two fixed branches, selected once per resolution"
  // shape `modal` already models for a true "choose one," rather than
  // inventing a new Effect kind for what's mechanically the same choice.
  effects: [
    {
      kind: 'modal',
      modes: [
        { describe: 'Not kicked — target creature gets -2/-2 until end of turn', effects: [{ kind: 'pumpTarget', power: -2, toughness: -2 } satisfies Effect] },
        {
          describe: 'Kicked (sacrifice an artifact or creature) — that creature gets -6/-6 until end of turn instead',
          effects: [
            { kind: 'sacrifice', owner: 'you', validType: 'creature-or-artifact' } satisfies Effect,
            { kind: 'pumpTarget', power: -6, toughness: -6 } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
