import type { CardDefinition } from './card';
import type { Scenario } from './harness';

/**
 * A reusable, uniform probe scenario per real, executable keyword/CDA on
 * `card` — Lifelink and the Equipment-count CDA are pilot cases, both from
 * the same conversation: "lifelink we can test by this creature dealing
 * damage. gets equipment - we can test by adding some equipment." Every
 * Lifelink/CDA card gets the SAME probe shape without hand-authoring a
 * bespoke scenario each time (the "template, not spam" ask) — call this
 * once from a card's own scenarios.ts and spread the result in alongside
 * any card-specific scenarios:
 *
 *   export const scenarios: Scenario[] = [...keywordScenarios(card), { ... }];
 *
 * Only covers the keywords/CDAs that actually change resolution behavior
 * (state.dealDamage's Lifelink check, state.effectivePT's CDA read) — a
 * merely-recognized-but-inert keyword (Flying, Menace, ...) has nothing a
 * scenario could exercise, so it gets no probe here.
 */
export function keywordScenarios(card: CardDefinition): Scenario[] {
  const scenarios: Scenario[] = [];
  if (card.keywords?.includes('Lifelink')) {
    scenarios.push({ label: 'Lifelink: deals 3 combat damage to an opponent', dealsCombatDamage: { amount: 3 } });
  }
  if (card.ptFormula?.kind === 'addPerEquipmentControlled') {
    scenarios.push({ label: 'CDA: 2 Equipment on the battlefield (P/T should reflect it)', you: { equipmentCount: 2 } });
    scenarios.push({ label: 'CDA: no Equipment on the battlefield', you: { equipmentCount: 0 } });
  }
  if (card.ptFormula?.kind === 'setToCreaturesControlled') {
    scenarios.push({ label: 'CDA: 3 creatures on the battlefield (P/T should reflect it)', you: { creaturesCount: 3 } });
    scenarios.push({ label: 'CDA: no other creatures on the battlefield', you: { creaturesCount: 0 } });
  }
  // Real 704.5j (see state.ts's own checkLegendRule) — any Legendary card
  // is subject to this, not something a card's own CardDefinition opts into.
  if (/\bLegendary\b/.test(card.typeLine)) {
    scenarios.push({ label: 'Legend rule: a second copy enters', duplicateLegendaryEnters: true });
  }
  return scenarios;
}
