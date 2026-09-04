import type { CardDefinition } from '../../card';

// Real script (cloud_planets_champion.txt): a vanilla body plus two
// CONDITIONAL statics, neither a fit for the `keywords` array (real
// always-on K: lines) or `ptFormula` (a fixed characteristic-defining P/T
// formula, not a keyword grant):
//  - "During your turn, as long as NICKNAME is equipped, it has double
//    strike and indestructible" — conditioned on both whose turn it is AND
//    a live "is this equipped" state; `grantKeywordSelf`/`keywords` both
//    grant unconditionally, so this stays real staticAbilities text (same
//    "conditional CDA stays text" boundary card.ts's own `ptFormula` doc
//    comment states explicitly).
//  - "Equip abilities you activate that target NICKNAME cost {2} less to
//    activate" — a real cost-reduction static; no cost-reduction machinery
//    exists anywhere in this model (a documented STILL-DEFERRED gap), so
//    text only.
export const cloudPlanetsChampion: CardDefinition = {
  name: "Cloud, Planet's Champion",
  manaCost: '{3}{R}{W}',
  typeLine: 'Legendary Creature — Human Soldier Mercenary',

  pt: [4, 4],

  staticAbilities: [
    'During your turn, as long as Cloud is equipped, it has double strike and indestructible.',
    'Equip abilities you activate that target Cloud cost {2} less to activate.',
  ],
};
