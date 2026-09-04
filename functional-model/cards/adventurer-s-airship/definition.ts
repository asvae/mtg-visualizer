import type { CardDefinition, Effect } from '../../card';

export const adventurersAirship: CardDefinition = {
  name: "Adventurer's Airship",
  manaCost: '{3}',
  typeLine: 'Artifact — Vehicle',

  // Real printed base P/T — a Vehicle carries one even though it isn't a
  // creature (so doesn't match `typesFromTypeLine`'s Creature check) until
  // crewed, same convention cargo-ship's own comment documents.
  pt: [3, 2],
  keywords: ['Flying'],
  crewCost: 2,

  triggers: [
    {
      name: 'onAttacks',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect],
    },
  ],
};
