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
// "End the turn" (real 721.1a machinery, built 2026-09-16 — see
// `interfaces.ts`'s own `endTurn` doc comment for the full citation) IS now
// exercised here, for real: your own hand is stocked with enough real basic
// lands (same `GENERIC_FILLER_LAND` convention `harness.ts`'s own
// `handCount` already uses — a real, fungible Scryfall card, not an
// invented placeholder) to push it past the real maximum hand size (7) once
// Ultima itself leaves it to be cast, so Cleanup's own real 514.1 discard
// genuinely fires and shows up in the trace as a real `discard` entry — the
// first real card in this pool to demonstrate that specific mechanic via
// the engine-trace pilot. Ultima itself is confirmed (via the trace's own
// `move ... to:'Exile'` entry, not the graveyard) to obey the real Gatherer
// ruling on this ability ("This includes Time Stop, though it will continue
// to resolve"). The OTHER real sub-effect this ability performs — exiling
// anything ELSE still on the stack — is legally UNREACHABLE for this
// specific card and is not force-fit into this scenario: see
// `cards/ultima/progress.json` for the full reasoning (a plain Sorcery can
// only ever be cast with an already-empty stack, 307.1a/117.1a, so nothing
// can legally be pending underneath it by the time it resolves) — the
// underlying `engine.ts`/`stack.ts` primitive (`Stack.exileAll`) is real and
// general regardless, built for a future instant-speed "end the turn" card
// that COULD exercise it.

import { ultima } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { GENERIC_FILLER_LAND } from '../../harness';
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
  // No `manaAbilities` needed — a basic Plains' own `subtypes: ['Plains']`
  // already makes `mana.ts`'s `sourceColors` recognize it as a real `W`
  // source (the basic-land-subtype path, unrelated to `manaAbilities`).
  pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Plains', types: ['Land'], subtypes: ['Plains'] });
  pilot.state.addCard(opp, 'Battlefield', { name: 'Plains', types: ['Land'], subtypes: ['Plains'] });

  // Real basic-land hand filler (`harness.ts`'s own `GENERIC_FILLER_LAND`
  // convention, a real fungible Scryfall card, repeated the same way its
  // own `handCount` does) — 9 of them, so your hand is 9 cards deep the
  // moment Ultima itself leaves it to be cast, genuinely exceeding the real
  // maximum hand size (7) by 2, so Cleanup's own real 514.1 discard has
  // something real to do once "End the turn" jumps straight there.
  for (let i = 0; i < 9; i++) {
    pilot.state.addCard(pilot.you, 'Hand', { name: GENERIC_FILLER_LAND, isTokenCard: false, types: ['Land'], subtypes: [GENERIC_FILLER_LAND] });
  }

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: ultima.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal);

  pilotCast(pilot, cardReal, ultima, ctx, actions);
  pilotResolveTop(pilot);

  const result =
    "Destroys all four artifacts/creatures on both battlefields — your own Dragoon's Lance and Dwarven Castle Guard, AND the opponent's own Phoenix Down and Coeurl — a symmetric, untargeted wipe (no controller restriction in the printed text). Both Plains survive untouched. \"End the turn\" then fires for real: Ultima itself is exiled (not put into the graveyard, per the real Gatherer ruling), the game jumps straight to Cleanup, and your own hand (9 real cards after casting Ultima) is discarded down to the real maximum hand size of 7.";
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> resolve (Destroy all artifacts and creatures, then End the turn)', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [wipesArtifactsAndCreaturesOnBothSides()];
}
