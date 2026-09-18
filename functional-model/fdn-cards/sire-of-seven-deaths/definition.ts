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

  // Coverage-justification manifest (2026-09-18, FDN schema-tightness
  // redesign proof-of-concept — see `.claude/contracts/card-schema.md`).
  // Real printed oracle text (Scryfall, confirmed against the cached
  // `functional-model/.fdn-scratch/sire-of-seven-deaths/scryfall.json`
  // this card's own earlier Ward-gap sweep already used): "Reach, first
  // strike, vigilance, menace, trample, lifelink, ward—Pay 7 life." — one
  // comma-separated static-ability line printing 7 independent keywords
  // (6 fully covered by this card's own `keywords` array, the 7th's base
  // fact also covered there but its own non-default cost genuinely
  // uncovered, declared above). One manifest entry per printed keyword,
  // not one entry for the whole line, so the manifest's own entry count
  // stays a meaningful proxy for "walked every real granted keyword."
  coverageJustification: [
    {
      clause: 'Reach',
      coveredBy: { kind: 'keyword', keyword: 'Reach' },
      reasoning: "Printed keyword, present verbatim in this card's own `keywords` array — the base fact is tracked (this engine doesn't have a dedicated Reach-specific mechanical check beyond block-legality, which this simplified engine doesn't model combat restrictions for at all, but the KEYWORD FACT itself is fully represented).",
    },
    {
      clause: 'first strike',
      coveredBy: { kind: 'keyword', keyword: 'FirstStrike' },
      reasoning: "Printed keyword, present as `'FirstStrike'` in this card's own `keywords` array — same base-fact-tracked coverage as Reach above.",
    },
    {
      clause: 'vigilance',
      coveredBy: { kind: 'keyword', keyword: 'Vigilance' },
      reasoning: "Printed keyword, present in this card's own `keywords` array — same base-fact-tracked coverage as Reach above.",
    },
    {
      clause: 'menace',
      coveredBy: { kind: 'keyword', keyword: 'Menace' },
      reasoning: "Printed keyword, present in this card's own `keywords` array — same base-fact-tracked coverage as Reach above.",
    },
    {
      clause: 'trample',
      coveredBy: { kind: 'keyword', keyword: 'Trample' },
      reasoning: "Printed keyword, present in this card's own `keywords` array — same base-fact-tracked coverage as Reach above.",
    },
    {
      clause: 'lifelink',
      coveredBy: { kind: 'keyword', keyword: 'Lifelink' },
      reasoning: "Printed keyword, present in this card's own `keywords` array — mechanically ENFORCED (not just tracked) by `state.ts`'s own real `dealDamage` chokepoint, per that field's own doc comment.",
    },
    {
      clause: 'ward',
      coveredBy: { kind: 'keyword', keyword: 'Ward' },
      reasoning: "Printed keyword, present in this card's own `keywords` array — the base \"this permanent has Ward\" fact is tracked (recognized-but-inert: no counterspell-trigger machinery exists anywhere in this engine to actually enforce ANY Ward cost, default or otherwise), same established convention `zul-ashur-lich-lord`'s own identical clause already documents.",
    },
    {
      clause: 'ward—Pay 7 life',
      coveredBy: { kind: 'missingSchemaFunctionality', index: 0 },
      reasoning: 'The SPECIFIC non-default cost half of Ward (as opposed to the base Ward keyword fact, covered above) has no schema field to live in at all — declared as a real, structured demand rather than silently dropped.',
    },
  ],
};
