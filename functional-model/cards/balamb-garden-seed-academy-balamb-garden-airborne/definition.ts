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
// The mana ability ("{T}: Add {G} or {U}") is a real, structured
// choice-of-color `manaAbilities` entry — see treno-dark-city's own doc
// comment for the full citation/mechanism.
export const balambGardenSeedAcademyBalambGardenAirborne: CardDefinition = {
  name: 'Balamb Garden, SeeD Academy',
  manaCost: '',
  typeLine: 'Land — Town',

  manaAbilities: [{ colors: ['G', 'U'] }],

  // recognizer-exception: entersBattlefield-self-trigger-structural — real
  // CR 614.12 "This land enters tapped" replacement effect, modeled as an
  // onEnter self-tap trigger (see treno-dark-city's own doc comment for the
  // full convention). No "When/Whenever <self> enters" clause exists in the
  // real printed text at all, so this recognizer correctly declines rather
  // than asserting a false sink fact.
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
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
    // Real Forge implicit crew-animate rule (bare `K:Crew:1`, same as
    // `the-lunar-whale`'s/`the-prima-vista`'s own identical Crew mechanic)
    // — this effect was MISSING entirely before 2026-09-15 (fin/16-25
    // pass), a real correctness gap: now present, same shape `cargo-ship`/
    // `magitek-armor` already establish.
    effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] } satisfies Effect],

    triggers: [
      {
        name: 'onAttacks',
        effects: [{ kind: 'drawCard' } satisfies Effect],
      },
    ],
  },
};
