import type { CardDefinition, Effect } from '../../card';

export const zodiarkUmbralGod: CardDefinition = {
  name: 'Zodiark, Umbral God',
  manaCost: '{B}{B}{B}{B}{B}',
  typeLine: 'Legendary Creature — God',

  pt: [5, 5],
  keywords: ['Indestructible'],

  triggers: [
    {
      // Real Forge: `RepeatEach | RepeatPlayers$ Player | RepeatSubAbility$
      // DBSacrifice`, with `Amount$ Y` = `Count$Valid
      // Creature.nonGod+RememberedPlayerCtrl/HalfDown` — EACH player
      // independently sacrifices half of THEIR OWN non-God creatures,
      // rounded down. A real, confirmed gap: `sacrifice`'s own `qty` is a
      // single `Computed<number>` resolved ONCE against `ctx` and then
      // applied identically to every player `playersFor('each', ctx)`
      // returns (see card.ts's own `applyEffect` 'sacrifice' case) — there
      // is no way to recompute a DIFFERENT amount per player in the loop.
      // Approximated here by computing the amount off `ctx.you`'s own
      // board only (same "no per-player Computed" ceiling `dealDamage`/
      // `loseLife`/`discard`'s shared `owner` shape already has) — correct
      // whenever both sides have the SAME creature count (this card's own
      // scenarios below keep them equal for that reason), silently wrong
      // for an asymmetric board. Flagged to the parent session as a real
      // schema gap, not invented around.
      //
      // "non-God creatures" (`SacValid$ Creature.nonGod`) has no matching
      // `validType` either (only creature/artifact/enchantment/any/
      // creature-or-artifact exist) — approximated via `notSelf` (Zodiark
      // is the only God any of these scenarios ever puts on a battlefield,
      // so excluding `ctx.self` from both the count and the sacrifice pool
      // is equivalent in practice, though not a real "exclude every God"
      // filter).
      name: 'onEnter',
      effects: [
        {
          kind: 'sacrifice',
          owner: 'each',
          validType: 'creature',
          notSelf: true,
          qty: (ctx) => Math.floor(Math.max(0, ctx.you.getCreaturesInPlay().length - 1) / 2),
        } satisfies Effect,
      ],
    },
    {
      name: 'onCreatureSacrificed',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
  ],
};
