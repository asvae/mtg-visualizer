import type { CardDefinition, Effect } from '../../card';

export const cloudOfDarkness: CardDefinition = {
  name: 'Cloud of Darkness',
  manaCost: '{2}{B}{G}{G}',
  typeLine: 'Legendary Creature — Avatar',

  pt: [3, 3],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          // Real `ValidTgts$ Creature.OppCtrl` — a genuinely restricted
          // target (confirmed against the real script, per this batch's
          // own `owner` rule), so `owner: 'opponents'` is set here (unlike
          // e.g. Coeurl/Dion's own unrestricted "any target").
          kind: 'pumpTarget',
          owner: 'opponents',
          power: (ctx) => -ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature() || c.isArtifact() || c.isEnchantment() || c.isLand()).length,
          toughness: (ctx) => -ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature() || c.isArtifact() || c.isEnchantment() || c.isLand()).length,
        } satisfies Effect,
      ],
    },
  ],
};
