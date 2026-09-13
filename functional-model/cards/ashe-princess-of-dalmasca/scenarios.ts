// Real engine-piloted trace (see engine-trace.ts's own header). onAttack has
// no auto-fire in this engine (Trigger.on only recognizes
// 'enter'|'upkeep'|'endStep') — so this pilots a real attack declaration,
// then fires the trigger manually right after (same convention Ultima's own
// onAttack uses).

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
  pilotFireTrigger,
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

  // Real attack declaration (508.1)
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [asheReal], 'Declare Ashe as attacker');

  // onAttack fired manually — digs 5 real library cards, takes the one real artifact found
  pilotFireTrigger(pilot, ashePrincessOfDalmasca, ctx, actions, 'onAttack');

  const result =
    "Ashe enters, turn passage clears summoning sickness, then attacks (508.1) — onAttack fires manually, digging through the top 5 library cards and taking the one artifact among them (Phoenix Down) to hand.";
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> turn passage -> attack -> onAttack (dig)', result)];
}
