import type { Scenario } from '../../harness';

// One real scenario, per the standing "default 1, real basic function" rule
// (SYNERGY_DESIGN.md) — this card has exactly one real mode, no "Choose
// one"/Tiered branching. Demonstrates the card's own two real, sequential
// effects: surveil 2 (log-only, see definition.ts), then counter the chosen
// spell. The "unless its controller pays {1} for each card in your
// graveyard" tax is a documented, honest engine gap (no "pay N or else"
// mid-resolution player-choice primitive exists anywhere in this codebase —
// see definition.ts/progress.json) — this scenario can't show a real
// declined-payment branch, only the unconditional counter the engine always
// resolves to.
export const scenarios: Scenario[] = [{ result: 'surveils 2, then counters the chosen spell' }];
