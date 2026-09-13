// Real engine-piloted trace (see engine-trace.ts's own header). FIN-set
// mechanic coverage — Ambrosia Whiteheart's real printed Landfall trigger.
// Real Forge fires this off ANOTHER permanent (a land) entering, not
// Ambrosia's own event — this engine has no automatic "a land entered"
// detection anywhere (every named trigger here is dispatched on cue, see
// that card's own definition.ts comment), so a real land is added to the
// battlefield for real, then the SAME real onLandfall effect (+1/+0 until
// end of turn) is fired manually, same convention Ashe's own onAttack uses.

import { ambrosiaWhiteheart } from '../../cards/ambrosia-whiteheart/definition';
import { basicLandsFor } from '../../mana';
import { effectivePT } from '../../state';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotFireTrigger, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{1}{W}'), libraryCount: 5 } };
  const pilot = setupEnginePilot(setup);

  const ambrosiaReal = pilot.state.addCard(pilot.you, 'Hand', { name: ambrosiaWhiteheart.name, types: ['Creature'], subtypes: ['Bird', 'Legendary'], keywords: ambrosiaWhiteheart.keywords });
  const actions = pilotActions(pilot, ambrosiaReal.id);
  const ctx = pilot.ctxFor(ambrosiaReal, { declineOptional: true });

  pilotCast(pilot, ambrosiaReal, ambrosiaWhiteheart, ctx, actions);
  pilotResolveTop(pilot);

  pilot.beginStep('A land enters');
  const forest = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
  pilot.log.push({ fn: 'enters', card: forest.name, zone: 'Battlefield', controller: pilot.you.name });

  const beforePower = effectivePT(pilot.state, ambrosiaReal)[0];
  pilotFireTrigger(pilot, ambrosiaWhiteheart, ctx, actions, 'onLandfall');
  const afterPower = effectivePT(pilot.state, ambrosiaReal)[0];

  const result = `Landfall isn't auto-detected in this engine (a documented gap — see this file's own header), so the land enters, then the same "+1/+0 until end of turn" effect the card is printed with fires manually — Ambrosia's power goes from ${beforePower} to ${afterPower} via the same \`pump\` primitive every other stat-changing effect in this model uses, not a special-cased Landfall counter.`;
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> land ETB -> onLandfall fired manually -> pump', result)];
}
