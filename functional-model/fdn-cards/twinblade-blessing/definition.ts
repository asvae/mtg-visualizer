import type { CardDefinition, Effect } from '../../card';

export const twinbladeBlessing: CardDefinition = {
  name: 'Twinblade Blessing',
  manaCost: '{1}{W}{W}',
  typeLine: 'Enchantment — Aura',
  keywords: ['Flash'],

  // "Enchant creature. Enchanted creature has double strike."
  continuousKeywordGrants: [
    {
      keywords: ['DoubleStrike'],
      includeSelf: false,
      equippedBySelf: true,
    },
  ],

  // "Enchant creature" — the ETB attach.
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe: 'attaches to enchanted creature',
          run: (ctx, actions) => {
            const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCardsIn('Battlefield')).filter((c) => c.isCreature());
            let target: (typeof pool)[number] | undefined;
            while (target === undefined && ctx.declaredTargets && ctx.declaredTargets.length > 0) {
              const next = ctx.declaredTargets.shift()!;
              if (pool.some((c) => c.getId() === next.getId())) target = next;
              // else: this declared target is no longer a legal creature (608.2b) — dropped, not replaced.
            }
            if (!target) target = actions.chooseTarget(pool, ctx.preferTarget);
            if (target) actions.equip(ctx.self, target);
          },
        } satisfies Effect,
      ],
    },
  ],
};
