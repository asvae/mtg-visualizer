import type { CardDefinition, Effect } from '../../card';

export const clawsOut: CardDefinition = {
  name: 'Claws Out',
  manaCost: '{3}{W}{W}',
  typeLine: 'Instant',

  // Affinity for Cats (This spell costs {1} less to cast for each Cat you control.)
  costReduction: { perControlled: { amountPerMatch: 1, subtype: 'Cat' } },

  // Creatures you control get +2/+2 until end of turn.
  effects: [
    {
      kind: 'pumpAll',
      predicate: 'creatures-you-control',
      power: 2,
      toughness: 2,
      untilEndOfTurn: true,
    } satisfies Effect,
  ],

  // Coverage-justification manifest (2026-09-18, FDN schema-tightness
  // redesign proof-of-concept — see `.claude/contracts/card-schema.md`).
  // Real printed oracle text, 2 clauses: "Affinity for Cats (This spell
  // costs {1} less to cast for each Cat you control.)\nCreatures you
  // control get +2/+2 until end of turn." Zero `missingSchemaFunctionality`
  // entries — both clauses are fully, structurally covered.
  coverageJustification: [
    {
      clause: 'Affinity for Cats (This spell costs {1} less to cast for each Cat you control.)',
      coveredBy: { kind: 'field', field: 'costReduction' },
      reasoning: "This card's own `costReduction: {perControlled: {amountPerMatch: 1, subtype: 'Cat'}}` is the exact CR 601.2f per-Cat-controlled discount this clause describes — one generic mana discounted per matching Cat, no cap printed.",
    },
    {
      clause: 'Creatures you control get +2/+2 until end of turn.',
      coveredBy: { kind: 'effect', effectKind: 'pumpAll' },
      reasoning: "This card's own top-level `pumpAll` effect (`{predicate:'creatures-you-control', power:2, toughness:2, untilEndOfTurn:true}`) is the exact broadcast P/T pump this clause describes, scoped to the caster's own creatures and expiring at Cleanup (514.2).",
    },
  ],
};
