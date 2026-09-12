// Real engine-piloted trace (see engine-trace.ts's own header) — one real
// scenario, a genuinely SYMMETRIC board wipe: both players control a real
// (non-token) artifact and a real (non-token) creature, plus a land that
// should survive untouched — proving this is a real, unconditional,
// UNTARGETED mass-destroy (`SP$ DestroyAll | ValidCards$ Artifact,Creature`,
// not a chosen-target loop) that hits BOTH sides, not just the caster's own
// opponent, and doesn't touch anything outside its own stated scope (lands).
//
// Non-token targets, same reasoning fate-of-the-sun-cryst's own scenario
// documents: `card.ts`'s `destroy` case logs a literal `fn:'destroy'` line
// only for a real (non-token) permanent — a token instead logs
// `ceasesToExist`, which can't back a real `event:'destroy'` ACT fact as
// trace evidence.
//
// "End the turn" is NOT exercised here — no turn-ending machinery exists in
// this model (see definition.ts's own comment on that effect); real text
// only, an honest documented gap, not something a scenario can demonstrate.

import { ultima } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function wipesArtifactsAndCreaturesOnBothSides(): TraceResult {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{3}{W}{W}') },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  // Your own real artifact and creature (data/fin/fin_scryfall.json #52,
  // #19) — both should be destroyed by your own spell too, since the real
  // oracle text has no controller restriction.
  const yourLance = pilot.state.addCard(pilot.you, 'Battlefield', { name: "Dragoon's Lance", types: ['Artifact'], subtypes: ['Equipment'], cmc: 2 });
  pilot.log.push({ fn: 'enters', card: yourLance.name, zone: 'Battlefield', controller: pilot.you.name });
  const yourCreature = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Dwarven Castle Guard', types: ['Creature'], subtypes: ['Dwarf', 'Soldier'], basePower: 2, baseToughness: 1, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: yourCreature.name, zone: 'Battlefield', power: yourCreature.basePower, toughness: yourCreature.baseToughness, controller: pilot.you.name });

  // The opponent's own real artifact and creature (data/fin/fin_scryfall.json
  // #22, #38's own neighbor set) — Coeurl is the same real, non-token
  // permanent fate-of-the-sun-cryst's own scenario already uses as an
  // opponent's destroy target.
  const opp = pilot.opponents[0]!;
  const oppPhoenixDown = pilot.state.addCard(opp, 'Battlefield', { name: 'Phoenix Down', types: ['Artifact'], cmc: 1 });
  pilot.log.push({ fn: 'enters', card: oppPhoenixDown.name, zone: 'Battlefield', controller: opp.name });
  const oppCreature = pilot.state.addCard(opp, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: oppCreature.name, zone: 'Battlefield', power: oppCreature.basePower, toughness: oppCreature.baseToughness, controller: opp.name });

  // Real, untouched lands on both sides, to demonstrate the wipe genuinely
  // stops at "artifacts and creatures" rather than everything.
  pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Plains', types: ['Land'], subtypes: ['Plains'], manaAbility: 'W' });
  pilot.state.addCard(opp, 'Battlefield', { name: 'Plains', types: ['Land'], subtypes: ['Plains'], manaAbility: 'W' });

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: ultima.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal);

  pilotCast(pilot, cardReal, ultima, ctx, actions);
  pilotResolveTop(pilot);

  const result =
    "Destroys all four artifacts/creatures on both battlefields — your own Dragoon's Lance and Dwarven Castle Guard, AND the opponent's own Phoenix Down and Coeurl — a symmetric, untargeted wipe (no controller restriction in the printed text). Both Plains survive untouched. \"End the turn\" is printed text only — no turn-ending machinery in this model, so it isn't (and can't be) exercised here.";
  return finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> resolve (Destroy all artifacts and creatures)', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [wipesArtifactsAndCreaturesOnBothSides()];
}
