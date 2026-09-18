import type { CardDefinition, Effect } from '../../card';

export const scrawlingCrawler: CardDefinition = {
  name: 'Scrawling Crawler',
  manaCost: '{3}',
  typeLine: 'Artifact Creature — Phyrexian Construct',
  pt: [3, 2],

  triggers: [
    {
      name: 'onUpkeep',
      on: 'upkeep',
      effects: [{ kind: 'drawCard', amount: 1, owner: 'each' } satisfies Effect],
    },
    {
      name: 'onOpponentDrawsCard',
      effects: [{ kind: 'loseLife', owner: 'opponents', amount: 1 } satisfies Effect],
    },
  ],
};
