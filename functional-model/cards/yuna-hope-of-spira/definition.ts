import type { CardDefinition, Effect } from '../../card';

export const yunaHopeOfSpira: CardDefinition = {
  name: 'Yuna, Hope of Spira',
  manaCost: '{3}{G}{W}',
  typeLine: 'Legendary Creature — Human Cleric',

  pt: [3, 5],

  // "During your turn, NICKNAME and enchantment creatures you control have
  // trample, lifelink, and ward {2}." Real `Condition$ PlayerTurn` — a
  // CONDITIONAL keyword grant (only during your turn), not the card's own
  // unconditional printed `K:` lines — exactly the case card.ts's own
  // `staticAbilities` doc comment cites Kain's "Jump — during your turn,
  // NICKNAME has flying" for: mechanically granting it via
  // `grantKeywordSelf`/`grantKeywordAll` would misrepresent it as always-on
  // (no whose-turn-is-it tracking exists anywhere in this model), so this
  // stays real, structured text.
  staticAbilities: ['During your turn, Yuna and enchantment creatures you control have trample, lifelink, and ward {2}.'],

  triggers: [
    {
      // "At the beginning of your end step, return up to one target
      // enchantment card from your graveyard to the battlefield with a
      // finality counter on it." `move`'s own declarative `validType` has
      // no 'enchantment' option, so this needs `custom`, same shape
      // terra-magical-adept's own enchantment-to-hand custom effect uses.
      // NOTE: no `PlayerState` field can seed a typed (Enchantment)
      // GRAVEYARD card — same unseedable-real-card gap as that trigger, so
      // only the no-legal-target branch is scenario-testable.
      name: 'onEndStep',
      effects: [
        {
          kind: 'custom',
          describe: 'return up to one target enchantment card from your graveyard to the battlefield with a finality counter on it',
          run: (ctx, actions) => {
            const pool = ctx.you.getCardsIn('Graveyard').filter((c) => c.isEnchantment());
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            actions.moveTo(target, 'Battlefield');
            actions.putCounter(target, 'FINALITY', 1);
          },
        } satisfies Effect,
      ],
    },
  ],
};
