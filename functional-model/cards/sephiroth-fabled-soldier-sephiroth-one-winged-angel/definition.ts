import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const sephirothFabledSoldier: CardDefinition = {
  name: 'Sephiroth, Fabled SOLDIER',
  manaCost: '{2}{B}',
  typeLine: 'Legendary Creature — Human Avatar Soldier',

  pt: [3, 3],

  triggers: [
    {
      // Real Forge fires this from TWO separate triggers (ChangesZone-enters
      // AND Attacks) that share the same SVar payload — one named Trigger
      // here covers both real events, same "one payload, multiple firing
      // conditions" shape as this batch's own convention elsewhere.
      name: 'onEnterOrAttacks',
      effects: [
        { kind: 'sacrifice', owner: 'you', validType: 'creature', notSelf: true, optional: true } satisfies Effect,
        { kind: 'drawCard' } satisfies Effect,
      ],
    },
    {
      name: 'onCreatureDies',
      effects: [
        { kind: 'loseLife', owner: 'opponents', amount: 1 } satisfies Effect,
        { kind: 'gainLife', amount: 1 } satisfies Effect,
        {
          kind: 'custom',
          describe:
            'if this is the fourth time this ability has resolved this turn, transform Sephiroth (represented as exile-then-return, mirroring jecht-reluctant-guardian-braska-s-final-aeon\'s own convention for a real zone-tracking gap; the resolve-count is supplied by the scenario, not tracked here — see kain-traitorous-dragoon\'s own triggerInput convention)',
          run: (ctx: EffectContext, actions: Actions) => {
            if ((ctx.triggerInput?.resolvedCount as number) === 4) {
              actions.moveTo(ctx.self, 'Exile');
              actions.moveTo(ctx.self, 'Battlefield');
            }
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Sephiroth, One-Winged Angel',
    manaCost: '',
    typeLine: 'Legendary Creature — Angel Nightmare Avatar',

    pt: [5, 5],
    keywords: ['Flying'],

    triggers: [
      {
        // Real Forge grants this as a persistent command-zone EMBLEM
        // ("Super Nova — ... you get an emblem with ...") rather than a
        // trigger printed directly on the creature — this model tracks no
        // emblem/command-zone object at all, so the emblem's own granted
        // ability is modeled as this face's own trigger instead (same
        // "the granted ability just lives on the card" simplification
        // ultros-obnoxious-octopus's own mana-threshold triggers already
        // make for a condition this model can't gate on).
        name: 'onAnyCreatureDies',
        effects: [
          { kind: 'loseLife', owner: 'opponents', amount: 1 } satisfies Effect,
          { kind: 'gainLife', amount: 1 } satisfies Effect,
        ],
      },
      {
        name: 'onAttack',
        effects: [
          // "sacrifice ANY NUMBER of other creatures. If you do, draw that
          // many cards" — a real chosen X (Sac<X/...>, NumCards$X = xPaid),
          // supplied via the same triggerInput convention
          // kain-traitorous-dragoon's own custom effect uses for a
          // trigger-fixed variable amount.
          {
            kind: 'sacrifice',
            owner: 'you',
            validType: 'creature',
            notSelf: true,
            optional: true,
            qty: (ctx: EffectContext) => (ctx.triggerInput?.sacCount as number) ?? 0,
          } satisfies Effect,
          { kind: 'drawCard', amount: (ctx: EffectContext) => (ctx.triggerInput?.sacCount as number) ?? 0 } satisfies Effect,
        ],
      },
    ],
  },
};
