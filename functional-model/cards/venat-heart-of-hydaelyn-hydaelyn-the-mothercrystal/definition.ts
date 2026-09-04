import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// A transforming DFC — same `backFace` shape jecht-reluctant-guardian-braska-s-
// final-aeon/dion-bahamut-s-dominant-bahamut-warden-of-light/crystal-fragments-
// summon-alexander already establish: a second, independent `CardDefinition`,
// reached via `Scenario.face: 'back'`. Real `DB$ SetState | Mode$ Transform`
// (a direct flip, not an exile-based transform) is modeled the SAME way
// those other DFCs' own front faces already are — `moveTo(self, 'Exile')`
// then `moveTo(self, 'Battlefield')` as the closest available stand-in for
// "this permanent transforms" (no "which face is currently showing" state
// exists anywhere in this model beyond `backFace` being a second static
// CardDefinition; see jecht's own comment for the fuller citation) — kept
// consistent with that precedent rather than invented fresh here.
export const venatHeartOfHydaelyn: CardDefinition = {
  name: 'Venat, Heart of Hydaelyn',
  manaCost: '{1}{W}{W}',
  typeLine: 'Legendary Creature — Elder Wizard',

  pt: [3, 3],

  triggers: [
    {
      // "Whenever you cast a legendary spell, draw a card. This ability
      // triggers only once each turn." Real `ActivationLimit$ 1` — a
      // per-turn trigger-frequency cap; no turn-counter/activation-limit
      // state exists anywhere in this model (same real, flagged gap
      // G'raha Tia's own "Allagan Eye" comment already documents) — a
      // scenario exercises the trigger firing once, which is all
      // `resolveCard()` ever does per call regardless.
      name: 'onCastLegendarySpell',
      effects: [{ kind: 'drawCard' } satisfies Effect],
    },
  ],

  // "Hero's Sundering — {7}, {T}: Exile target nonland permanent. Transform
  // Venat. Activate only as a sorcery." `move`'s own targeted branch has no
  // "nonland" validType and no shape for "then this permanent itself also
  // transforms" — `custom`, combining a real exile of the chosen
  // battlefield-wide nonland permanent with the exile/re-enter transform
  // stand-in described above, models both halves with only existing
  // primitives. Excludes `ctx.self` from the exile-target pool: the real
  // printed text has no "another" restriction (Venat COULD legally target
  // itself), but `chooseTarget` always takes the FIRST pool candidate, and
  // self is already on the battlefield for this activated-ability scenario
  // — without the exclusion it would always self-target ahead of any real
  // opponent permanent, an uninteresting degenerate case this scenario
  // isn't meant to exercise.
  activationCost: '{7}, {T}',
  effects: [
    {
      kind: 'custom',
      describe: "Hero's Sundering — exile target nonland permanent, then transform Venat (activate only as a sorcery)",
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = [...ctx.you.getCardsIn('Battlefield'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield'))].filter(
          (c) => !c.isLand() && c.getId() !== ctx.self.getId()
        );
        if (pool.length > 0) actions.moveTo(actions.chooseTarget(pool), 'Exile');
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
      },
    } satisfies Effect,
  ],

  backFace: {
    name: 'Hydaelyn, the Mothercrystal',
    manaCost: '',
    typeLine: 'Legendary Creature — God',

    pt: [4, 4],
    keywords: ['Indestructible'],

    triggers: [
      {
        // "Blessing of Light — At the beginning of combat on your turn,
        // put a +1/+1 counter on another target creature you control.
        // Until your next turn, it gains indestructible. If that creature
        // is legendary, draw a card." `putCounterTarget`'s own pool has no
        // "you control"/"another" filter and no way to read back WHICH
        // target was chosen for the conditional draw that follows —
        // `custom`, choosing from the real filtered pool once and reusing
        // that same reference for both the counter and the conditional
        // draw, models the real shape. "Gains indestructible until your
        // next turn" has no keyword-grant Effect shape (same already-
        // flagged gap this whole batch keeps hitting) — real text only.
        name: 'onBeginCombat',
        effects: [
          {
            kind: 'custom',
            describe:
              'Blessing of Light — put a +1/+1 counter on another target creature you control; until your next turn it gains indestructible (not mechanically enforced); if that creature is legendary, draw a card',
            run: (ctx: EffectContext, actions: Actions) => {
              const pool = ctx.you.getCreaturesInPlay().filter((c) => c.getId() !== ctx.self.getId());
              if (pool.length === 0) return;
              const target = actions.chooseTarget(pool);
              actions.putCounter(target, '+1/+1', 1);
              if (target.hasSubtype('Legendary')) ctx.you.drawCard();
            },
          } satisfies Effect,
        ],
      },
    ],
  },
};
