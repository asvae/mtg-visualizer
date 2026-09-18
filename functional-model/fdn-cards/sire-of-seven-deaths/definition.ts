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
  // zul-ashur-lich-lord (this pool) already document — declared via
  // `missingSchemaFunctionality` (migrated out of `staticAbilities`,
  // 2026-09-18, FDN schema-tightness redesign) so it stays a structural,
  // gate-visible `reasons` entry, not only a comment.
  missingSchemaFunctionality: [
    {
      clause: 'Ward—Pay 7 life. (the "pay 7 life" cost specifically — not the base Ward keyword fact, already tracked above)',
      demand: '`Keyword` needs a cost-payload field for a non-default Ward cost — currently a bare string-literal union with no place to record "Pay 7 life" (or any other non-mana-cost Ward template) at all.',
    },
  ],

  // Coverage-justification manifest — moved out to a real, SPAN-VERIFIED
  // functional-model/fdn-cards/sire-of-seven-deaths/justification.json
  // (2026-09-18, later still — the justification.json redesign, see
  // `.claude/contracts/card-schema.md`). No longer an inline field on
  // CardDefinition at all — see coverage-justification.ts's own header.
  // Real printed oracle text turned out to be 4 separate lines ("Reach,
  // first strike\nVigilance, menace\nTrample, lifelink\nWard—Pay 7 life."),
  // not the single comma-separated line this comment previously (wrongly)
  // described — confirmed against the real, checked-in
  // `data/fdn/fdn_scryfall.json` while authoring the span-verified
  // manifest; the justification.json entries reflect the REAL text.
};
