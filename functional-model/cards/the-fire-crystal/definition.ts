import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const theFireCrystal: CardDefinition = {
  name: 'The Fire Crystal',
  manaCost: '{2}{R}{R}',
  typeLine: 'Legendary Artifact',

  // Both real continuous static abilities — no Effect kind covers a cost
  // reduction, and "creatures you control have haste" is an always-on
  // grant (not a one-time resolvable effect), same `staticAbilities`
  // treatment ardyn-the-usurper's own "Demons you control have menace,
  // lifelink, and haste" already establishes for this exact shape.
  staticAbilities: ['Red spells you cast cost {1} less to cast.', 'Creatures you control have haste.'],

  // "Create a token that's a copy of target creature you control." No
  // declarative Effect kind copies a chosen target's own real stats into a
  // new token (`createToken`'s `TokenInfo` is fixed, static data) — same
  // `custom` shape ardyn-the-usurper's own "create a token copy of it"
  // already uses. "Sacrifice it at the beginning of the next end step" has
  // no turn/phase tracking anywhere in this model (state.ts's own header)
  // to hang a delayed sacrifice off of — real text only, not modeled.
  activationCost: '{4}{R}{R}, {T}',
  effects: [
    {
      kind: 'custom',
      describe: "create a token that's a copy of target creature you control (sacrificed at the next end step — not modeled, no turn/phase tracking)",
      run: (ctx: EffectContext, actions: Actions) => {
        const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        if (!target) return;
        actions.createToken(ctx.you, { name: target.getName(), manaCost: '0', types: ['Creature'], basePower: target.getNetPower(), baseToughness: target.getNetToughness() }, 1);
      },
    } satisfies Effect,
  ],
};
