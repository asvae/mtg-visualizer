import type { CardDefinition } from '../../card';

export const sireOfSevenDeaths: CardDefinition = {
  name: 'Sire of Seven Deaths',
  manaCost: '{7}',
  typeLine: 'Creature — Eldrazi',
  pt: [7, 7],
  keywords: ['Reach', 'FirstStrike', 'Vigilance', 'Menace', 'Trample', 'Lifelink', 'Ward'],

  // Real "Ward—Pay 7 life." The base "this permanent has Ward" fact is
  // tracked via `keywords` above; the SPECIFIC non-default cost ("pay 7
  // life," not the more common mana-cost Ward template) is now recorded via
  // `keywordCosts` (2026-09-18, schema-completeness pass — `card.ts`'s own
  // new `KeywordCost`/`CardDefinition.keywordCosts` field). Still
  // recognized-but-inert (no counterspell-trigger machinery exists anywhere
  // in this engine to actually enforce any Ward cost, default or
  // otherwise, default or non-default) — same real "Ward—Pay N life" shape
  // raubahn-bull-of-ala-mhigo (FIN pool)/zul-ashur-lich-lord (this pool)
  // share.
  keywordCosts: [{ keyword: 'Ward', cost: 'Pay 7 life' }],

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
