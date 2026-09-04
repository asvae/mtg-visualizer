import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (elixir.txt): "This artifact enters tapped" — a real
// replacement effect, modeled as an onEnter trigger tapping self, same
// pool-based `tapTarget` convention shambling-cie-th/stuck-in-summoners-
// sanctum's own onEnter triggers already use (self is genuinely already on
// the battlefield by the time a named trigger's effects run — see
// harness.ts's own selfZone rule — so `owner: 'you'` finds exactly self as
// long as the scenario sets up no other artifact for "you").
//
// "{5}, {T}, Exile this artifact: Shuffle all nonland cards from your
// graveyard into your library. You gain life equal to the number of cards
// shuffled into your library this way." The {T}/Exile-self are COSTS, kept
// as `activationCost` text only (same convention phoenix-down's own
// "{1}{W}, {T}, Exile this artifact" cost uses). The effect itself needs a
// `custom`: `move`'s own validType has no "nonland" filter (only
// 'creature'|'artifact'|'land'|'any' — same gap white-auracite's own
// comment already flags for its own "nonland permanent" target), AND the
// life gained depends on how many cards actually moved — a runtime count
// no declarative `gainLife` amount can read back from a prior `move`
// effect in the same list. Both real primitives (`moveTo`, `you.gainLife`)
// exist and are used directly, so this is a precise custom implementation,
// not an invented mechanic.
export const elixir: CardDefinition = {
  name: 'Elixir',
  manaCost: '{1}',
  typeLine: 'Artifact',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'artifact', owner: 'you' } satisfies Effect],
    },
  ],

  activationCost: '{5}, {T}, Exile this artifact',
  effects: [
    {
      kind: 'custom',
      describe: 'shuffle all nonland cards from your graveyard into your library; you gain life equal to the number of cards shuffled this way',
      run: (ctx: EffectContext, actions: Actions) => {
        const nonland = ctx.you.getCardsIn('Graveyard').filter((c) => !c.isLand());
        for (const card of nonland) actions.moveTo(card, 'Library');
        if (nonland.length > 0) ctx.you.gainLife(nonland.length);
      },
    } satisfies Effect,
  ],
};
