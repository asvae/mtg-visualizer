import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real Forge (fishing_pole.txt): `S:Mode$ Continuous | Affected$
// Creature.EquippedBy | AddAbility$ FishingPoleBaiting` — grants a WHOLE
// activated ability to the equipped creature. No such "grant an arbitrary
// activated ability to another permanent" primitive exists anywhere in this
// schema (`continuousKeywordGrants`/`continuousPTGrants`/
// `continuousTypeGrants` only ever broadcast a keyword/P-T-delta/type, never
// a full ability). The untap-trigger consequence ("remove a bait counter...
// if you do, create a Fish token") is both un-dispatchable (no
// `Trigger.on` value for "equipped creature becomes untapped") and
// conditionally chained on the FIRST action's own success ("if you do"),
// which nothing in this schema tracks. Equip itself IS real, functional
// vocabulary (mirrors `celestial-armor`'s own real Equip-attach closure).
export const fishingPole: CardDefinition = {
  name: 'Fishing Pole',
  manaCost: '{1}',
  typeLine: 'Artifact — Equipment',

  activationCost: '{2}',
  effects: [
    {
      kind: 'custom',
      describe: 'attach to target creature you control',
      run: (ctx: EffectContext, actions: Actions) => {
        const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        if (target) actions.equip(ctx.self, target);
      },
    } satisfies Effect,
  ],

  missingSchemaFunctionality: [
    {
      clause: 'Equipped creature has "{1}, {T}, Tap Fishing Pole: Put a bait counter on Fishing Pole."',
      demand: 'No "grant an arbitrary activated ability to another permanent" primitive exists — only keyword/P-T/type broadcasts are modeled.',
    },
    {
      clause: 'Whenever equipped creature becomes untapped, remove a bait counter from this Equipment. If you do, create a 1/1 blue Fish creature token.',
      demand:
        'No `Trigger.on` value exists for "a permanent this is attached to becomes untapped," and no primitive conditions one effect on whether a PRIOR effect actually did something ("if you do").',
    },
  ],
};
