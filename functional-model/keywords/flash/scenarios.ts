// Real engine-piloted trace (see engine-trace.ts's own header). Keyword
// coverage suite — Ambrosia Whiteheart's real printed Flash, cast for real
// during the OPPONENT's own Main1 (not the caster's turn at all) —
// ordinarily illegal for a sorcery-speed spell (307.1a/117.1a), which Gran
// Pulse Ochu (a real card with no Flash) is cast alongside to demonstrate
// the real rejection, both checked via the same `isInstantSpeed`/
// `sorcerySpeedTimingOk` logic in `engine.ts`.

import { ambrosiaWhiteheart } from '../../cards/ambrosia-whiteheart/definition';
import { granPulseOchu } from '../../cards/gran-pulse-ochu/definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  pilotExpectIllegalCast,
  advanceToPlayersNextMain1,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{1}{W}{G}'), libraryCount: 5 },
    opponents: [{ libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  const ambrosiaReal = pilot.state.addCard(pilot.you, 'Hand', { name: ambrosiaWhiteheart.name, types: ['Creature'], subtypes: ['Bird', 'Legendary'], keywords: ambrosiaWhiteheart.keywords });
  const ochuReal = pilot.state.addCard(pilot.you, 'Hand', { name: granPulseOchu.name, types: ['Creature'], subtypes: ['Plant', 'Beast'], keywords: granPulseOchu.keywords });
  const ambrosiaActions = pilotActions(pilot, ambrosiaReal.id);
  const ambrosiaCtx = pilot.ctxFor(ambrosiaReal, { declineOptional: true });

  // Real turn passage into the OPPONENT's own Main1 — `you` is no longer
  // the active player at all, so sorcery-speed timing (307.1a) is out of
  // the question for anything `you` tries to cast here, regardless of phase.
  advanceToPlayersNextMain1(pilot, pilot.opponents[0]!);

  pilotExpectIllegalCast(pilot, pilot.you, granPulseOchu, `Attempt (expected illegal): cast ${granPulseOchu.name} (sorcery-speed) during the opponent's turn`);
  pilotCast(pilot, ambrosiaReal, ambrosiaWhiteheart, ambrosiaCtx, ambrosiaActions, `Cast ${ambrosiaWhiteheart.name} via Flash during the opponent's turn`);
  pilotResolveTop(pilot);

  const result = `307.1a/117.1a: Gran Pulse Ochu, a plain sorcery-speed creature, is correctly rejected when cast during the opponent's own turn — the engine's own reason is logged. Ambrosia Whiteheart's printed Flash exempts it from that same check (\`isInstantSpeed\` in engine.ts), so the identical cast attempt succeeds at the exact same moment.`;
  return [finishEnginePilotTrace(pilot, setup, "engine playthrough: opponent's turn -> sorcery-speed cast rejected -> Flash cast succeeds", result)];
}
