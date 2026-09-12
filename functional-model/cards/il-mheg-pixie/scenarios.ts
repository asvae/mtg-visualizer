// Real engine-piloted trace (see engine-trace.ts's own header). onAttack has
// no auto-fire in this engine (Trigger.on only recognizes
// 'enter'|'upkeep'|'endStep') — so this pilots a real attack declaration,
// then fires the trigger manually right after, same convention Ashe,
// Princess of Dalmasca's own onAttack scenario already uses.

import { ilMhegPixie } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  pilotDeclareAttackers,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{1}{U}'), libraryCount: 5 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  const pixieReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: ilMhegPixie.name,
    types: ['Creature'],
    subtypes: ['Faerie'],
  });
  const actions = pilotActions(pilot, pixieReal.id);
  const ctx = pilot.ctxFor(pixieReal);

  // Cast Il Mheg Pixie ({1}{U}), real mana payment
  pilotCast(pilot, pixieReal, ilMhegPixie, ctx, actions);
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness (302.6) clears
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real attack declaration (508.1)
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [pixieReal], 'Declare Il Mheg Pixie as attacker');

  // onAttack fired manually — surveils 1 (real fn:'surveil' log line)
  pilotFireTrigger(pilot, ilMhegPixie, ctx, actions, 'onAttack');

  const result =
    'Il Mheg Pixie enters, turn passage clears summoning sickness, then attacks (508.1) — onAttack fires manually, surveiling 1.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> turn passage -> real attack -> onAttack (real surveil)', result)];
}
