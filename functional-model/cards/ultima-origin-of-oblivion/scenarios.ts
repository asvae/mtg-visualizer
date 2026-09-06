// Real engine-piloted trace (see engine-trace.ts's own header). onAttack has
// no auto-fire in this engine (Trigger.on only recognizes
// 'enter'|'upkeep'|'endStep') — so this pilots a real attack declaration,
// then fires the trigger manually right after.

import { ultimaOriginOfOblivion } from './definition';
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
    you: { basicLands: basicLandsFor('{5}'), libraryCount: 5 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  const ultimaReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: ultimaOriginOfOblivion.name,
    types: ['Creature'],
    subtypes: ['God', 'Legendary'],
    keywords: ultimaOriginOfOblivion.keywords,
  });
  const actions = pilotActions(pilot, ultimaReal.id);
  const ctx = pilot.ctxFor(ultimaReal);

  // Cast Ultima ({5}), real mana payment
  pilotCast(pilot, ultimaReal, ultimaOriginOfOblivion, ctx, actions);
  // Resolves (no ETB trigger)
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness (302.6) clears
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real attack declaration (508.1)
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [ultimaReal], 'Declare Ultima as attacker');

  // onAttack fired manually — puts a real blight counter on the opponent's only land
  pilotFireTrigger(pilot, ultimaOriginOfOblivion, ctx, actions, 'onAttack');

  const result =
    'Ultima enters, real turn passage clears summoning sickness, then really attacks (508.1), putting a real blight counter on the opponent\'s only land. The land\'s own granted "{T}: Add {C}" and Ultima\'s mana-doubling static are real printed text with no engine machinery behind them yet.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> turn passage -> real attack -> onAttack', result)];
}
