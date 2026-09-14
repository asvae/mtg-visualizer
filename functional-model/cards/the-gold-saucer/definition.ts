import type { CardDefinition, Effect } from '../../card';

// Real script (the_gold_saucer.txt): no `R:Event$ Moved ... ReplaceWith$
// ETBTapped` line — The Gold Saucer genuinely enters UNTAPPED.
//
// Three real activated abilities:
//  - "{T}: Add {C}" — a real, structured `manaAbilities` entry, genuinely
//    payable via `mana.ts`'s `canAfford`/`payMana`.
//  - "{2}, {T}: Flip a coin. If you win the flip, create a Treasure
//    token." — a real, genuinely probabilistic outcome (`AB$ FlipCoin`);
//    there is no coin-flip/random-outcome mechanism anywhere in this
//    model (no `Computed` field or Effect kind can express "maybe this
//    happens, maybe it doesn't, 50/50" — every other conditional this
//    model has is either a deterministic board-state check or the
//    documentary-only "optional" convention, neither of which fits a real
//    coin flip), so this stays static text rather than being modeled as
//    an unconditional token creation (which would misrepresent it).
//  - "{3}, {T}, Sacrifice two artifacts: Draw a card." — the ONE real
//    ability here that fits: the sacrifice is part of the COST (Forge's
//    own `Cost$ 3 T Sac<2/Artifact>`, same "cost, not effect" convention
//    phoenix-down's/warren-elder's own tap/sacrifice cost text uses), so
//    only "draw a card" is a declarative effect.
export const theGoldSaucer: CardDefinition = {
  name: 'The Gold Saucer',
  manaCost: '',
  typeLine: 'Land — Town',

  staticAbilities: ['{2}, {T}: Flip a coin. If you win the flip, create a Treasure token.'],
  manaAbilities: [{ colors: ['C'] }],

  activationCost: '{3}, {T}, Sacrifice two artifacts',
  effects: [{ kind: 'drawCard' } satisfies Effect],
};
