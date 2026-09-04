import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Tiered (real 701.x-style "choose one additional cost" mechanic) — modal's
// own `modes` has no per-mode COST field (Battle Menu, the only other modal
// precedent, is cost-uniform across modes), so the real Cure {0}/Cura {1}/
// Curaga {3}{W} additional costs are documentary only, carried in each
// mode's own `describe` rather than mechanically distinct — flagged to the
// parent session alongside this card's other gaps below.
export const restorationMagic: CardDefinition = {
  name: 'Restoration Magic',
  manaCost: '{W}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Cure — {0} — target permanent gains hexproof and indestructible until end of turn',
          effects: [
            {
              kind: 'custom',
              // Two real gaps, both flagged to the parent session: (1) no
              // Effect kind grants a keyword to a chosen target at all
              // (`pumpTarget` only ever moves P/T); (2) the real target
              // pool is "target permanent" (any permanent, not just a
              // creature) — `pumpTarget`'s own hardcoded pool is creatures
              // only. `custom`, choosing from the real battlefield-wide
              // pool, is the honest shape until either lands.
              describe: 'target permanent gains hexproof and indestructible until end of turn (no keyword-grant Effect shape exists yet — not mechanically enforced)',
              run: (ctx: EffectContext, actions: Actions) => {
                const pool = [...ctx.you.getCardsIn('Battlefield'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield'))];
                if (pool.length > 0) actions.chooseTarget(pool);
              },
            } satisfies Effect,
          ],
        },
        {
          describe: 'Cura — {1} — target permanent gains hexproof and indestructible until end of turn. You gain 3 life.',
          effects: [
            {
              kind: 'custom',
              describe: 'target permanent gains hexproof and indestructible until end of turn (no keyword-grant Effect shape exists yet — not mechanically enforced)',
              run: (ctx: EffectContext, actions: Actions) => {
                const pool = [...ctx.you.getCardsIn('Battlefield'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield'))];
                if (pool.length > 0) actions.chooseTarget(pool);
              },
            } satisfies Effect,
            { kind: 'gainLife', amount: 3 } satisfies Effect,
          ],
        },
        {
          describe: 'Curaga — {3}{W} — permanents you control gain hexproof and indestructible until end of turn. You gain 6 life.',
          effects: [
            {
              kind: 'custom',
              describe: 'permanents you control gain hexproof and indestructible until end of turn (no keyword-grant Effect shape exists yet — not mechanically enforced)',
              run: (ctx: EffectContext) => {
                ctx.you.getCardsIn('Battlefield');
              },
            } satisfies Effect,
            { kind: 'gainLife', amount: 6 } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
