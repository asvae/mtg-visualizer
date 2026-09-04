import type { CardDefinition, Effect } from '../../card';

// Real preexisting Magic card (not FIN-original), reprinted into this set —
// same "confirm the real Forge script still exists for it" deal as Dark
// Confidant's own assignment note.
export const darkConfidant: CardDefinition = {
  name: 'Dark Confidant',
  manaCost: '{1}{B}',
  typeLine: 'Creature — Human Wizard',

  pt: [2, 1],

  triggers: [
    {
      name: 'onUpkeep',
      effects: [
        // "Reveal the top card of your library and put that card into your
        // hand" — `dig(qty:1, take:1)` with no `validType` filter (matches
        // anything) is exactly "look at the top 1, take it to hand." "You
        // lose life equal to its mana value" — no Card/RealCard field
        // anywhere in this model tracks a card's own mana value (same
        // real, already-documented gap ninja-s-blades/phoenix-down/
        // summon-bahamut's own comments flag), so the real amount is
        // supplied via `triggerInput` (a scenario's own fixed variable
        // info, same convention ninja-s-blades' own `discardedCardManaValue`
        // uses) rather than guessed at.
        { kind: 'dig', qty: 1, take: 1 } satisfies Effect,
        { kind: 'loseLife', owner: 'you', amount: (ctx) => (ctx.triggerInput?.revealedCardManaValue as number) ?? 0 } satisfies Effect,
      ],
    },
  ],
};
