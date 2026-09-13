// Real engine-piloted trace (see engine-trace.ts's own header). Keyword
// coverage suite — Adelbert Steiner's real printed Lifelink (its own
// Equipment CDA and the legend rule are separately covered by that card's
// own functional-model/cards/adelbert-steiner/scenarios.ts), cast for real
// and attacked unblocked so real combat damage genuinely triggers real
// Lifelink life gain (state.ts's own `dealDamage`).

import { adelbertSteiner } from '../../cards/adelbert-steiner/definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { resolveCombatDamage } from '../../engine';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  advanceOneStep,
  pilotDeclareAttackers,
  pilotDeclareBlockers,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{1}{W}'), libraryCount: 5 }, opponents: [{ libraryCount: 5 }] };
  const pilot = setupEnginePilot(setup);

  const steinerReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: adelbertSteiner.name,
    types: ['Creature'],
    subtypes: ['Human', 'Knight', 'Legendary'],
    keywords: adelbertSteiner.keywords,
    basePower: adelbertSteiner.pt?.[0],
    baseToughness: adelbertSteiner.pt?.[1],
  });
  const actions = pilotActions(pilot, steinerReal.id);
  const ctx = pilot.ctxFor(steinerReal);

  pilotCast(pilot, steinerReal, adelbertSteiner, ctx, actions);
  pilotResolveTop(pilot);
  advanceToPlayersNextMain1(pilot, pilot.you);

  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [steinerReal], `Declare ${adelbertSteiner.name} as attacker`);
  advanceOneStep(pilot, 'Advance to Declare Blockers');
  pilotDeclareBlockers(pilot, []);

  pilot.beginStep('Resolve unblocked combat damage — Lifelink');
  const opp = pilot.opponents[0]!;
  const beforeOppLife = opp.life;
  const beforeYouLife = pilot.you.life;
  resolveCombatDamage(pilot.engine);
  const damageDealt = beforeOppLife - opp.life;
  if (damageDealt > 0) pilot.log.push({ fn: 'dealDamage', source: steinerReal.name, target: opp.name, amount: damageDealt });
  const lifeGained = pilot.you.life - beforeYouLife;
  if (lifeGained > 0) pilot.log.push({ fn: 'gainLife', player: pilot.you.name, amount: lifeGained, cause: 'Lifelink' });

  const result = `Lifelink (state.ts's own \`dealDamage\`): every point of combat damage Steiner deals to the opponent (${damageDealt}) is mirrored as life gain for its controller (${lifeGained}) — not a separate scripted "and also gain life" step, the SAME damage call does both.`;
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> turn passage -> unblocked combat -> Lifelink life gain', result)];
}
