import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const vincentValentine: CardDefinition = {
  name: 'Vincent Valentine',
  manaCost: '{2}{B}{B}',
  typeLine: 'Legendary Creature — Assassin',

  pt: [2, 2],

  triggers: [
    {
      // "put a number of +1/+1 counters on CARDNAME equal to that
      // creature's power" — the dying creature's OWN power, fixed once at
      // trigger time (real TriggeredCard$CardPower), supplied via the same
      // triggerInput convention kain-traitorous-dragoon's own custom effect
      // uses for a trigger-fixed variable amount.
      name: 'onOpponentCreatureDies',
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: '+1/+1',
          amount: (ctx: EffectContext) => (ctx.triggerInput?.dyingCreaturePower as number) ?? 0,
        } satisfies Effect,
      ],
    },
    {
      name: 'onAttacks',
      effects: [
        {
          kind: 'custom',
          describe:
            'you may transform it (represented as exile-then-return, mirroring jecht-reluctant-guardian-braska-s-final-aeon\'s own convention; the "may" is always taken since this model has no player-decision engine)',
          run: (ctx: EffectContext, actions: Actions) => {
            actions.moveTo(ctx.self, 'Exile');
            actions.moveTo(ctx.self, 'Battlefield');
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Galian Beast',
    manaCost: '',
    typeLine: 'Legendary Creature — Werewolf Beast',

    pt: [3, 2],
    keywords: ['Trample', 'Lifelink'],

    triggers: [
      {
        name: 'onDies',
        effects: [
          {
            kind: 'custom',
            describe:
              'return it to the battlefield tapped (front face up) — this model has no "which face is showing" state (see jecht-reluctant-guardian-braska-s-final-aeon\'s own front-face comment), so this is a plain return-and-tap',
            run: (ctx: EffectContext, actions: Actions) => {
              actions.moveTo(ctx.self, 'Battlefield');
              actions.tap(ctx.self);
            },
          } satisfies Effect,
        ],
      },
    ],
  },
};
