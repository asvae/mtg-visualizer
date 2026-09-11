// Real engine-piloted trace (see engine-trace.ts's own header) — REPLACES
// the earlier `sequence:['onDies']` flat-scenario shortcut (2026-09-11),
// a real regression the user caught live: "First we have some dubious
// onDies trigger, so Guard pretty much dies from nothing? Also as it dies
// - it stays on battlefield." Root cause confirmed by reading harness.ts:
// `sequence`'s own `trigger` step only ever runs `resolveCard`'s named-
// trigger EFFECTS (here, create the Hero token) — it never performs the
// real underlying zone move (Battlefield -> Graveyard) that "dying"
// fundamentally IS. `onDies`/`onLifeGained`-class triggers deliberately
// don't auto-fire anywhere in this engine (see aerith-gainsborough's own
// header, same real pattern reused here): the real event has to actually
// happen first (real lethal combat damage, a real 704.5g state-based
// death), THEN the trigger fires manually to demonstrate its own effect.

import { dwarvenCastleGuard } from './definition';
import { basicLandsFor } from '../../mana';
import { checkStateBasedActions } from '../../sba';
import { effectivePT } from '../../state';
import type { TraceResult } from '../../harness';
import { resolveCombatDamage } from '../../engine';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  advanceOneStep,
  pilotDeclareAttackers,
  pilotDeclareBlockers,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{1}{W}'), libraryCount: 8 },
    opponents: [{ libraryCount: 8 }],
  };
  const pilot = setupEnginePilot(setup);

  // Coeurl (data/fin/fin_scryfall.json: {1}{G} Creature — Cat Beast, 2/2) —
  // same real card this session's own Dion/Bahamut scenario already uses
  // as a real opponent blocker, sized to trade evenly with a 2/1 (both
  // combatants deal lethal damage back, a genuine mutual 704.5g SBA
  // destruction — not a one-sided fabrication).
  const blocker = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {
    name: 'Coeurl',
    types: ['Creature'],
    subtypes: ['Cat', 'Beast'],
    basePower: 2,
    baseToughness: 2,
  });
  pilot.log.push({ fn: 'enters', card: blocker.name, zone: 'Battlefield', power: blocker.basePower, toughness: blocker.baseToughness, controller: pilot.opponents[0]!.name });

  const guardReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: dwarvenCastleGuard.name,
    types: ['Creature'],
    subtypes: ['Dwarf', 'Soldier'],
    basePower: dwarvenCastleGuard.pt?.[0],
    baseToughness: dwarvenCastleGuard.pt?.[1],
  });
  const actions = pilotActions(pilot, guardReal.id);
  const ctx = pilot.ctxFor(guardReal);

  // Cast the Guard ({1}{W}), real mana payment
  pilotCast(pilot, guardReal, dwarvenCastleGuard, ctx, actions);
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness clears
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real blocked combat, genuinely lethal both ways (2 power into 2
  // toughness, 704.5g SBA on both sides)
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [guardReal], 'Declare Guard as attacker');
  advanceOneStep(pilot);
  pilotDeclareBlockers(pilot, [{ blocker, attacker: guardReal }]);
  pilot.beginStep('Resolve lethal combat damage (704.5g SBA)');
  const guardPower = effectivePT(pilot.state, guardReal)[0];
  const blockerPower = effectivePT(pilot.state, blocker)[0];
  resolveCombatDamage(pilot.engine);
  if (guardPower > 0) pilot.log.push({ fn: 'dealDamage', source: guardReal.name, target: blocker.name, amount: guardPower });
  if (blockerPower > 0) pilot.log.push({ fn: 'dealDamage', source: blocker.name, target: guardReal.name, amount: blockerPower });
  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  // Real destroyed-permanent(s) — could be either or both combatants;
  // `controller` comes from the real destroyed card's own state, not a
  // hardcoded guess (verify-synergy.mjs's own `sideOf` trusts a present
  // `controller` field over name-based guessing).
  for (const destroyed of sbaResult.destroyed) {
    const controllerName = pilot.state.players.get(destroyed.controllerId)!.name;
    pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: controllerName });
  }

  // The Guard's own real death (704.5g moved it to the graveyard above) —
  // onDies fires manually, same real pattern aerith-gainsborough's own
  // scenario already establishes for this engine's deliberate "no
  // auto-fire" design.
  if (guardReal.zone === 'Graveyard') pilotFireTrigger(pilot, dwarvenCastleGuard, ctx, actions, 'onDies');

  const result =
    'Dwarven Castle Guard is cast, enters the battlefield, then attacks and trades in real blocked combat against a real 2/2 (a genuine mutual 704.5g state-based destruction) — it actually leaves the battlefield for the graveyard, then its onDies trigger fires for real, creating a 1/1 colorless Hero creature token.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> real lethal combat (SBA) -> onDies', result)];
}
