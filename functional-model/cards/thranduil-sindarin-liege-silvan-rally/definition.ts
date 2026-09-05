import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

// An Adventure card (Thranduil, the creature // Silvan Rally, the sorcery
// side cast from hand FIRST, exiling itself, letting the creature be cast
// later from exile) — reused via `backFace` the same way a transforming DFC
// is (sidequest-catch-a-fish-cooking-campsite's own precedent), even though
// the REAL cast order/timing is reversed from a transform DFC (adventure:
// spell side first, creature later from exile; transform: front face is
// the starting state). Both halves' own effects are independently real and
// exercised via `Scenario.face: 'front'|'back'` either way — this model has
// no notion of "which face was already cast" or exile-then-cast-from-exile
// sequencing, so that real distinction isn't tracked, same documented
// simplification jecht-reluctant-guardian-braska-s-final-aeon's own
// `backFace` comment already makes for its own gap.
export const thranduilSindarinLiege: CardDefinition = {
  name: 'Thranduil, Sindarin Liege',
  manaCost: '{2}{G/U}{G/U}',
  typeLine: 'Legendary Creature — Elf Noble',
  pt: [2, 3],

  staticAbilities: ['Other Elves you control get +1/+1.'],

  triggers: [
    {
      name: 'onLandfall',
      effects: [{ kind: 'createToken', token: TOKENS.g_1_1_elf, amount: 1 } satisfies Effect],
    },
  ],

  backFace: {
    name: 'Silvan Rally',
    manaCost: '{1}{G/U}{G/U}',
    typeLine: 'Sorcery — Adventure',
    effects: [
      { kind: 'move', owner: 'you', from: 'Library', to: 'Graveyard', qty: 4, target: false } satisfies Effect,
      {
        // "...then put up to two land cards from among them into your
        // hand." No declarative shape reads "the batch just milled"
        // specifically (`dig` reads the top of LIBRARY, not a graveyard
        // batch) — custom, reading the whole graveyard directly. Correct
        // under this model's own "baseline: all other zones empty" scenario
        // convention (the graveyard IS just the 4 just-milled cards in an
        // otherwise-empty scenario) but would over-read in a real game
        // state with prior graveyard contents — same class of gap as
        // Elrond, Moon-Reader's own "existence check" simplification.
        kind: 'custom',
        describe: 'put up to two land cards from among the four milled cards into hand',
        run: (ctx: EffectContext, actions: Actions) => {
          const lands = ctx.you.getCardsIn('Graveyard').filter((c) => c.isLand());
          for (const land of lands.slice(0, 2)) actions.moveTo(land, 'Hand');
        },
      } satisfies Effect,
    ],
  },
};
