import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const ignisScientia: CardDefinition = {
  name: 'Ignis Scientia',
  manaCost: '{1}{G}{U}',
  typeLine: 'Legendary Creature — Human Advisor',

  pt: [2, 2],

  triggers: [
    {
      // "Look at the top six cards of your library. You may put a land
      // card from among them onto the battlefield tapped. Put the rest on
      // the bottom in a random order." Real Forge `DigEffect` shape, but
      // this model's own `dig` Effect kind only supports `validType:
      // 'artifact' | 'any'` (no `'land'`) AND always routes its found
      // cards to HAND (`state.ts`'s own `GameState.dig` hardcodes
      // `move(card, 'Hand')`), never Battlefield — neither matches this
      // card's real "onto the battlefield" destination. The plain
      // untargeted `move` shape reach-the-horizon/prishe-s-wanderings/
      // gladiolus-amicitia already use for "search for a land, put it onto
      // the battlefield" is the closer real-outcome fit (loses the
      // "top six only"/"tapped"/"rest to bottom" nuance, same documentary-
      // loss class those cards already flag, and hits the same no-land-
      // typed-library-filler gap they note too).
      name: 'onEnter',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Battlefield', qty: 1, validType: 'land' } satisfies Effect],
    },
  ],

  activationCost: '{1}{G}{U}, {T}',
  effects: [
    {
      // "Exile target card from a graveyard. If a creature card was exiled
      // this way, create a Food token" — the token creation is gated on
      // what the CHOSEN target actually was, which no combination of
      // `move`+`createToken` can express declaratively (nothing feeds one
      // effect's real outcome into the next's condition) — same shape
      // sidequest-catch-a-fish-cooking-campsite's own upkeep trigger
      // already established this exact pattern for.
      kind: 'custom',
      describe: "exile target card from a graveyard; if a creature card was exiled this way, create a Food token",
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = [...ctx.you.getCardsIn('Graveyard'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Graveyard'))];
        if (pool.length === 0) return;
        const target = actions.chooseTarget(pool);
        const wasCreature = target.isCreature();
        actions.moveTo(target, 'Exile');
        if (wasCreature) actions.createToken(ctx.you, TOKENS.c_a_food_sac, 1);
      },
    } satisfies Effect,
  ],
};
