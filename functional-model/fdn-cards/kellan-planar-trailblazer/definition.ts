import type { CardDefinition } from '../../card';

// FLAG: Type-changing abilities with dynamic trigger installation (capacity gap)
// Real card abilities from Scryfall/Forge:
// [1R]: If Kellan is a Scout, it becomes a Human Faerie Detective and gains
//       "Whenever Kellan deals combat damage to a player, exile the top card of your library.
//        You may play that card this turn."
// [2R]: If Kellan is a Detective, it becomes a 3/2 Human Faerie Rogue and gains double strike.
//
// Missing infrastructure:
// (1) Conditional type-change (animate effect: check hasSubtype, change types)
// (2) Dynamic trigger installation (add triggered ability at runtime when type changes)
// (3) Type-dependent P/T overrides in the same ability

export const kellanPlanarTrailblazer: CardDefinition = {
  name: 'Kellan, Planar Trailblazer',
  manaCost: '{R}',
  typeLine: 'Legendary Creature — Human Faerie Scout',
  pt: [2, 1],
};
