// Real engine-piloted trace (see engine-trace.ts's own header) — REPLACES
// the earlier flat `harness.ts` name-fired `sequence: [..., 'onEquippedAttacks']`
// scenario (2026-09-16, coordinator-routed pilot-triage escalation: the
// granted "untap target ATTACKING creature" ability migrated off a raw
// `custom` closure onto the real declarative `untapTarget` Effect, whose
// `validType: 'attacking'` genuinely reads `Card.isAttacking()` — real CR
// 506.4/508.1 combat status off `state.attackers`, see that method's own
// doc comment). The old declarative `Scenario[]` harness has NO combat/
// attacker-state mechanism at all (`sequence` fires a named trigger
// directly, with no real `declareAttackers` behind it), so it could never
// make `isAttacking()` genuinely true for anything — every creature in
// that pool of scenarios reads as "not attacking," which the OLD unfiltered
// `custom` closure never actually checked (a real, if narrow, pre-migration
// over-broadening the `validType: 'attacking'` migration also fixes: the
// old closure would happily untap ANY creature, not just an attacking one).
// This engine-piloted version declares a REAL attacker via
// `pilotDeclareAttackers` first, so the `untapTarget` effect's own
// `validType: 'attacking'` filter has genuine, real evidence to match.
//
// Widened again (2026-09-16, equip-trigger auto-dispatch pass): the
// `onEquippedAttacks` trigger no longer needs a manual `pilotFireTrigger`
// call at all — `definition.ts`'s own trigger now carries
// `on: 'equippedAttacks'`, and `engine.ts`'s widened `fireOnAttackTriggers`
// auto-fires it for real the moment `pilotDeclareAttackers` below declares
// the equipped creature as an attacker (see card.ts's own `Trigger.on`
// doc comment for the full writeup).

import { sagesNouliths } from './definition';
import { basicLandsFor } from '../../mana';
import { GENERIC_FILLER_CREATURE } from '../../harness';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  pilotActivate,
  pilotDeclareAttackers,
  advanceToDeclareAttackersStep,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  // {1}{U} to cast Sage's Nouliths, {3} to later activate its own Equip —
  // one land pool covers both real costs (same "one pool suffices"
  // convention this pool's own engine-piloted scenarios already use).
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{1}{U}{3}'), libraryCount: 8 },
  };
  const pilot = setupEnginePilot(setup);

  const sagesNoulithsReal = pilot.state.addCard(pilot.you, 'Hand', { name: sagesNouliths.name, types: ['Artifact'], subtypes: ['Equipment'] });
  const actions = pilotActions(pilot, sagesNoulithsReal.id);
  const ctx = pilot.ctxFor(sagesNoulithsReal);

  // Real board-state filler (2026-09-16): a real, non-sick creature you
  // already control (added directly, not through the real resolution path,
  // so it never gets an `enteredThisTurn` stamp — same "already there,
  // legal to attack right away" convention zack-fair's own scenario already
  // establishes for the identical `GENERIC_FILLER_CREATURE`), so the real
  // Equip {3} activation below has a genuinely different creature to
  // re-target onto, and that creature can legally attack THIS turn.
  pilot.beginStep(`${GENERIC_FILLER_CREATURE} already on the battlefield`);
  const otherCreature = pilot.state.addCard(pilot.you, 'Battlefield', { name: GENERIC_FILLER_CREATURE, types: ['Creature'], subtypes: ['Bear'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: otherCreature.name, zone: 'Battlefield', power: otherCreature.basePower, toughness: otherCreature.baseToughness, controller: pilot.you.name });

  // Cast Sage's Nouliths ({1}{U}), real mana payment; resolving it enters
  // the battlefield and fires the real Job select onEnter trigger — creates
  // a 1/1 colorless Hero creature token, then attaches itself to it.
  pilotCast(pilot, sagesNoulithsReal, sagesNouliths, ctx, actions);
  pilotResolveTop(pilot);

  // Real Equip {3} activation (Hagneia, a flavor name on the standard Equip
  // ability) re-attaches Sage's Nouliths to the OTHER real creature already
  // on the battlefield instead of the Hero token Job select just attached
  // it to — a genuinely different re-target, not a no-op.
  pilotActivate(pilot, pilot.you, sagesNoulithsReal, sagesNouliths, ctx, actions, `Activate Hagneia — Equip {3}: re-attach to ${GENERIC_FILLER_CREATURE}`);
  pilotResolveTop(pilot);

  // Real 508.1a attacker declaration — the equipped creature (now genuinely
  // boosted to 3/2 and a Cleric by Sage's Nouliths' own real
  // `continuousPTGrants`/`continuousTypeGrants`) attacks for real, so
  // `Card.isAttacking()` genuinely reads true for it.
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [otherCreature]);

  // The granted "whenever this creature attacks, untap target attacking
  // creature" now auto-fires for real, straight off the real
  // `declareAttackers` call above (`engine.ts`'s widened
  // `fireOnAttackTriggers`, `on: 'equippedAttacks'`) — no manual
  // `pilotFireTrigger` needed anymore. `untapTarget`'s own
  // `validType: 'attacking'` pool finds the real attacking creature just
  // declared and untaps it (its only legal target here).

  const result = `Sage's Nouliths is cast and enters, Job select creates a 1/1 colorless Hero creature token and attaches itself to it, a real Equip {3} activation re-attaches it to ${GENERIC_FILLER_CREATURE} instead, that creature attacks for real, and the granted "untap target attacking creature" ability auto-fires for real off the declared attack itself, untapping it (the only real attacking creature on the battlefield).`;
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'engine playthrough: cast -> onEnter (Job select) -> Equip {3} re-attach -> real attack declaration -> onEquippedAttacks auto-fires (untap)',
      result,
    ),
  ];
}
