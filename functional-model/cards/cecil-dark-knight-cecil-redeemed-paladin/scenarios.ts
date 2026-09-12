import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { cecilDarkKnight } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'you lose 2 life (18 remaining); above half starting life, no transform',
    trigger: 'onDealsDamage',
    triggerInput: { damageAmount: 2 },
  },
  {
    result: 'you lose 5 life (7 remaining, at or below half of 20); untaps and transforms into Cecil, Redeemed Paladin',
    trigger: 'onDealsDamage',
    you: { life: 12 },
    triggerInput: { damageAmount: 5 },
  },
  {
    result: 'other attacking creatures gain indestructible until end of turn (not mechanically enforced)',
    face: 'back',
    trigger: 'onAttacks',
    you: { creaturesCount: 1 },
  },
  // Back face's own real printed Lifelink (Cecil, Redeemed Paladin) — real
  // lifegain SOURCE fact restored 2026-09-12 (CR 702.15e: Lifelink
  // deterministically produces a real lifegain event on ANY damage dealt,
  // unlike a purely passive/no-event keyword — see SYNERGY_DESIGN.md's own
  // dated entry). `keywordScenarios` below only ever checks the FRONT
  // face's own `card.keywords` (no face-awareness), so it can't cover this
  // — same manual `{face:'back', dealsCombatDamage:...}` probe shape
  // `keywordScenarios`'s own front-face version already uses.
  { result: 'Lifelink: deals 3 combat damage to an opponent, gains that much life', face: 'back', dealsCombatDamage: { amount: 3 } },
  ...keywordScenarios(cecilDarkKnight),
];
