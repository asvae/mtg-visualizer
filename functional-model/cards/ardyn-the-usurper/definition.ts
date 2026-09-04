import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const ardynTheUsurper: CardDefinition = {
  name: 'Ardyn, the Usurper',
  manaCost: '{5}{B}{B}{B}',
  typeLine: 'Legendary Creature — Elder Human Noble',

  pt: [4, 4],

  // "Demons you control have menace, lifelink, and haste" — a continuous
  // keyword grant to OTHER permanents matching a subtype, not to `self`
  // (`keywords` is this card's own printed keywords only). No Effect kind
  // grants a keyword to a live-matched group of permanents (`pumpAll` only
  // ever moves P/T, no KW$-equivalent field — same recurring gap moogles-
  // valor/restoration-magic/dion-bahamut's own comments already document)
  // — real text only.
  staticAbilities: ['Demons you control have menace, lifelink, and haste.'],

  triggers: [
    {
      name: 'onBeginCombat',
      effects: [
        {
          // "exile up to one target creature card from A graveyard [any
          // player's]. If you exiled a card this way, create a token
          // that's a copy of that card, except it's a 5/5 black Demon." —
          // `createToken`'s own `TokenInfo` is fixed, static data (no
          // "copy whatever was just chosen" shape), so the token has to be
          // built from the real chosen card's own `getName()` at
          // resolution time — genuinely dynamic, `custom` is the honest
          // shape (same "read a real object, build a TokenInfo from it"
          // pattern this repo has no cleaner declarative alternative for).
          // Color isn't tracked on a token/RealCard anywhere in this model
          // (no color field exists) — "black" stays in `describe` only.
          kind: 'custom',
          describe: "exile up to one target creature card from a graveyard; if exiled, create a token copy of it, except it's a 5/5 black Demon",
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = [...ctx.you.getCardsIn('Graveyard'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Graveyard'))].filter((c) => c.isCreature());
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            actions.moveTo(target, 'Exile');
            actions.createToken(ctx.you, { name: target.getName(), manaCost: '0', types: ['Creature', 'Demon'], basePower: 5, baseToughness: 5 }, 1);
          },
        } satisfies Effect,
      ],
    },
  ],
};
