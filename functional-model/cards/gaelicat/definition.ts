import type { CardDefinition } from '../../card';

export const gaelicat: CardDefinition = {
  name: 'Gaelicat',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Cat',

  keywords: ['Flying', 'Vigilance'],
  // A conditional continuous P/T ability, presence-gated — a different
  // shape than adelbert-steiner's own count-scaling `ptFormula` CDA (a
  // fixed on/off threshold, not "+X per N controlled"), so it doesn't fit
  // that field; stays real text rather than an invented threshold-CDA
  // mechanism this model doesn't have yet.
  staticAbilities: ['As long as you control two or more artifacts, this creature gets +2/+0.'],
};
