import type { Scenario } from '../../harness';

// Still the old declarative `harness.ts` shape (2026-09-16, equip-trigger
// auto-dispatch pass) — `definition.ts`'s own `onEquippedAttacksFirstCombat`
// trigger now carries a real `on: 'equippedAttacks'` (engine.ts's widened
// `fireOnAttackTriggers` genuinely auto-fires it off a real declared
// attacker, see card.ts's own `Trigger.on` doc comment), but this file
// wasn't migrated to a real engine-piloted trace (`engine-trace.ts`) in the
// SAME pass — sage-s-nouliths'/White Mage's Staff's own identical
// migrations are the template to follow here; deferred for scope, not
// forgotten (this card was a bonus whole-pool find, not this pass's own
// named target). The `trigger: 'onEquippedAttacksFirstCombat'` scenario
// below still works exactly as before (a manual, declarative name-fire,
// bypassing the real auto-dispatch entirely) — real behavior is unchanged.
export const scenarios: Scenario[] = [
  { result: 'attaches to the target creature you control', you: { creaturesCount: 1 } },
  {
    result: "self has no equipped creature yet (this scenario's own setup doesn't attach it first, so nothing is untapped); the additional-combat-phase clause is not modeled",
    trigger: 'onEquippedAttacksFirstCombat',
  },
];
