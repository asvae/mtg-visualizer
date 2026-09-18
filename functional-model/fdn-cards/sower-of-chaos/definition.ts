import type { CardDefinition, Effect } from '../../card';

// Real Forge (sower_of_chaos.txt): `A:AB$ Pump | Cost$ 2 R | ValidTgts$
// Creature | KW$ HIDDEN CARDNAME can't block.` — real, printed `CantBlock`
// keyword (2026-09-18 schema-completeness pass), granted to a chosen
// target for the turn.
export const sowerOfChaos: CardDefinition = {
  name: 'Sower of Chaos',
  manaCost: '{3}{R}',
  typeLine: 'Creature — Devil',
  pt: [4, 3],

  activationCost: '{2}{R}',
  effects: [
    {
      kind: 'grantKeywordTarget',
      keyword: 'CantBlock',
      validType: 'creature',
      untilEndOfTurn: true,
    } satisfies Effect,
  ],
};
