// Real engine-piloted trace (see engine-trace.ts's own header). `onAttack`
// is now a real, closed-vocabulary `on: 'attacks'` auto-fire (ENGINE_GAPS.md
// — attack-triggered-ability auto-dispatch; `card.ts`'s own
// `Trigger.on: 'attacks'` doc comment) — `engine.ts`'s new
// `fireOnAttackTriggers` fires this trigger for real, straight off the real
// `declareAttackers` call below, no manual `pilotFireTrigger` needed
// anymore (this used to be the exact same manual-firing workaround
// Ultima's own `onAttack` still uses for ITS OWN, differently-shaped
// trigger — see that card's own scenario for the still-manual pattern).

import { ashePrincessOfDalmasca } from './definition';
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
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{2}{W}'), libraryCount: 4 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  // A real named artifact (any real fin printing works) — the generic
  // `libraryArtifactCount` filler has no real identity of its own. `addCard`
  // pushes onto the END of the library array, so with exactly 4 plain
  // fillers ahead of it (`libraryCount: 4` above) it's the 5th and last
  // card `dig`'s own real "look at the top five" actually reaches, not
  // buried past where the real effect ever looks.
  pilot.state.addCard(pilot.you, 'Library', { name: 'Phoenix Down', types: ['Artifact'] });

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

  // Real attack declaration (508.1) — `engine.ts`'s own `declareAttackers`
  // now auto-fires Ashe's real `on: 'attacks'` trigger right here, for real
  // (no manual pilotFireTrigger call needed anymore).
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [asheReal], 'Declare Ashe as attacker');

  const result =
    'Ashe enters, turn passage clears summoning sickness, then attacks (508.1) — her onAttack trigger auto-fires for real off the declared attack itself, digging through the top 5 library cards and taking the one artifact among them (Phoenix Down) to hand.';
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> turn passage -> attack -> onAttack auto-fires (dig)', result)];
}
