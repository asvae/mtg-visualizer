import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const phoenixDown: CardDefinition = {
  name: 'Phoenix Down',
  manaCost: '{W}',
  typeLine: 'Artifact',

  // {1}{W}, {T}, Exile this artifact: Choose one — the tap+self-exile are
  // both COSTS (paid before the ability resolves), not effects, so they
  // stay text on `activationCost` (same convention Paladin's Arms/
  // dragoon-s-lance already use for a tap/mana-only cost).
  activationCost: '{1}{W}, {T}, Exile this artifact',
  effects: [
    {
      kind: 'modal',
      modes: [
        {
          // Real filter is "mana value 4 or less" — this model has no
          // mana-value field on a RealCard at all (see summon-bahamut's
          // own comment on the same gap for "total mana value of permanents
          // you control"), so the MV<=4 restriction can't be checked; and
          // the targeted creature must enter TAPPED, which `move`'s own
          // declarative targeted branch has no field for (only
          // `createToken`'s `tapped` option exists) — both make this a
          // `custom`, real filtering (creature cards in your graveyard)
          // plus a tap right after the move.
          describe: 'return target creature card with mana value 4 or less from your graveyard to the battlefield tapped (mana value not tracked in this model — filtered by type only)',
          effects: [
            {
              kind: 'custom',
              describe: 'return target creature card from your graveyard to the battlefield tapped',
              run: (ctx: EffectContext, actions: Actions) => {
                const pool = ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature());
                if (pool.length === 0) return;
                const target = actions.chooseTarget(pool);
                actions.moveTo(target, 'Battlefield');
                actions.tap(target);
              },
            } satisfies Effect,
          ],
        },
        {
          // "Skeleton, Spirit, or Zombie" — a subtype union `move`'s own
          // `validType` (creature/artifact/any) has no shape for, so
          // `custom` filters by `hasSubtype` directly instead.
          describe: 'exile target Skeleton, Spirit, or Zombie',
          effects: [
            {
              kind: 'custom',
              describe: 'exile target Skeleton, Spirit, or Zombie',
              run: (ctx: EffectContext, actions: Actions) => {
                const pool = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())].filter(
                  (c) => c.hasSubtype('Skeleton') || c.hasSubtype('Spirit') || c.hasSubtype('Zombie')
                );
                if (pool.length === 0) return;
                const target = actions.chooseTarget(pool);
                actions.moveTo(target, 'Exile');
              },
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
