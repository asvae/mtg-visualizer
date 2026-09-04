import type { CardDefinition, Effect } from '../../card';

export const zellDincht: CardDefinition = {
  name: 'Zell Dincht',
  manaCost: '{2}{R}',
  typeLine: 'Legendary Creature — Human Monk',

  pt: [0, 3],

  // Real `S:Mode$ Continuous | Affected$ You | AdjustLandPlays$ 1` (extra
  // land drop) and `S:Mode$ Continuous | Affected$ Card.Self | AddPower$ X
  // | SVar:X:Count$Valid Land.YouCtrl` (power = lands you control) — the
  // second is a real layer-7a CDA, but neither of card.ts's own two
  // `ptFormula` shapes (`addPerEquipmentControlled`, `setToCreaturesControlled`)
  // covers "power scales with lands controlled" — card.ts's own doc
  // comment on `ptFormula` explicitly says a formula over a different
  // count "stays `staticAbilities` text until a real card needs it," so
  // both statics stay freeform text rather than a fabricated `ptFormula`
  // variant.
  staticAbilities: [
    'You may play an additional land on each of your turns.',
    'Zell Dincht gets +1/+0 for each land you control.',
  ],

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
