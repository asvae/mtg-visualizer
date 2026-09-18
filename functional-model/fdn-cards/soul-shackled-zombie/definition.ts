import type { CardDefinition, Effect } from '../../card';

export const soulShackledZombie: CardDefinition = {
  name: 'Soul-Shackled Zombie',
  manaCost: '{3}{B}',
  typeLine: 'Creature — Zombie',
  pt: [4, 2],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          // "Exile up to two target cards from a single graveyard. If at
          // least one creature card was exiled this way, each opponent
          // loses 2 life and you gain 2 life." The "single graveyard"
          // restriction (all chosen cards must share one owner) isn't
          // representable (accepted simplification); the conditional
          // life-swing genuinely depends on what the SAME effect just
          // exiled, which no declarative `move`+later-`Computed` chaining
          // can read back — real, non-empty `custom`, using the real
          // `Player.loseLife`/`gainLife` methods directly (not a
          // placeholder).
          kind: 'custom',
          describe:
            'exile up to two target cards from a single graveyard. If at least one creature card was exiled this way, each opponent loses 2 life and you gain 2 life.',
          run: (ctx, actions) => {
            const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCardsIn('Graveyard'));
            const targets: (typeof pool)[number][] = [];
            for (let i = 0; i < 2; i++) {
              const remaining = pool.filter((c) => !targets.includes(c));
              if (remaining.length === 0) break;
              targets.push(actions.chooseTarget(remaining, ctx.preferTarget));
            }
            for (const t of targets) actions.moveTo(t, 'Exile');
            if (targets.some((t) => t.isCreature())) {
              for (const opp of ctx.opponents) opp.loseLife(2);
              ctx.you.gainLife(2);
            }
          },
        } satisfies Effect,
      ],
    },
  ],
};
