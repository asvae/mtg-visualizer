// Real engine-piloted trace (see engine-trace.ts's own header). onEnter is
// a real recognized auto-fire (603.6b) — wired via `on: 'enter'` on this
// card's own definition.ts (same convention Jill's own onEnter uses). The
// equip-triggered ability-doubling static isn't modeled anywhere in this
// engine (no trigger-multiplying machinery exists — see definition.ts's own
// comment), so nothing to demonstrate for it here.

import { cloudMidgarMercenary } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{W}{W}'), libraryCount: 8, libraryArtifactCount: 1 } };
  const pilot = setupEnginePilot(setup);

  const cloudReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: cloudMidgarMercenary.name,
    types: ['Creature'],
    subtypes: ['Human', 'Soldier', 'Mercenary', 'Legendary'],
  });
  const actions = pilotActions(pilot, cloudReal.id);
  const ctx = pilot.ctxFor(cloudReal);

  // Cast Cloud ({W}{W}), real mana payment
  pilotCast(pilot, cloudReal, cloudMidgarMercenary, ctx, actions);
  // Resolves; real 603.6b ETB auto-fires — searches the real library for the
  // one real artifact card, puts it into hand
  pilotResolveTop(pilot);

  const result =
    'Cloud enters; real ETB (603.6b) searches your real library for an artifact card, puts it into hand. The equip-triggered ability-doubling static is printed text only — no trigger-multiplying machinery exists in this engine.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> real ETB library search', result)];
}
