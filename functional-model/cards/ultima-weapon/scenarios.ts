import type { Scenario } from '../../harness';

// Still the old declarative `harness.ts` shape (2026-09-16, equip-trigger
// auto-dispatch pass) — `definition.ts`'s own `onEquippedAttacks` trigger
// now carries a real `on: 'equippedAttacks'` (engine.ts's widened
// `fireOnAttackTriggers` genuinely auto-fires it off a real declared
// attacker, see card.ts's own `Trigger.on` doc comment), but this file
// wasn't migrated to a real engine-piloted trace (`engine-trace.ts`) in the
// SAME pass — sage-s-nouliths'/White Mage's Staff's own identical
// migrations are the template to follow here; deferred for scope, not
// forgotten (this card was a bonus whole-pool find, not this pass's own
// named target). The `trigger: 'onEquippedAttacks'` scenario below still
// works exactly as before (a manual, declarative name-fire, bypassing the
// real auto-dispatch entirely) — real behavior is unchanged.
export const scenarios: Scenario[] = [
  { result: 'enters the battlefield, unattached (no ETB effect)' },
  { result: 'Equip {7} activated: attaches to the target creature', you: { creaturesCount: 1 } },
  { result: "destroys the target creature an opponent controls", trigger: 'onEquippedAttacks', opponents: [{ creaturesCount: 1 }] },
];
