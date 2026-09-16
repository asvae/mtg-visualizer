// Real engine-piloted trace (see engine-trace.ts's own header) — REPLACES
// the earlier flat `harness.ts` "cast -> onEnter -> Equip re-attach" scenario
// (2026-09-16, equip-trigger auto-dispatch pass: the granted "Whenever this
// creature attacks, you gain 1 life" ability is now real, executable
// machinery — `definition.ts`'s own new `on: 'equippedAttacks'` trigger,
// `engine.ts`'s widened `fireOnAttackTriggers`, see card.ts's own
// `Trigger.on` doc comment for the full writeup). Same real board-state
// shape sage-s-nouliths' own identical migration already establishes (a
// real, non-sick filler creature already on the battlefield for the Equip
// {3} activation to re-target onto, so the equipped creature can legally
// attack the SAME turn without needing to cross a whole extra turn boundary
// just to clear the Hero token's own summoning sickness).

import { whiteMagesStaff } from './definition';
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
  // {1}{W} to cast White Mage's Staff, {3} to later activate its own Equip
  // — one land pool covers both real costs (same "one pool suffices"
  // convention this pool's own engine-piloted scenarios already use).
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{1}{W}{3}'), libraryCount: 8 },
  };
  const pilot = setupEnginePilot(setup);

  const staffReal = pilot.state.addCard(pilot.you, 'Hand', { name: whiteMagesStaff.name, types: ['Artifact'], subtypes: ['Equipment'] });
  const actions = pilotActions(pilot, staffReal.id);
  const ctx = pilot.ctxFor(staffReal);

  // Real board-state filler (same convention sage-s-nouliths' own identical
  // migration already establishes): a real, non-sick creature you already
  // control (added directly, not through the real resolution path, so it
  // never gets an `enteredThisTurn` stamp), so the real Equip {3} activation
  // below has a genuinely different creature to re-target onto, and that
  // creature can legally attack THIS turn.
  pilot.beginStep(`${GENERIC_FILLER_CREATURE} already on the battlefield`);
  const otherCreature = pilot.state.addCard(pilot.you, 'Battlefield', { name: GENERIC_FILLER_CREATURE, types: ['Creature'], subtypes: ['Bear'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: otherCreature.name, zone: 'Battlefield', power: otherCreature.basePower, toughness: otherCreature.baseToughness, controller: pilot.you.name });

  // Cast White Mage's Staff ({1}{W}), real mana payment; resolving it enters
  // the battlefield and fires the real Job select onEnter trigger — creates
  // a 1/1 colorless Hero creature token, then attaches itself to it.
  pilotCast(pilot, staffReal, whiteMagesStaff, ctx, actions);
  pilotResolveTop(pilot);

  // Real Equip {3} activation re-attaches White Mage's Staff to the OTHER
  // real creature already on the battlefield instead of the Hero token Job
  // select just attached it to — a genuinely different re-target, not a
  // no-op.
  pilotActivate(pilot, pilot.you, staffReal, whiteMagesStaff, ctx, actions, `Activate Equip {3}: re-attach to ${GENERIC_FILLER_CREATURE}`);
  pilotResolveTop(pilot);

  // Real 508.1a attacker declaration — the equipped creature (now genuinely
  // boosted to 3/3 and a Cleric by White Mage's Staff's own real
  // `continuousPTGrants`/`continuousTypeGrants`) attacks for real.
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [otherCreature]);

  // The granted "Whenever this creature attacks, you gain 1 life" now
  // auto-fires for real, straight off the real `declareAttackers` call
  // above (`engine.ts`'s widened `fireOnAttackTriggers`, `on:
  // 'equippedAttacks'`) — no manual `pilotFireTrigger` needed at all.

  const result = `White Mage's Staff is cast and enters, Job select creates a 1/1 colorless Hero creature token and attaches itself to it, a real Equip {3} activation re-attaches it to ${GENERIC_FILLER_CREATURE} instead, that creature attacks for real, and the granted "you gain 1 life" ability auto-fires for real off the declared attack itself.`;
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'engine playthrough: cast -> onEnter (Job select) -> Equip {3} re-attach -> real attack declaration -> onEquippedAttacks auto-fires (gainLife)',
      result,
    ),
  ];
}
