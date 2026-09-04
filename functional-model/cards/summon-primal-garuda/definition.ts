import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real 714.3a/b Saga chapters modeled as named `triggers`, same
// simplification jecht-reluctant-guardian-braska-s-final-aeon/summon-bahamut/
// summon-choco-mog already document (turn-based-action precision traded for
// reusing the existing multi-trigger mechanism). Real `K:Chapter:3:DBDmg,
// DBPump,DBPump` — chapters II and III both point at the SAME real Forge
// SVar (Slipstream), matching "II, III — Slipstream" on the printed card,
// same repeated-SVar shape summon-bahamut/summon-choco-mog's own chapters
// already establish.
export const summonPrimalGaruda: CardDefinition = {
  name: 'Summon: Primal Garuda',
  manaCost: '{3}{W}',
  typeLine: 'Enchantment Creature — Saga Harpy',

  pt: [3, 3],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'chapterI',
      effects: [
        {
          // "Aerial Blast — This creature deals 4 damage to target tapped
          // creature an opponent controls." `dealDamageTarget`'s own pool
          // is unrestricted (any creature, either side — Slash of Light's
          // own "target creature" shape) with no owner filter; `custom`,
          // narrowing the real pool to `ctx.opponents`' own creatures,
          // models the "an opponent controls" half precisely. The "tapped"
          // half can't be checked at all — the `Card` interface exposes no
          // `isTapped()` accessor (`RealCard.tapped` exists in state.ts but
          // isn't surfaced) — real text only for that part.
          kind: 'custom',
          describe: 'Aerial Blast — this creature deals 4 damage to target tapped creature an opponent controls',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = ctx.opponents.flatMap((p) => p.getCreaturesInPlay());
            if (pool.length === 0) return;
            actions.dealDamage(ctx.self, actions.chooseTarget(pool), 4);
          },
        } satisfies Effect,
      ],
    },
    {
      name: 'chapterII',
      effects: [slipstream()],
    },
    {
      name: 'chapterIII',
      effects: [slipstream()],
    },
  ],
};

function slipstream(): Effect {
  return {
    // "Slipstream — Another target creature you control gets +1/+0 and
    // gains flying until end of turn." `pumpTarget`'s own pool is
    // unrestricted (any creature, either side) with no "you control"/
    // "another" filter, so `custom`, narrowing to `ctx.you`'s OTHER
    // creatures, models the targeting precisely; the P/T delta itself
    // still goes through the real `actions.pump`. The "gains flying" half
    // has no Effect kind at all — the same already-flagged keyword-grant
    // gap Moogles' Valor/Dion, Bahamut's Dominant/Restoration Magic/Zack
    // Fair/The Wind Crystal all hit in this same batch — real text only.
    kind: 'custom',
    describe: 'Slipstream — another target creature you control gets +1/+0 and gains flying until end of turn (flying grant not mechanically enforced)',
    run: (ctx: EffectContext, actions: Actions) => {
      const pool = ctx.you.getCreaturesInPlay().filter((c) => c.getId() !== ctx.self.getId());
      if (pool.length === 0) return;
      actions.pump(actions.chooseTarget(pool), 1, 0);
    },
  } satisfies Effect;
}
