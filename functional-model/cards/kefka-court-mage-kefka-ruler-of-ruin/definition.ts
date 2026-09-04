import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// A transforming DFC Legendary Creature // Legendary Creature (no Saga back
// face this time, unlike jecht/dion/jill/joshua) — same activated exile-
// then-return transform shape those cards already establish.
export const kefkaCourtMage: CardDefinition = {
  name: 'Kefka, Court Mage',
  manaCost: '{2}{U}{B}{R}',
  typeLine: 'Legendary Creature — Human Wizard',

  pt: [4, 5],

  triggers: [
    {
      // "Whenever Kefka enters or attacks, each player discards a card.
      // Then you draw a card for each card type among cards discarded this
      // way" — one real SVar shared by two separate T: lines (ETB and
      // Attacks), modeled as two independent named triggers running the
      // SAME effects (same "one real ability, multiple firing conditions"
      // shape kefka's own real script uses `Secondary$ True` for). "A card
      // for each card type among cards discarded" has no distinct-types
      // tracking anywhere in this model — approximated as a fixed `2`
      // (each player discards one card; two players' discards are
      // typically two different card types), same fixed-count-
      // approximation class joshua-phoenix-s-dominant's own "draw that
      // many" already accepts.
      name: 'onEnter',
      effects: [{ kind: 'discard', owner: 'each', qty: 1 } satisfies Effect, { kind: 'drawCard', amount: 2 } satisfies Effect],
    },
    {
      name: 'onAttacks',
      effects: [{ kind: 'discard', owner: 'each', qty: 1 } satisfies Effect, { kind: 'drawCard', amount: 2 } satisfies Effect],
    },
  ],

  activationCost: '{8} (activate only as a sorcery)',
  effects: [
    { kind: 'sacrifice', owner: 'opponents', validType: 'any', qty: 1 } satisfies Effect,
    {
      kind: 'custom',
      describe: "exile Kefka, then return it to the battlefield transformed under its owner's control",
      run: (ctx: EffectContext, actions: Actions) => {
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
      },
    } satisfies Effect,
  ],

  backFace: {
    name: 'Kefka, Ruler of Ruin',
    manaCost: '',
    typeLine: 'Legendary Creature — Avatar Wizard',

    pt: [5, 7],
    keywords: ['Flying'],

    triggers: [
      {
        // The opponent's own lost-life amount, fixed once at trigger time —
        // same `triggerInput` convention vincent-valentine-galian-beast's
        // own `dyingCreaturePower` establishes. "During your turn" has no
        // turn-structure gate in this model, documentary only (same as
        // jenova-ancient-calamity's own onMutantDies).
        name: 'onOpponentLosesLife',
        effects: [{ kind: 'drawCard', amount: (ctx: EffectContext) => (ctx.triggerInput?.lifeLostAmount as number) ?? 0 } satisfies Effect],
      },
    ],
  },
};
