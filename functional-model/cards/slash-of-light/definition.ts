import type { CardDefinition, Effect } from '../../card';

export const slashOfLight: CardDefinition = {
  name: 'Slash of Light',
  manaCost: '{1}{W}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'dealDamageTarget',
      amount: (ctx) => {
        const creatureCount = ctx.you.getCreaturesInPlay().length;
        const equipmentCount = ctx.you.getCardsIn('Battlefield').filter((c) => c.hasSubtype('Equipment')).length;
        return creatureCount + equipmentCount;
      },
    } satisfies Effect,
  ],
};
