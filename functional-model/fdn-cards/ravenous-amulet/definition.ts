import type { CardDefinition, Effect } from '../../card';

export const ravenousAmulet: CardDefinition = {
  name: 'Ravenous Amulet',
  manaCost: '{2}',
  typeLine: 'Artifact',

  abilities: [
    {
      name: 'drawAndSoul',
      cost: '{1}, {T}, Sacrifice a creature',
      effects: [
        { kind: 'drawCard', amount: 1 } satisfies Effect,
        { kind: 'putCounter', target: 'self', counterType: 'SOUL', amount: 1 } satisfies Effect,
      ],
    },
    {
      name: 'sacForLife',
      cost: '{4}, {T}, Sacrifice this artifact',
      effects: [{ kind: 'loseLife', owner: 'opponents', amount: (ctx) => ctx.self.getCounters('SOUL') } satisfies Effect],
    },
  ],
};
