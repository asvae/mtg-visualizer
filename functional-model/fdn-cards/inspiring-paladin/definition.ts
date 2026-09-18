import type { CardDefinition } from '../../card';

export const inspiringPaladin: CardDefinition = {
  name: 'Inspiring Paladin',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Human Knight',
  pt: [3, 3],

  // First ability: "During your turn, this creature has first strike." — modeled
  // via continuousKeywordGrants on self. FULLY covered — removed from
  // `staticAbilities` outright (2026-09-18, FDN schema-tightness redesign/
  // migration pass), NOT migrated to missingSchemaFunctionality, since it's
  // not a real gap at all: keeping a covered clause declared as an open
  // "demand" would misrepresent it. See `coverageJustification` below.
  //
  // Second ability: "During your turn, creatures you control with +1/+1 counters
  // on them have first strike." — CANNOT be expressed via current
  // continuousKeywordGrants vocabulary (which filters on subtype, self, or
  // Equipment attachment, not on counter state). Real, genuine gap —
  // declared via `missingSchemaFunctionality` (migrated out of
  // `staticAbilities`).
  missingSchemaFunctionality: [
    {
      clause: 'During your turn, creatures you control with +1/+1 counters on them have first strike.',
      demand: 'A COUNTER-PRESENCE-conditional variant of `continuousKeywordGrants` — the field\'s recipient filter today only supports subtype/self/Equipment-attachment, never "has a counter of type X on it" as the qualifying condition.',
    },
  ],

  continuousKeywordGrants: [
    {
      includeSelf: true,
      onlyDuringYourTurn: true,
      keywords: ['FirstStrike'],
    },
  ],

  // Coverage-justification manifest (2026-09-18, FDN schema-tightness
  // redesign proof-of-concept — see `.claude/contracts/card-schema.md`).
  // Real printed oracle text, 2 sentences: "During your turn, this
  // creature has first strike.\nDuring your turn, creatures you control
  // with +1/+1 counters on them have first strike." — the FIRST real,
  // checked-in card this whole redesign started from (the original
  // silent-gap bug: this card was `blue` with zero reasons despite a
  // whole real ability left completely unmodeled).
  coverageJustification: [
    {
      clause: 'During your turn, this creature has first strike.',
      coveredBy: { kind: 'field', field: 'continuousKeywordGrants' },
      reasoning: "This card's own `continuousKeywordGrants` entry (`{includeSelf:true, onlyDuringYourTurn:true, keywords:['FirstStrike']}`) is the exact self-only, turn-conditional First Strike grant this sentence describes — `state.ts`'s own `effectiveKeywords` reads `onlyDuringYourTurn` live every turn, so this is a real, mechanically-enforced match, not an approximation.",
    },
    {
      clause: 'During your turn, creatures you control with +1/+1 counters on them have first strike.',
      coveredBy: { kind: 'missingSchemaFunctionality', index: 0 },
      reasoning: 'Genuinely uncovered — no field on `continuousKeywordGrants` (or anywhere else) can gate a recipient on "has a +1/+1 counter on it," so this second, independent clause is declared as a real capacity gap rather than silently dropped or conflated with the first (self-only) grant above.',
    },
  ],
};
