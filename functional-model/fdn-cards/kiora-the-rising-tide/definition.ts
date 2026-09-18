import type { CardDefinition, Effect } from '../../card';

export const kioraTheRisingTide: CardDefinition = {
  name: 'Kiora, the Rising Tide',
  manaCost: '{2}{U}',
  typeLine: 'Legendary Creature — Merfolk Noble',
  pt: [3, 2],
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        { kind: 'drawCard', amount: 2 } satisfies Effect,
        { kind: 'discard', owner: 'you', qty: 2 } satisfies Effect,
      ],
    },
    {
      // Real Forge: `Mode$ Attacks | ValidCard$ Card.Self` — a real
      // self-attack auto-fire trigger. Threshold's own "7+ cards in
      // graveyard" gate has no tracking mechanism on `Trigger` — same
      // accepted, already-established pool-wide simplification
      // crypt-feaster's own identical Threshold clause already uses. The
      // "you may create" optionality is likewise unmodeled (no
      // player-decision engine exists — a legal creation always happens,
      // same convention every other `optional` clause in this pool
      // already documents).
      name: 'onAttack',
      on: 'attacks',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Scion of the Deep',
            manaCost: '0',
            types: ['Legendary', 'Creature', 'Octopus'],
            basePower: 8,
            baseToughness: 8,
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
