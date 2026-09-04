import type { CardDefinition, Effect } from '../../card';

// Real script (vanille_cheerful_lcie_ragnarok_divine_deliverance.txt) has a
// SECOND real ability this model can't build at all: `AB$ Meld` — meld into
// Ragnarok, Divine Deliverance is explicitly OUT OF SCOPE ("no meld
// mechanic" — this batch's own deferred-gaps list). That whole trigger
// (the "at the beginning of your first main phase..." one) is omitted
// entirely, same partial-build precedent choco-comet already set (build the
// buildable half, cite the gap for the rest) rather than skipping the card
// outright — the ETB below is fully real and fully buildable.
export const vanilleCheerfulLCie: CardDefinition = {
  name: "Vanille, Cheerful l'Cie",
  manaCost: '{3}{G}',
  typeLine: 'Legendary Creature — Human Cleric',

  pt: [3, 2],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        { kind: 'move', owner: 'you', from: 'Library', to: 'Graveyard', qty: 2 } satisfies Effect,
        // Real `ChangeType$ Permanent.YouOwn` — no 'permanent' validType
        // exists on `move` (only 'creature'/'artifact'/'land'/'any'), same
        // gap ambrosia-whiteheart's own "return ANOTHER permanent you
        // control" already hit; `validType` omitted (defaults to 'any'),
        // same accepted approximation that card uses.
        { kind: 'move', owner: 'you', from: 'Graveyard', to: 'Hand', qty: 1, target: true } satisfies Effect,
      ],
    },
  ],
};
