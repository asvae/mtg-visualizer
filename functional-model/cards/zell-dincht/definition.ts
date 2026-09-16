import type { CardDefinition, Effect } from '../../card';

export const zellDincht: CardDefinition = {
  name: 'Zell Dincht',
  manaCost: '{2}{R}',
  typeLine: 'Legendary Creature — Human Monk',

  pt: [0, 3],

  // Real `S:Mode$ Continuous | Affected$ You | AdjustLandPlays$ 1` (extra
  // land drop) — a real per-player play-permission static; no "additional
  // land drop" tracking exists anywhere in this engine's turn structure
  // (a real, separate, still-open gap), so this half stays text.
  // `S:Mode$ Continuous | Affected$ Card.Self | AddPower$ X |
  // SVar:X:Count$Valid Land.YouCtrl` (power = lands you control) is now
  // real, executable `ptFormula.kind:'addPerLandControlled'` (2026-09-16,
  // static-ability audit follow-up — same ADD-scaling shape
  // `addPerEquipmentControlled` already establishes, just counting lands
  // instead of Equipment).
  staticAbilities: [
    'You may play an additional land on each of your turns.',
    'Zell Dincht gets +1/+0 for each land you control.',
  ],
  ptFormula: { kind: 'addPerLandControlled', power: 1, toughness: 0 },

  triggers: [
    {
      // Real `Hidden$ True | Mandatory$ True | ChangeType$ Land.YouCtrl |
      // ChangeNum$ 1` — an UNCHOSEN, mandatory batch bounce, `move`'s own
      // `target: false` shape.
      name: 'onEndStep',
      effects: [{ kind: 'move', owner: 'you', from: 'Battlefield', to: 'Hand', qty: 1, validType: 'land', target: false } satisfies Effect],
    },
  ],
};
