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
    // A real triggered mana-doubling effect on every land tap. Kept as text
    // here too (typeLine/full-ability-text parity with every other card),
    // but — unlike the counter-tied static grant above, which genuinely has
    // no engine machinery to hook into — the "add an additional {C}" HALF
    // of this is a plain, already-real `kind:'addMana'` Effect (same shape
    // Elvish Archdruid's own "{T}: Add {G} for each Elf you control" uses),
    // so it's ALSO wired as the real `onTapLandForC` trigger below. No
    // trigger in this model auto-fires off "a land you control was tapped
    // for mana" (`Trigger.on` only recognizes 'enter'/'upkeep'/'endStep') —
    // same as every other named trigger pool-wide (`onAttack` right below
    // included), this one is manually fired by a scenario, not
    // auto-detected off a real land-tap action.
    'Whenever you tap a land for {C}, add an additional {C}.',
  ],

  triggers: [
    {
      name: 'onAttack',
      effects: [{ kind: 'putCounterTarget', validType: 'land', counterType: 'blight', amount: 1, qty: 1 } satisfies Effect],
    },
    {
      // Fired manually right after a scenario pilots a real land being
      // tapped for {C} — see scenarios.ts. Only models the "additional {C}"
      // Ultima itself adds; the land's own base {C} is its own real
      // addMana line, not this trigger's job to reproduce.
      name: 'onTapLandForC',
      effects: [{ kind: 'addMana', color: 'C', amount: 1 } satisfies Effect],
    },
  ],
};
