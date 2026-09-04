import type { CardDefinition, Effect } from '../../card';

export const youreNotAlone: CardDefinition = {
  name: "You're Not Alone",
  manaCost: '{W}',
  typeLine: 'Instant',

  // "gets +2/+2 ... If you control three or more creatures, it gets +4/+4
  // instead" — a live board-state comparison, same `Computed<number>`
  // shape Beza, the Bounding Spring's own card.ts doc comment already cites
  // as the reference case for this escape hatch (a genuine cross-effect
  // runtime condition, not a fixed value).
  effects: [
    {
      kind: 'pumpTarget',
      power: (ctx) => (ctx.you.getCreaturesInPlay().length >= 3 ? 4 : 2),
      toughness: (ctx) => (ctx.you.getCreaturesInPlay().length >= 3 ? 4 : 2),
    } satisfies Effect,
  ],
};
