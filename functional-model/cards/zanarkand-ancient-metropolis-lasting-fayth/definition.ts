import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

// Real script (zanarkand_ancient_metropolis_lasting_fayth.txt): NOT a
// transforming DFC like jecht-reluctant-guardian-braska-s-final-aeon/
// vincent-valentine-galian-beast — this is the Adventure layout (real
// `AlternateMode:Adventure`), just with the unusual real printed split of
// "Land — Town" as the front/mana-source face and "Sorcery — Adventure" as
// the alternate spell you can cast instead, then play the land later from
// exile. `backFace`/`scenario.face: 'back'` is reused purely as a
// structural vehicle for "the card's second named mode" (same field
// jecht/vincent already repurpose for a genuinely different real mechanic),
// not an assertion that this transforms.
//
// Front face: same real "enters tapped" replacement effect and mana-
// ability-as-text treatment as treno-dark-city's own doc comment explains
// in full.
export const zanarkandAncientMetropolis: CardDefinition = {
  name: 'Zanarkand, Ancient Metropolis',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['{T}: Add {G}.'],

  backFace: {
    name: 'Lasting Fayth',
    manaCost: '{4}{G}{G}',
    typeLine: 'Sorcery — Adventure',

    // "Create a 1/1 colorless Hero creature token. Put a +1/+1 counter on
    // it for each land you control." — real `SVar:DBPutCounter` puts the
    // counter on the just-created token (`Defined$ Remembered`), not on
    // `self` — `putCounter`'s own declarative shape only ever targets
    // `'self'` (see card.ts's own doc comment), so a counter on a
    // freshly-made OTHER object needs `custom` calling the real
    // `actions.putCounter` directly on the created token, same
    // "compose real primitives, no invented capability" shape aerith-
    // rescue-mission's own "tap three, counter one of them" custom effect
    // already establishes. "Then exile this card. You may play the land
    // later from exile" is Adventure's own real, automatic zone rule — not
    // this card's own effect to model (no alternateCosts entry needed
    // either: this is the Adventure side casting FROM hand, not an
    // alternate way to cast the land).
    effects: [
      {
        kind: 'custom',
        describe: 'create a 1/1 colorless Hero creature token; put a +1/+1 counter on it for each land you control',
        run: (ctx: EffectContext, actions: Actions) => {
          const [created] = actions.createToken(ctx.you, TOKENS.c_1_1_hero, 1);
          if (created) {
            const lands = ctx.you.getLandsInPlay().length;
            if (lands > 0) actions.putCounter(created, '+1/+1', lands);
          }
        },
      } satisfies Effect,
    ],
  },
};
