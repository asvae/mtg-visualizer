import type { CardDefinition, Effect } from '../../card';

export const reachTheHorizon: CardDefinition = {
  name: 'Reach the Horizon',
  manaCost: '{3}{G}',
  typeLine: 'Sorcery',

  effects: [
    // "Search your library for up to two basic land cards and/or Town
    // cards with different names" — a search (601.2c, no stack targeting),
    // `target` stays omitted, same convention Prishe's Wanderings/call-
    // the-mountain-chocobo already use. `'land'` is the closest `validType`
    // fit (Town cards are Land-typed in this set) — same real, untestable
    // gap as Prishe's Wanderings (no land-typed `PlayerState` library
    // filler exists). "Different names" and "tapped" are both lost, same
    // documentary-loss class as Prishe's Wanderings' own "tapped" note.
    { kind: 'move', owner: 'you', from: 'Library', to: 'Battlefield', qty: 2, validType: 'land' } satisfies Effect,
  ],
};
