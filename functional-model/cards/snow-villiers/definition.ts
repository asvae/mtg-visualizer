import type { CardDefinition } from '../../card';

export const snowVilliers: CardDefinition = {
  name: 'Snow Villiers',
  manaCost: '{2}{W}',
  typeLine: 'Legendary Creature — Human Rebel Monk',

  // Real `PT:*/3` — power is `*` (fully dynamic, see `ptFormula` below),
  // toughness is a real fixed printed 3, not itself part of the CDA.
  pt: [0, 3],
  keywords: ['Vigilance'],
  // Real `SetPower$ X | CharacteristicDefining$ True` (POWER only — see
  // card.ts's own `ptFormula` doc comment for why toughness above is
  // separate).
  ptFormula: { kind: 'setToCreaturesControlled' },
};
