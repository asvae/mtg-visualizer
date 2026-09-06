// Real engine-piloted trace (see engine-trace.ts's own header). onAttack has
// no auto-fire in this engine (Trigger.on only recognizes
// 'enter'|'upkeep'|'endStep') — so this pilots a real attack declaration,
// then fires the trigger manually right after (same convention Ultima's own
// onAttack uses).

import { ashePrincessOfDalmasca } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { declareAttackers } from '../../engine';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{2}{W}'), libraryCount: 8, libraryArtifactCount: 1 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  const asheReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: ashePrincessOfDalmasca.name,
    types: ['Creature'],
    subtypes: ['Human', 'Rebel', 'Noble', 'Legendary'],
  });
  const actions = pilotActions(pilot, asheReal.id);
  const ctx = pilot.ctxFor(asheReal);

  // Cast Ashe ({2}{W}), real mana payment
  pilotCast(pilot, asheReal, ashePrincessOfDalmasca, ctx, actions);
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness (302.6) clears
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real attack declaration (508.1)
  advanceToDeclareAttackersStep(pilot);
  const attack = declareAttackers(pilot.engine, [asheReal]);
  if (!attack.ok) throw new Error(`attack illegal: ${attack.reason}`);
  pilot.log.push({ fn: 'attack', card: asheReal.name });

  // onAttack fired manually — digs 5 real library cards, takes the one real artifact found
  pilotFireTrigger(pilot, ashePrincessOfDalmasca, ctx, actions, 'onAttack');

  const result =
    'Ashe enters, real turn passage clears summoning sickness, then really attacks (508.1) — onAttack fires manually, digging through the top 5 real library cards and taking the one real artifact among them to hand.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> turn passage -> real attack -> onAttack (real dig)', result)];
}
