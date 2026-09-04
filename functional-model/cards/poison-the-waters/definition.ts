import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const poisonTheWaters: CardDefinition = {
  name: 'Poison the Waters',
  manaCost: '{1}{B}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'All creatures get -1/-1 until end of turn.',
          effects: [
            {
              // Real `ValidCards$ Creature` — NO `.YouCtrl` restriction,
              // genuinely every creature on the battlefield regardless of
              // controller. `pumpAll`'s own `predicate` union is only
              // `'creatures-you-control'` (no board-wide-across-every-
              // player option) — a real gap flagged in this batch's own
              // final report. `custom`, pumping every creature either
              // player controls, is the honest shape in the meantime.
              kind: 'custom',
              describe: 'all creatures get -1/-1 until end of turn',
              run: (ctx: EffectContext, actions: Actions) => {
                for (const creature of [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())]) actions.pump(creature, -1, -1);
              },
            } satisfies Effect,
          ],
        },
        {
          // Real `Mode$ RevealYouChoose | DiscardValid$ Artifact,Creature`
          // — a target player reveals their hand and YOU pick a specific
          // artifact-or-creature card from it to discard. `discard`'s own
          // Effect shape has no type filter and no "who chooses" field at
          // all (`state.ts`'s own `GameState.discard` always discards the
          // front of hand, real Forge's own doc comment there already notes
          // "real Forge lets the player/AI choose which") — same
          // approximation, not a new gap this card introduces. `owner:
          // 'opponents'` covers "target player" (the real, overwhelmingly
          // common case) declaratively.
          describe: "Target player reveals their hand. You choose an artifact or creature card from it. That player discards that card.",
          effects: [{ kind: 'discard', owner: 'opponents', qty: 1 } satisfies Effect],
        },
      ],
    } satisfies Effect,
  ],
};
