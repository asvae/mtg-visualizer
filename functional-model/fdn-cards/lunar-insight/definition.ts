import type { CardDefinition, EffectContext } from '../../card';

export const lunarInsight: CardDefinition = {
  name: 'Lunar Insight',
  manaCost: '{2}{U}',
  typeLine: 'Sorcery',
  effects: [
    {
      kind: 'drawCard',
      amount: (ctx: EffectContext) => {
        // `Player` has no `getPermanentsInPlay` — the real generic
        // accessor is `getCardsIn(ZoneType)` (interfaces.ts's own
        // `Player.getCardsIn`), filtered to nonland.
        const nonlandPermanents = ctx.you.getCardsIn('Battlefield').filter((c) => !c.isLand());
        const manaCosts = new Set(nonlandPermanents.map((c) => c.getCMC()));
        return manaCosts.size;
      },
    },
  ],
};
