import type { CardDefinition, Effect } from '../../card';

export const ultimaOriginOfOblivion: CardDefinition = {
  name: 'Ultima, Origin of Oblivion',
  manaCost: '{5}',
  typeLine: 'Legendary Creature — God',

  keywords: ['Flying'],
  staticAbilities: [
    // The continuous consequence of the blight counter ("loses all land
    // types/abilities, has T: Add C") is a real replacement/static-grant
    // effect tied to a counter's presence — this model has no continuous-
    // effect-tied-to-a-counter machinery (layers.ts only tracks P/T and
    // added types, not ability removal/grant), so left as text, same
    // treatment Kain's own "Jump" static gets.
    "For as long as a land has a blight counter on it, it loses all land types and abilities and has \"{T}: Add {C}.\"",
    // A real triggered mana-doubling effect on every land tap — no trigger
    // in this model fires off "a land you control was tapped for mana"
    // (only the named triggers a scenario explicitly picks), so this stays
    // descriptive rather than a fabricated automatic mechanic.
    'Whenever you tap a land for {C}, add an additional {C}.',
  ],

  triggers: [
    {
      name: 'onAttack',
      effects: [{ kind: 'putCounterTarget', validType: 'land', counterType: 'blight', amount: 1, qty: 1 } satisfies Effect],
    },
  ],
};
