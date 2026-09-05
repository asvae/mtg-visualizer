import type { CardDefinition } from '../../card';

export const elvishArchdruid: CardDefinition = {
  name: 'Elvish Archdruid',
  manaCost: '{1}{G}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [2, 2],

  // Both real abilities are documentary-only: the anthem has no ptFormula
  // shape for "other creatures of a subtype get a flat bonus" (only
  // addPerEquipmentControlled/setToCreaturesControlled exist — same gap
  // Thranduil, Sindarin Liege's own anthem hits); the mana ability has NO
  // engine support at all (this model has no mana-pool/addMana concept
  // anywhere — interfaces.ts's own harness assumes unlimited mana for
  // casting, never tracks a produced amount), same documented gap
  // ultima-origin-of-oblivion's own "tap a land" static already established.
  staticAbilities: ['Other Elf creatures you control get +1/+1.', '{T}: Add {G} for each Elf you control.'],
};
