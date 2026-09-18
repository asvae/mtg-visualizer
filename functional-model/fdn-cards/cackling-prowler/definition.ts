import type { CardDefinition } from '../../card';

// Real Forge (cackling_prowler.txt): `K:Ward:2` (default mana-cost Ward
// template, no `keywordCosts` entry needed — see sire-of-seven-deaths' own
// non-default-cost precedent for the split). `T:Mode$ Phase | Phase$ End of
// Turn | CheckSVar$ Morbid | ... | SVar:Morbid:Count$Morbid.1.0` — same
// genuine Morbid capacity gap `slumbering-cerberus`/`tragic-banshee`
// already document (no "did a creature die this turn" tracking anywhere in
// this engine).
export const cacklingProwler: CardDefinition = {
  name: 'Cackling Prowler',
  manaCost: '{3}{G}',
  typeLine: 'Creature — Hyena Rogue',
  pt: [4, 3],
  keywords: ['Ward'],

  missingSchemaFunctionality: [
    {
      clause: 'Morbid — At the beginning of your end step, if a creature died this turn, put a +1/+1 counter on this creature.',
      demand:
        'No "did a creature died this turn" (Morbid) tracking exists anywhere in this engine — `BoardStateCondition` only has `graveyardCountAtLeast`/`attackedThisTurn`/`selfCounterCountAtLeast`.',
    },
  ],
};
