import type { CardDefinition } from '../../card';

export const scorpionSentinel: CardDefinition = {
  name: 'Scorpion Sentinel',
  manaCost: '{1}{U}',
  typeLine: 'Artifact Creature — Robot Scorpion',

  pt: [1, 4],

  // "As long as you control seven or more lands, this creature gets
  // +3/+0" — a conditional continuous P/T buff keyed off LAND COUNT, not
  // Equipment-count or creature-count (the only two live `ptFormula`
  // shapes built so far — see card.ts's own doc comment). Kept as real
  // text, same treatment every other conditional static buff here gets
  // (Kain's own "Jump" flying grant, e.g.) rather than forcing a third
  // ptFormula variant for one card.
  staticAbilities: ['As long as you control seven or more lands, this creature gets +3/+0.'],
};
