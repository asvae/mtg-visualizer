import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (judgment_bolt.txt): "deals 5 damage to target creature and X
// damage to that creature's controller, where X is the number of Equipment
// you control" — `ValidTgts$ Creature` has NO controller restriction (the
// target can be anyone's creature, not just an opponent's), and the SECOND
// damage instance targets "that creature's CONTROLLER" — a binding on the
// FIRST effect's own chosen target that no declarative shape here can
// express (`dealDamage`'s own `target` is a fixed `EffectOwner`, not
// "whoever controls a previously-chosen card"). `custom` composing the real
// `chooseTarget`/`dealDamage`/`getController` primitives directly, same
// "no new capability, just a target-dependent binding no Effect variant
// covers" reasoning aerith-rescue-mission's own "one of the targets from
// the previous effect" custom effect already documents.
export const judgmentBolt: CardDefinition = {
  name: 'Judgment Bolt',
  manaCost: '{3}{R}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'custom',
      describe: "deals 5 damage to target creature and X damage to that creature's controller, where X is the number of Equipment you control",
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())];
        const target = actions.chooseTarget(pool);
        if (!target) return;
        actions.dealDamage(ctx.self, target, 5);
        const equipmentCount = ctx.you.getCardsIn('Battlefield').filter((c) => c.isArtifact() && c.hasSubtype('Equipment')).length;
        actions.dealDamage(ctx.self, target.getController(), equipmentCount);
      },
    } satisfies Effect,
  ],
};
