import type { CardDefinition } from '../../card';

export const warrenElder: CardDefinition = {
  name: 'Warren Elder',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Rabbit Cleric',
  activationCost: '{3}{W}',

  // Real Forge `A:AB$ PumpAll | ... | NumAtt$ +1 | NumDef$ +1 |
  // SpellDescription$ Creatures you control get +1/+1 until end of turn.`
  // (tmp/mtg-forge/forge-gui/res/cardsfolder/w/warren_elder.txt) — real CR
  // 514.2 Cleanup removal, `untilEndOfTurn:true` genuinely required (this
  // effect was missing it, same systemic omission bug class fixed pool-wide
  // this session).
  effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 1, toughness: 1, untilEndOfTurn: true }],
};
