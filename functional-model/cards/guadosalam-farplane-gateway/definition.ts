import type { CardDefinition, Effect } from '../../card';

// Real script (guadosalam_farplane_gateway.txt) — same real "enters tapped"
// replacement effect and mana-ability-as-text treatment as
// treno-dark-city's own doc comment explains in full; only the two colors
// produced differ.
export const guadosalamFarplaneGateway: CardDefinition = {
  name: 'Guadosalam, Farplane Gateway',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['{T}: Add {G} or {U}.'],
};
