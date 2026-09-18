import type { CardDefinition, EffectContext } from '../../card';

export const lunarInsight: CardDefinition = {
  name: 'Lunar Insight',
  manaCost: '{2}{U}',
  typeLine: 'Sorcery',
  // "Draw a card for each different mana value among nonland permanents
  // you control."
  effects: [
    {
      kind: 'drawCard',
      amount: (ctx: EffectContext) => {
        const nonlandPermanents = ctx.you.getCardsIn('Battlefield').filter((c) => !c.isLand());
        const manaCosts = new Set(nonlandPermanents.map((c) => c.getCMC()));
        return manaCosts.size;
      },
    },
  ],
};
