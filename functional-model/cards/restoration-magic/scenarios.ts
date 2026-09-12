import type { Scenario } from '../../harness';

// 3 scenarios, one per real Tiered tier (2026-09-12 correction — reverses
// the earlier "one escalating effect, not a modal" call). User's own
// standing clarification: "Tiered" counts as real branching for SCENARIO
// purposes, same as an explicit "Choose one —" modal (Phoenix Down) — each
// of Cure/Cura/Curaga is its own real cost+effect tier, not an edge-case
// variant of the others (SYNERGY_DESIGN.md's own dated entry). This does
// NOT reopen the separate FACT-modeling decision (still one escalating set
// of facts, not 3 duplicated per-tier sets) — only the scenario count.
export const scenarios: Scenario[] = [
  {
    result: 'Cure: the target permanent gains hexproof and indestructible until end of turn (no lifegain at this tier)',
    mode: 0,
    you: { creaturesCount: 1 },
  },
  {
    result: 'Cura: the target permanent gains hexproof and indestructible until end of turn; you gain 3 life',
    mode: 1,
    you: { creaturesCount: 1 },
  },
  {
    result: 'Curaga: creatures and artifacts you control gain hexproof and indestructible until end of turn; you gain 6 life',
    mode: 2,
    you: { creaturesCount: 2, artifactsCount: 1 },
  },
];
