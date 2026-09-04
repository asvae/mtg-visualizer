import type { CardDefinition } from '../../card';

export const hillGigas: CardDefinition = {
  name: 'Hill Gigas',
  manaCost: '{4}{R}{R}',
  typeLine: 'Creature — Giant',

  pt: [5, 4],
  keywords: ['Trample', 'Haste'],
  // Mountaincycling {2} — a real alternate ACTIVATED-from-hand ability
  // (discard this card + pay {2}: search for a Mountain), not a cast-time
  // alternate cost and not an activated ability on a battlefield permanent
  // — no `CardDefinition` field fits it (same gap cloudbound-moogle's own
  // Plainscycling and malboro's own Swampcycling already document). Real
  // text only.
  staticAbilities: ['Mountaincycling {2} ({2}, Discard this card: Search your library for a Mountain card, reveal it, put it into your hand, then shuffle.)'],
};
