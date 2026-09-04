import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const townGreeter: CardDefinition = {
  name: 'Town Greeter',
  manaCost: '{1}{G}',
  typeLine: 'Creature — Human Citizen',

  pt: [1, 1],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          // Mill 4, then a conditional pick-a-land-then-maybe-gain-life
          // chain — the "gain 2 life ONLY if the land you picked is also a
          // Town" branch needs to know what the moved card actually WAS, a
          // cross-effect fact no declarative effect chain here can carry
          // (no shared "last moved card" field). `actions.move` genuinely
          // RETURNS the cards it moved (see interfaces.ts's own signature),
          // so `custom` can read that real result and branch on it — this
          // is the one card in this batch that needed the return value, not
          // just the side effect.
          kind: 'custom',
          describe:
            'mill four cards; you may put a land card from among them into your hand; if you put a Town card into your hand this way, you gain 2 life',
          run: (ctx: EffectContext, actions: Actions) => {
            const milled = actions.move(ctx.you, 'Library', 'Graveyard', 4);
            const land = milled.find((c) => c.isLand());
            if (land) {
              actions.moveTo(land, 'Hand');
              if (land.hasSubtype('Town')) ctx.you.gainLife(2);
            }
          },
        } satisfies Effect,
      ],
    },
  ],
};
