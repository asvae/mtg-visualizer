import type { CardDefinition } from '../../card';

export const sireOfSevenDeaths: CardDefinition = {
  name: 'Sire of Seven Deaths',
  manaCost: '{7}',
  typeLine: 'Creature — Eldrazi',
  pt: [7, 7],
  keywords: ['Reach', 'FirstStrike', 'Vigilance', 'Menace', 'Trample', 'Lifelink', 'Ward'],

  // Real "Ward—Pay 7 life." `card.ts`'s own `Keyword` union has NO field
  // anywhere for a keyword's cost parameter — `Ward` is a bare literal, so
  // the base "recognized-but-inert Ward" fact is tracked above, but the
  // SPECIFIC non-default cost ("pay 7 life," not the more common
  // mana-cost Ward template) has no schema field to live in and would
  // otherwise be silently dropped. GENUINE CAPACITY GAP, same real
  // "Ward—Pay N life" shape raubahn-bull-of-ala-mhigo (FIN pool)/
  // zul-ashur-lich-lord (this pool) already document — declared here via
  // `staticAbilities` (not a `custom` no-op placeholder — this card has no
  // ability to attach one to) so the existing staticAbilities-presence
  // gate (2026-09-18) catches it structurally instead of leaving it a
  // comment-only, gate-invisible gap.
  staticAbilities: ['Ward—Pay 7 life. (the "pay 7 life" cost specifically — not the base Ward keyword fact, already tracked above)'],
};
