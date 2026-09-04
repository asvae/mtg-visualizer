import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const garlandKnightOfCornelia: CardDefinition = {
  name: 'Garland, Knight of Cornelia',
  manaCost: '{B}{R}',
  typeLine: 'Legendary Creature — Human Knight',

  pt: [3, 2],

  triggers: [
    { name: 'onNoncreatureSpellCast', effects: [{ kind: 'surveil', qty: 1 } satisfies Effect] },
  ],

  // "Return this card from your graveyard to the battlefield transformed" —
  // this model has no "which face is currently showing" state (same gap
  // jecht-reluctant-guardian-braska-s-final-aeon's own front-face comment
  // documents) AND `harness.ts`'s own `runScenario` always starts `self` on
  // the Battlefield for an `ability` scenario (no per-scenario zone
  // override exists), so there's no way to genuinely exercise "activated
  // from the graveyard" here either. A real, honestly-described no-op
  // `custom` (same shape cecil-dark-knight's own unbuildable "Protect"
  // ability uses) rather than a `moveTo` call that would be a silent no-op
  // against a `self` that's already on the battlefield.
  abilities: [
    {
      name: 'returnTransformed',
      cost: '{3}{B}{B}{R}{R}, Activate only as a sorcery',
      effects: [
        {
          kind: 'custom',
          describe:
            'return this card from your graveyard to the battlefield transformed (no "which face is showing" state exists here, and no scenario zone override starts self in the graveyard for this ability — not mechanically exercised)',
          run: (_ctx: EffectContext, _actions: Actions) => {},
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Chaos, the Endless',
    manaCost: '',
    typeLine: 'Legendary Creature — Demon',

    pt: [5, 5],
    keywords: ['Flying'],

    triggers: [
      {
        name: 'onDies',
        effects: [
          {
            kind: 'custom',
            describe: "put it on the bottom of its owner's library",
            run: (ctx: EffectContext, actions: Actions) => {
              actions.moveTo(ctx.self, 'Library');
            },
          } satisfies Effect,
        ],
      },
    ],
  },
};
