import type { CardDefinition } from '../../card';

export const selflessSafewright: CardDefinition = {
  name: 'Selfless Safewright',
  manaCost: '{3}{G}{G}',
  typeLine: 'Creature — Elf Warrior',
  pt: [4, 2],
  keywords: ['Flash', 'Convoke'],

  // "Choose a creature type. Other permanents you control of that type
  // gain hexproof and indestructible until end of turn" has no per-
  // permanent "chosen type" state to track (same gap cavern-of-souls'
  // own ETB choice hits) — the GRANT itself is real and immediate (unlike
  // Cavern's later-referenced restriction), but with no way to pick which
  // type, there's no honest way to pick a target pool either — documentary.
  staticAbilities: [
    'When this creature enters, choose a creature type. Other permanents you control of that type gain hexproof and indestructible until end of turn.',
  ],
};
