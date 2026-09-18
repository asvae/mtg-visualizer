import type { CardDefinition, Effect } from '../../card';

export const blasphemousEdict: CardDefinition = {
  name: 'Blasphemous Edict',
  manaCost: '{3}{B}{B}',
  typeLine: 'Sorcery',

  // Real Forge: `S:Mode$ AlternativeCost | Cost$ B | IsPresent$ Creature |
  // PresentCompare$ GE13` — "You may pay {B} rather than pay this spell's
  // mana cost if there are thirteen or more creatures on the battlefield."
  // A board-state-CONDITIONAL alternate cost — genuinely different from
  // `AlternateCost` (that shape is fixed to `from: 'graveyard'|'exile'`,
  // real Flashback/Jump-start territory; this is a same-zone (hand) cost
  // SWAP gated on a creature-count threshold). No such conditional-cost
  // vocabulary exists anywhere in this engine; kept as free text only,
  // same fallback CardDefinition's own `staticAbilities` doc comment
  // describes for "a real Forge K:/S: line not yet in the controlled
  // list."
  staticAbilities: [
    "You may pay {B} rather than pay this spell's mana cost if there are thirteen or more creatures on the battlefield.",
  ],

  effects: [
    {
      kind: 'sacrifice',
      owner: 'each',
      validType: 'creature',
      qty: 13,
    } satisfies Effect,
  ],
};
