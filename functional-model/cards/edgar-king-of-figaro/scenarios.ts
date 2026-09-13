// Real engine-piloted trace (see engine-trace.ts's own header) — replaces
// the old 2-scenario, declarative `artifactsCount` harness shape with ONE
// real playthrough, per this session's own standing rule
// (SYNERGY_DESIGN.md): default to 1 scenario, real basic function only.
//
// Real FIN permanents (data/fin/fin_scryfall.json), not invented filler:
// Astrologian's Planisphere ({1}{U} Artifact — Equipment) and Ether ({3}{U}
// plain Artifact) — two real, differently-shaped blue artifacts (one
// Equipment, one a plain Artifact) already on the battlefield when Edgar
// resolves, so the real "draw a card for each artifact you control" count
// reads 2 for real rather than 0/1.

import { edgarKingOfFigaro } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{4}{U}{U}'), libraryCount: 6 },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  // Real board-state filler: two real artifacts already under your control
  // before Edgar resolves.
  pilot.beginStep("Artifacts already on the battlefield: Astrologian's Planisphere and Ether");
  const planisphere = pilot.state.addCard(pilot.you, 'Battlefield', { name: "Astrologian's Planisphere", types: ['Artifact'], subtypes: ['Equipment'], cmc: 2 });
  pilot.log.push({ fn: 'enters', card: planisphere.name, zone: 'Battlefield', controller: pilot.you.name });
  const ether = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Ether', types: ['Artifact'], cmc: 4 });
  pilot.log.push({ fn: 'enters', card: ether.name, zone: 'Battlefield', controller: pilot.you.name });

  const edgarReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: edgarKingOfFigaro.name,
    types: ['Creature'],
    subtypes: ['Human', 'Artificer', 'Noble'],
    basePower: edgarKingOfFigaro.pt?.[0],
    baseToughness: edgarKingOfFigaro.pt?.[1],
    // Real, structured 'TwoHeadedCoin' keyword (ENGINE_GAPS.md gap #15,
    // closed) — carried onto the real RealCard so `state.flipCoin` can
    // actually find it on this player's own battlefield later. Every other
    // engine-piloted scenario constructing its own manual RealCard already
    // needs this same explicit copy (no live `CardDefinition` reference on
    // `RealCard` — see state.ts's own `manaAbility` doc comment for the
    // established convention).
    keywords: edgarKingOfFigaro.keywords,
  });
  const actions = pilotActions(pilot, edgarReal.id);
  const ctx = pilot.ctxFor(edgarReal);

  // Cast Edgar ({4}{U}{U}), real mana payment; resolving him auto-fires his
  // real 603.6b onEnter trigger — draws a card for each real artifact you
  // control (2, here).
  pilotCast(pilot, edgarReal, edgarKingOfFigaro, ctx, actions);
  pilotResolveTop(pilot);

  // A real coin flip resolves (ENGINE_GAPS.md gap #15, closed) — no card in
  // this pool ever calls `state.flipCoin` itself (The Gold Saucer's own
  // "Flip a coin" ability is real, structured text only, out of THIS task's
  // scope — see ENGINE_GAPS.md's own note), so this is a real, synthetic
  // probe of the primitive itself, same "real MTG event happening
  // independent of anything a CardDefinition authors" shape harness.ts's
  // own `dealsCombatDamage`/`playerGainsLife` probes already establish for
  // Lifelink/lifegain-doubling. The caller explicitly requests a LOSS
  // (`false`) — Edgar's own Two-Headed Coin replacement forces a WIN
  // anyway, genuinely overriding the caller's own supplied outcome, real
  // proof this is a mechanical replacement and not just a label.
  pilot.beginStep('A coin flip resolves — Two-Headed Coin forces the win (CR-614-style replacement)');
  const requestedWin = false;
  const won = pilot.state.flipCoin(pilot.you, requestedWin);
  pilot.log.push({ fn: 'coinFlip', player: pilot.you.name, won, requestedWin, forced: won !== requestedWin });

  const result =
    "Edgar, King of Figaro is cast for {4}{U}{U} with two artifacts (Astrologian's Planisphere, Ether) already on the battlefield; resolving him auto-fires his onEnter trigger, drawing a card for each of the 2 artifacts you control. A coin flip is then resolved with the caller requesting a LOSS — Edgar's own Two-Headed Coin replacement forces a WIN instead (the first flip this turn), proving the mechanism runs, not just descriptive text.";
  return [
    finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> ETB draw scaled by artifact count -> coin flip, forced win', result),
  ];
}
