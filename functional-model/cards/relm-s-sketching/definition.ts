import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// "Create a token that's a copy of target artifact, creature, or land" —
// no declarative Effect kind fits a token whose characteristics are read
// off a runtime-CHOSEN target rather than fixed at authoring time
// (`createToken`'s own `token: TokenInfo` is always fixed data). `custom`
// is the honest shape here, but it's still built ENTIRELY out of existing
// actions/getters — `chooseTarget` to pick the permanent, then the real
// `Card` getters (`getName`/`isCreature`/`isArtifact`/`isLand`/
// `getNetPower`/`getNetToughness`) already exposed on every wrapped card —
// not a fabricated new primitive.
export const relmsSketching: CardDefinition = {
  name: "Relm's Sketching",
  manaCost: '{2}{U}{U}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'custom',
      describe: "create a token that's a copy of target artifact, creature, or land",
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = [...ctx.you.getCardsIn('Battlefield'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield'))].filter(
          (c) => c.isArtifact() || c.isCreature() || c.isLand()
        );
        const target = actions.chooseTarget(pool);
        if (!target) return;
        const types: string[] = [];
        if (target.isCreature()) types.push('Creature');
        if (target.isArtifact()) types.push('Artifact');
        if (target.isLand()) types.push('Land');
        actions.createToken(ctx.you, { name: target.getName(), manaCost: '0', types, basePower: target.getNetPower(), baseToughness: target.getNetToughness() }, 1);
      },
    } satisfies Effect,
  ],
};
