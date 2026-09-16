import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const theFireCrystal: CardDefinition = {
  name: 'The Fire Crystal',
  manaCost: '{2}{R}{R}',
  typeLine: 'Legendary Artifact',

  // Both real, now-mechanical fields — an earlier version of this card left
  // both as inert freeform `staticAbilities` text ("no Effect kind covers a
  // cost reduction" / a bare always-on grant); real, structured machinery
  // for both already exists elsewhere in the pool (The Water Crystal's/The
  // Wind Crystal's own `spellCostReductionGrants`; Ardyn, the Usurper's own
  // `continuousKeywordGrants`, here with no `subtype` at all since Haste
  // applies to EVERY creature you control, not one subtype of them) — this
  // card just never got migrated onto either; fixed for real now rather
  // than left stale.
  spellCostReductionGrants: [{ amount: 1, colors: ['R'] }],
  continuousKeywordGrants: [{ keywords: ['Haste'], includeSelf: false }],

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
