import type { CardDefinition } from '../../card';

// Real Forge (twinflame_tyrant.txt): `R:Event$ DamageDone | ValidSource$
// Card.YouCtrl,Emblem.YouCtrl | ValidTarget$ Opponent,Permanent.OppCtrl |
// ReplaceWith$ DmgTwice` — a real CR 614.2 damage-doubling replacement
// scoped to damage YOU deal to an OPPONENT/their permanents. Distinct from
// the existing `'LifegainDouble'`-style approximated replacement keywords
// (which only ever double the CONTROLLER's own lifegain/coin-flip
// outcomes) — no doubling-outgoing-damage replacement exists in this
// engine's `Keyword` union at all.
export const twinflameTyrant: CardDefinition = {
  name: 'Twinflame Tyrant',
  manaCost: '{3}{R}{R}',
  typeLine: 'Creature — Dragon',
  pt: [3, 5],
  keywords: ['Flying'],

  missingSchemaFunctionality: [
    {
      clause: 'If a source you control would deal damage to an opponent or a permanent an opponent controls, it deals double that damage instead.',
      demand:
        'Needs a real CR 614.2 damage-doubling replacement scoped to "damage YOU deal to an opponent/their permanents" — the existing `Keyword` union only has `LifegainDouble` (life-gain) and `TwoHeadedCoin` (coin flips), no outgoing-damage-doubling variant.',
    },
  ],
};
