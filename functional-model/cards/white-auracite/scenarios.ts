// Real engine-piloted trace (see engine-trace.ts's own header) — replaces
// the old flat `{trigger:'onEnter'}` harness shape, per this session's own
// standing rule (SYNERGY_DESIGN.md, 2026-09-12): default to 1 scenario, and
// prefer a real playthrough so the baseline self-cast/self-enters facts get
// real trace evidence rather than the plain-`trigger`-shaped scenario's own
// documented gap (that shape skips the cast/enters lifecycle entirely — see
// g-raha-tia's/weapons-vendor's own scenarios.ts for the identical fix).
//
// Real FIN permanent (data/fin/fin_scryfall.json), not invented filler:
// Coeurl ({1}{W} 2/2 Cat Beast — this exact pool's own real printing, reused
// here purely as an opponent's board-state filler the same way it's reused
// as filler elsewhere in this pool, e.g. weapons-vendor's/g-raha-tia's own
// scenarios).

import { whiteAuracite } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{2}{W}{W}') },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: whiteAuracite.name,
    types: ['Artifact'],
  });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { preferTarget: (c) => c.getName() === 'Coeurl' });

  // Real opponent's nonland permanent already on the battlefield — the
  // legal target the ETB exile effect needs.
  pilot.beginStep("A real opponent's nonland permanent (Coeurl) already on the battlefield");
  const oppCreature = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: oppCreature.name, zone: 'Battlefield', power: 2, toughness: 2, controller: pilot.opponents[0]!.name });

  // Cast White Auracite ({2}{W}{W}), real mana payment; resolving it
  // auto-fires its real 603.6b onEnter trigger, exiling the opponent's
  // Coeurl for real.
  pilotCast(pilot, cardReal, whiteAuracite, ctx, actions);
  pilotResolveTop(pilot);

  const result =
    "White Auracite is cast for {2}{W}{W} and resolves; its ETB trigger exiles a nonland permanent an opponent controls (Coeurl). Its own \"{T}: Add {W}.\" mana ability has no scenario evidence — this model has no way to pilot a plain mana ability at all (see this card's own definition.ts comment).";
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> real ETB exile of an opponent nonland permanent', result)];
}
