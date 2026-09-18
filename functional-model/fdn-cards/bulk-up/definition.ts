import type { CardDefinition, Effect } from '../../card';
import { flashback } from '../../flashback';

export const bulkUp: CardDefinition = {
  name: 'Bulk Up',
  manaCost: '{1}{R}',
  typeLine: 'Instant',

  // Real Flashback {4}{R}{R} — modeled the same way every other real
  // Flashback card in this pool does, via the shared `flashback()` factory
  // (`from: 'graveyard', thenExile: true` baked in), NOT as a `keywords`
  // entry (no such literal exists in the closed `Keyword` union).
  alternateCosts: [flashback('{4}{R}{R}')],

  effects: [
    {
      // "Double target creature's power until end of turn" needs the
      // CHOSEN target's own current power to compute the pump delta —
      // `pumpTarget`'s own `Computed<number>` fields only ever receive
      // `EffectContext`, never the target itself (the target is resolved
      // internally, after `power`/`toughness` would already need to be
      // known) — real, narrow reason this needs `custom` rather than the
      // declarative `pumpTarget` Effect. `actions.pump` (not
      // `actions.pumpTarget`, which doesn't exist on `Actions`) is the
      // real primitive every other targeted-pump `custom` effect in this
      // pool already calls.
      kind: 'custom',
      describe: "double target creature's power until end of turn",
      run: (ctx, actions) => {
        const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCreaturesInPlay());
        const target = actions.chooseTarget(pool, ctx.preferTarget);
        if (target) actions.pump(target, target.getNetPower(), 0, { untilEndOfTurn: true });
      },
    } satisfies Effect,
  ],
};
