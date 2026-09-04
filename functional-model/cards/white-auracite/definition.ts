import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const whiteAuracite: CardDefinition = {
  name: 'White Auracite',
  manaCost: '{2}{W}{W}',
  typeLine: 'Artifact',

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          // Real Oblivion Ring shape: "exile target nonland permanent an
          // opponent controls until this artifact leaves the battlefield."
          // `move`'s own targeted branch has no "nonland" validType (only
          // 'creature'|'artifact'|'any'), so `custom`, filtering the real
          // opponent battlefield pool by `!isLand()`, is the honest shape.
          // The "until this leaves the battlefield" return condition has no
          // tracked linkage anywhere in this model (no card built so far
          // returns an exiled permanent on its own leaving play) — real
          // text only, not modeled.
          kind: 'custom',
          describe: 'exile target nonland permanent an opponent controls until this artifact leaves the battlefield',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield')).filter((c) => !c.isLand());
            if (pool.length > 0) actions.moveTo(actions.chooseTarget(pool), 'Exile');
          },
        } satisfies Effect,
      ],
    },
  ],

  // "{T}: Add {W}." — a real mana ability; no Effect kind (nor any action
  // in interfaces.ts) models mana production anywhere in this system (same
  // deliberate boundary sidequest-catch-a-fish's own "Cooking Campsite"
  // back face already documents) — genuinely out of scope, kept as text.
  staticAbilities: ['{T}: Add {W}.'],
};
