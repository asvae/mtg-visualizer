// Real engine-piloted trace for this card (see engine-trace.ts's own
// header). `onAttack` has no auto-fire anywhere in `engine.ts` (`Trigger.on`
// only recognizes `'enter'|'upkeep'|'endStep'` — a declared attacker isn't
// one of those, a real, accepted gap, not built here) — so this pilots a
// REAL attack declaration (`declareAttackers`, legality-enforced: summoning
// sickness must genuinely clear first, via a real turn advance) and then
// manually fires the trigger right after, same convention harness.ts's own
// `dealsCombatDamage` synthetic-probe doc comment already establishes for
// "a real MTG event just happened for real through the engine; the trigger
// firing off it is not yet auto-wired."

import { ultimaOriginOfOblivion } from './definition';
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
    // Both players need a real library — this scenario crosses a full real
    // turn (real 704.5a, sba.ts, genuinely loses the game for whoever's
    // instructed to draw with none left).
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

  // --- Cast Ultima ({5}), real mana payment ---
  pilotCast(pilot, ultimaReal, ultimaOriginOfOblivion, ctx, actions);
  // --- Resolves onto the battlefield (no ETB trigger declared) ---
  pilotResolveTop(pilot);

  // --- Real turn passage — summoning sickness (302.6) genuinely clears ---
  advanceToPlayersNextMain1(pilot, pilot.you);

  // --- Real attack declaration (508.1, legality-enforced by `canAttack`
  // inside `declareAttackers`) — Ultima taps to attack. ---
  advanceToDeclareAttackersStep(pilot);
  const attack = declareAttackers(pilot.engine, [ultimaReal]);
  if (!attack.ok) throw new Error(`attack illegal: ${attack.reason}`);
  pilot.log.push({ fn: 'attack', card: ultimaReal.name });

  // --- `onAttack` fired manually (real event, no auto-wire yet — see this
  // file's own header) — puts a real blight counter on the opponent's only
  // land, the only real candidate in the unrestricted "target land" pool. ---
  pilotFireTrigger(pilot, ultimaOriginOfOblivion, ctx, actions, 'onAttack');

  const result =
    'Ultima enters, real turn passage clears summoning sickness, then really attacks (508.1, tapping it) — the attack trigger itself has no auto-fire in this engine yet (a real, accepted gap, same as harness.ts\'s own "dealsCombatDamage" synthetic-probe convention), so it\'s fired manually right after the real attack declaration, putting a real blight counter on the opponent\'s only land. The land\'s own granted "{T}: Add {C}" and Ultima\'s second static (doubling mana from tapped lands) are real printed text with no engine machinery behind them (no continuous-effect-tied-to-a-counter grant, no "land tapped for mana" trigger hook) — narrated here as the human-known real consequence, same as harness.ts\'s own (replaced) flat scenario already documented.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> turn passage -> real attack -> onAttack', result)];
}
