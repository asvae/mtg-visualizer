import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (tifas_limit_break.txt): `A:SP$ Charm | Choices$
// DBSomersault,DBMeteorStrikes,DBFinalHeaven` — a real "choose one" Charm
// (Forge's own Tiered keyword: choosing a mode also adds an extra cost on
// top of the base {G}), so `modal` is the right declarative fit (same
// "choose one" shape battle-menu already uses). The per-mode ADDITIONAL
// cost has no field on `modal` (only `describe`+`effects`) — folded into
// each mode's own `describe` text as documentary-only, same convention
// qiqirn-merchant's own dynamic-cost-reduction comment already establishes
// for cost text this model never recalculates.
export const tifasLimitBreak: CardDefinition = {
  name: "Tifa's Limit Break",
  manaCost: '{G}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Somersault (+{0} cost) — target creature gets +2/+2 until end of turn',
          effects: [{ kind: 'pumpTarget', power: 2, toughness: 2 } satisfies Effect],
        },
        {
          describe: "Meteor Strikes (+{2} cost) — double target creature's power and toughness until end of turn",
          effects: [
            {
              // `pumpTarget`'s own `power`/`toughness` `Computed` fields
              // only receive `ctx` (self/you/opponents) — no reference to
              // WHICH creature `chooseTarget` actually picked — so "double
              // THAT target's own current stats" can't be expressed through
              // `pumpTarget` alone. `custom`, choosing the target directly
              // and reading its own live power/toughness before pumping it
              // by that same amount (delta == current -> new == 2x
              // current) — same choose-then-pump-off-the-chosen-target
              // shape summon-primal-garuda's own Slipstream effect already
              // uses, same self-referential-delta shape ride-the-shoopuf's
              // own "becomes a 7/7" effect already uses.
              kind: 'custom',
              describe: "doubles target creature's power and toughness",
              run: (ctx: EffectContext, actions: Actions) => {
                const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCreaturesInPlay());
                if (pool.length === 0) return;
                const target = actions.chooseTarget(pool);
                actions.pump(target, target.getNetPower(), target.getNetToughness());
              },
            } satisfies Effect,
          ],
        },
        {
          describe: "Final Heaven (+{6}{G} cost) — triple target creature's power and toughness until end of turn",
          effects: [
            {
              // Same shape as Meteor Strikes above — "triple" is a delta of
              // 2x the target's own current power/toughness (new = current
              // + 2*current == 3x current).
              kind: 'custom',
              describe: "triples target creature's power and toughness",
              run: (ctx: EffectContext, actions: Actions) => {
                const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCreaturesInPlay());
                if (pool.length === 0) return;
                const target = actions.chooseTarget(pool);
                actions.pump(target, target.getNetPower() * 2, target.getNetToughness() * 2);
              },
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
