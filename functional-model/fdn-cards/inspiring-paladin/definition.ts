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
  // "demand" would misrepresent it. See the sibling `justification.json`.
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

  // Coverage-justification manifest — moved out to a real, SPAN-VERIFIED
  // functional-model/fdn-cards/inspiring-paladin/justification.json
  // (2026-09-18, later still — the justification.json redesign, see
  // `.claude/contracts/card-schema.md`). No longer an inline field on
  // CardDefinition at all — see coverage-justification.ts's own header.
  // This was the FIRST real, checked-in card this whole redesign started
  // from (the original silent-gap bug: this card was `blue` with zero
  // reasons despite a whole real ability left completely unmodeled).
};
