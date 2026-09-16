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
  // Real Forge implicit crew-animate rule (bare `K:Crew:2`, same as
  // `the-lunar-whale`'s/`the-prima-vista`'s own identical Crew mechanic) —
  // this effect was MISSING entirely before 2026-09-15 (fin/16-25 pass), a
  // real correctness gap (this permanent never actually became a creature
  // when crewed): now present, same shape `cargo-ship`/`magitek-armor`
  // already establish.
  effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] } satisfies Effect],

  triggers: [
    {
      name: 'onAttacks',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect],
    },
  ],
};
