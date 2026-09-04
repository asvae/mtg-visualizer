import type { CardDefinition, Effect } from '../../card';

// Real script (rabanastre_royal_city.txt) — same real "enters tapped"
// replacement effect and mana-ability-as-text treatment as
// treno-dark-city's own doc comment explains in full; only the two colors
// produced differ.
export const rabanastreRoyalCity: CardDefinition = {
  name: 'Rabanastre, Royal City',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['{T}: Add {R} or {W}.'],
};
