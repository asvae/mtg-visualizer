import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

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
