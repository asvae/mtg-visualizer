import type { CardDefinition, Effect } from '../../card';

export const blasphemousEdict: CardDefinition = {
  name: 'Blasphemous Edict',
  manaCost: '{3}{B}{B}',
  typeLine: 'Sorcery',

  missingSchemaFunctionality: [
    {
      clause: "You may pay {B} rather than pay this spell's mana cost if there are thirteen or more creatures on the battlefield.",
      demand: 'A board-state-CONDITIONAL alternate-cost vocabulary — `AlternateCost` today is fixed to `from: \'graveyard\'|\'exile\'` zone-based alternates only; need a variant gated on a live board-state count threshold (Forge\'s own `AlternativeCost` + `IsPresent$`/`PresentCompare$` pairing) rather than a zone change.',
    },
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
