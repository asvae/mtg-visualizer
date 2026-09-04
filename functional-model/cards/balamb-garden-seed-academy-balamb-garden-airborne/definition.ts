import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (balamb_garden_seed_academy_balamb_garden_airborne.txt): a
// real transforming DFC — front face a nonbasic Land — Town (real
// "enters tapped" replacement effect, same precedent baron-airship-kingdom/
// elixir already establish), back face a Legendary Artifact Vehicle.
//
// The transform activated ability ("{5}{G}{U}, {T}: Transform this land.
// This ability costs {1} less for each other Town you control") is
// approximated the SAME way cecil-dark-knight-cecil-redeemed-paladin's own
// real transform already is: this model tracks no separate "which face is
// currently showing" state at all, so the flip is represented as a real,
// observable exile-then-return zone-change pair standing in for
// "transform," not an actual face switch (`scenario.face` selects which
// face's OWN effects run independently, same as cecil). The dynamic cost
// reduction is documentary cost text only, same convention qiqirn-
// merchant's own "costs {1} less for each Town you control" ability uses.
// The mana ability ("{T}: Add {G} or {U}") stays real text only — no
// mana-producing Effect/Action exists anywhere in this model.
export const balambGardenSeedAcademyBalambGardenAirborne: CardDefinition = {
  name: 'Balamb Garden, SeeD Academy',
  manaCost: '',
  typeLine: 'Land — Town',

  staticAbilities: ['{T}: Add {G} or {U}.'],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  activationCost: '{5}{G}{U}, {T} (costs {1} less for each other Town you control)',
  effects: [
    {
      kind: 'custom',
      describe: 'transform this land into Balamb Garden, Airborne (approximated as exile then return to the battlefield — this model tracks no separate face-state, same convention Cecil, Dark Knight\'s own real transform uses)',
      run: (ctx: EffectContext, actions: Actions) => {
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
      },
    } satisfies Effect,
  ],

  backFace: {
    name: 'Balamb Garden, Airborne',
    manaCost: '',
    typeLine: 'Legendary Artifact — Vehicle',

    pt: [5, 4],
    keywords: ['Flying'],
    crewCost: 1,

    triggers: [
      {
        name: 'onAttacks',
        effects: [{ kind: 'drawCard' } satisfies Effect],
      },
    ],
  },
};
