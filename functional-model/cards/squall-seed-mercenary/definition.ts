import type { CardDefinition, Effect } from '../../card';

export const squallSeedMercenary: CardDefinition = {
  name: 'Squall, SeeD Mercenary',
  manaCost: '{2}{W}{B}',
  typeLine: 'Legendary Creature — Human Knight Mercenary',

  pt: [3, 4],

  triggers: [
    {
      // "Rough Divide — Whenever a creature you control attacks alone, it
      // gains double strike until end of turn." Same real gap/approximation
      // seifer-almasy's own identical Rough Divide trigger already
      // documents: "Alone$ True" (which creature, and that it was the only
      // attacker) isn't tracked anywhere in this model — approximated as
      // the first creature you control.
      name: 'onAttacksAlone',
      effects: [{ kind: 'grantKeywordTarget', keyword: 'DoubleStrike', owner: 'you' } satisfies Effect],
    },
    {
      // "Whenever Squall deals combat damage to a player, return target
      // permanent card with mana value 3 or less from your graveyard to
      // the battlefield." `move`'s own declarative `validType` is type-only
      // (creature/artifact/land/any — no cmc filter), so a "mana value 3 or
      // less" restriction needs `custom`, reading the real `getCMC()`.
      name: 'onDealsCombatDamageToPlayer',
      effects: [
        {
          kind: 'custom',
          describe: 'return target permanent card with mana value 3 or less from your graveyard to the battlefield',
          run: (ctx, actions) => {
            const pool = ctx.you.getCardsIn('Graveyard').filter((c) => c.getCMC() <= 3);
            if (pool.length === 0) return;
            actions.moveTo(actions.chooseTarget(pool), 'Battlefield');
          },
        } satisfies Effect,
      ],
    },
  ],
};
