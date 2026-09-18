import type { CardDefinition, Effect } from '../../card';

export const twinbladeBlessing: CardDefinition = {
  name: 'Twinblade Blessing',
  manaCost: '{1}{W}{W}',
  typeLine: 'Enchantment — Aura',
  keywords: ['Flash'],

  staticAbilities: ['Enchant creature'],

  // Enchant creature. Enchanted creature has double strike. Real keyword
  // string is 'DoubleStrike' (no space), not 'Double Strike'. `equippedBySelf`
  // is the SAME real `attachedToId` broadcast mechanism sleep-magic/
  // stuck-in-summoner-s-sanctum's own Auras already use for "enchanted
  // creature" (an Aura's attachment link is the identical relationship an
  // Equipment's own "equipped creature" broadcast reads — see state.ts's
  // own `qualifiesForContinuousGrant` doc comment).
  continuousKeywordGrants: [
    {
      keywords: ['DoubleStrike'],
      includeSelf: false,
      equippedBySelf: true,
    },
  ],

  // Without a real `equip`-attach, `equippedBySelf` above would never
  // activate (nothing would ever set `attachedToId`) — same real ETB
  // attach-then-nothing-else pattern sleep-magic's own `onEnter` trigger
  // already establishes (that card's own `actions.tap` follow-up is
  // specific to its own text; this card has none).
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
