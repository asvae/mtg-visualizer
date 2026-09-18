import type { CardDefinition } from '../../card';

export const kellanPlanarTrailblazer: CardDefinition = {
  name: 'Kellan, Planar Trailblazer',
  manaCost: '{R}',
  typeLine: 'Legendary Creature — Human Faerie Scout',
  pt: [2, 1],

  missingSchemaFunctionality: [
    {
      clause:
        'If Kellan is a Scout, it becomes a Human Faerie Detective and gains "Whenever Kellan deals combat damage to a player, exile the top card of your library. You may play that card this turn."',
      demand: 'A conditional (subtype-gated) type-change plus DYNAMIC installation of a brand-new triggered ability at the moment of resolution — no `Effect`/`Trigger` primitive changes a permanent\'s types conditionally on its OWN current subtype, and nothing can attach a NEW `Trigger` to a card at runtime (every `Trigger` this schema supports is fixed at authoring time in `CardDefinition.triggers`).',
    },
    {
      clause: 'If Kellan is a Detective, it becomes a 3/2 Human Faerie Rogue and gains double strike',
      demand: 'Same subtype-conditional type-change gap as the first ability, PLUS a type-dependent P/T override (3/2 only once Kellan is specifically a Detective) — `ptFormula`/`pt` are both static/unconditional, neither can branch on the permanent\'s own current type membership.',
    },
  ],
};
