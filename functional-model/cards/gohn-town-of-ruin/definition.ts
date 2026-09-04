import type { CardDefinition, Effect } from '../../card';

// Real script (gohn_town_of_ruin.txt) — same real "enters tapped"
// replacement effect and mana-ability-as-text treatment as
// treno-dark-city's own doc comment explains in full (see that card, a
// different agent's own FIN batch, for the citation); only the two colors
// produced differ.
export const gohnTownOfRuin: CardDefinition = {
  name: 'Gohn, Town of Ruin',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['{T}: Add {B} or {G}.'],
};
