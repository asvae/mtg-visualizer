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
      // Bare name-only trigger — no `Trigger.on` value exists for "an
      // opponent draws a card." `loseLife.owner:'opponents'` is the same
      // documented `EffectOwner` group-only limitation `drawCard.owner`'s
      // own doc comment already covers (no single-arbitrary-player
      // targeting exists), not a novel gap for this card.
      name: 'onOpponentDrawsCard',
      effects: [{ kind: 'loseLife', owner: 'opponents', amount: 1 } satisfies Effect],
    },
  ],
};
