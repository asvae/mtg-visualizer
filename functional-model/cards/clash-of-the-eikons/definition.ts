import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const clashOfTheEikons: CardDefinition = {
  name: 'Clash of the Eikons',
  manaCost: '{G}',
  typeLine: 'Sorcery',

  // Real `MinCharmNum$1 | CharmNum$3` — "choose ONE OR MORE" of the three
  // modes below. `modal`'s own `ctx.mode` only ever selects a SINGLE
  // branch index (see card.ts's own doc comment), so this reuses it the
  // same simplified way vayne-s-treachery's own Kicker does: each real mode
  // is modeled exactly and correctly, but a scenario can only exercise one
  // chosen mode at a time rather than a genuine multi-select.
  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Target creature you control fights target creature an opponent controls.',
          effects: [
            {
              // A real TWO-CHOSEN-CREATURES fight — distinct from
              // `fightTarget`'s own shape (`self` fights a chosen target,
              // see card.ts's own doc comment), since NEITHER fighter here
              // is `ctx.self`. `custom`, choosing both, then having each
              // deal the other damage equal to its own power, mirrors
              // `applyEffect`'s own real `fightTarget` handler exactly,
              // just over two independently chosen creatures.
              kind: 'custom',
              describe: 'target creature you control fights target creature an opponent controls',
              run: (ctx: EffectContext, actions: Actions) => {
                const yours = ctx.you.getCreaturesInPlay();
                if (yours.length === 0) return;
                const a = actions.chooseTarget(yours);
                const oppCreatures = ctx.opponents.flatMap((p) => p.getCreaturesInPlay());
                if (oppCreatures.length === 0) return;
                const b = actions.chooseTarget(oppCreatures);
                actions.dealDamage(a, b, a.getNetPower());
                actions.dealDamage(b, a, b.getNetPower());
              },
            } satisfies Effect,
          ],
        },
        {
          describe: 'Remove a lore counter from target Saga you control.',
          effects: [
            // Real `DB$ RemoveCounter` — no distinct removal Effect kind
            // exists anywhere in this model; reusing `putCounterTarget`'s
            // already-declarative `amount` field with a NEGATIVE value
            // achieves the same real counter mutation (`state.putCounter`
            // is a plain `+=`, no floor), rather than dropping to `custom`
            // for what's mechanically identical to putCounterTarget with a
            // negative delta. No 'enchantment' validType exists for
            // putCounterTarget (only creature/land/artifact/creature-or-
            // artifact/any) — 'any' is the closest fit for "target Saga."
            { kind: 'putCounterTarget', validType: 'any', owner: 'you', counterType: 'LORE', amount: -1 } satisfies Effect,
          ],
        },
        {
          describe: 'Put a lore counter on target Saga you control.',
          effects: [{ kind: 'putCounterTarget', validType: 'any', owner: 'you', counterType: 'LORE', amount: 1 } satisfies Effect],
        },
      ],
    } satisfies Effect,
  ],
};
