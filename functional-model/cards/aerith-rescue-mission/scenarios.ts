// Real engine-piloted trace (see engine-trace.ts's own header) — a plain
// modal sorcery, one real scenario per mode.

import { aerithRescueMission } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function elevatorMode(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{3}{W}') } };
  const pilot = setupEnginePilot(setup);
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: aerithRescueMission.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { mode: 0 });

  pilotCast(pilot, cardReal, aerithRescueMission, ctx, actions);
  pilotResolveTop(pilot);

  const result = 'Take the Elevator — creates three 1/1 colorless Hero creature tokens.';
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> mode 0 (Take the Elevator)', result);
}

function stairsMode(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{3}{W}'), tokens: ['c_1_1_hero'] },
    opponents: [{ tokens: ['w_1_1_cat'] }],
  };
  const pilot = setupEnginePilot(setup);
  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: aerithRescueMission.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { mode: 1 });

  pilotCast(pilot, cardReal, aerithRescueMission, ctx, actions);
  pilotResolveTop(pilot);

  const result = "Take 59 Flights of Stairs — creatures on the battlefield get tapped (up to three targets), and the first one tapped gets a stun counter.";
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> mode 1 (Take 59 Flights of Stairs)', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [elevatorMode(), stairsMode()];
}
