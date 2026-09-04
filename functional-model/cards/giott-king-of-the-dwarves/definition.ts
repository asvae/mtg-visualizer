import type { CardDefinition, Effect } from '../../card';

export const giottKingOfTheDwarves: CardDefinition = {
  name: 'Giott, King of the Dwarves',
  manaCost: '{R}{W}',
  typeLine: 'Legendary Creature — Dwarf Noble',

  pt: [1, 1],
  keywords: ['DoubleStrike'],

  triggers: [
    {
      // Real script unifies THREE ValidCard clauses (Card.Self, Dwarf.Other
      // +YouCtrl, Equipment.YouCtrl) into one T: line — one named trigger
      // here covers all three real triggering events. "You may discard a
      // card. If you do, draw a card" has no conditional-on-actually-
      // discarding gate in this model (same documentary-only class as
      // `sacrifice`/`move`'s own `optional` field) — `discard` always
      // discards up to `qty` when available, so `drawCard` unconditionally
      // following it is the honest approximation, not a "may."
      name: 'onDwarfOrEquipmentEnters',
      effects: [{ kind: 'discard', owner: 'you', qty: 1 } satisfies Effect, { kind: 'drawCard' } satisfies Effect],
    },
  ],
};
