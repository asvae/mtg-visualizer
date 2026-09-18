import type { CardDefinition } from '../../card';

// FLAG: X damage with excess tracking and proportional token creation (capacity gap)
// Real card ability: Goblin Negotiation deals X damage to target creature.
// Create a number of 1/1 red Goblin creature tokens equal to the amount of
// excess damage dealt to that creature this way.
//
// Missing infrastructure:
// (1) X variable mana cost support (ManaCost: X R R)
// (2) Excess damage tracking (damage dealt - creature toughness at resolution)
// (3) Dynamic token creation count based on tracked value

export const goblinNegotiation: CardDefinition = {
  name: 'Goblin Negotiation',
  manaCost: '{X}{R}{R}',
  typeLine: 'Sorcery',
};
