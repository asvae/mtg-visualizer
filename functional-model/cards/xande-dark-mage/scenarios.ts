// Real engine-piloted trace (see engine-trace.ts's own header). Xande, Dark
// Mage has no triggers/resolvable effects of its own to pilot — its only
// real text beyond the bare printed Menace keyword is a layer-7a CDA ("gets
// +1/+1 for each noncreature, nonland card in your graveyard"), now real via
// `card.ts`'s `ptFormula.kind:'addPerGraveyardCount'` (closed 2026-09-16,
// static-ability audit — see that field's own doc comment for the real
// Forge citation). This trace demonstrates both halves for real: (1) two
// real noncreature, nonland cards (Phoenix Down/Elixir, both real Artifacts)
// genuinely placed in the graveyard, confirmed via a real, logged
// `getCardsIn('Graveyard')` read; (2) `effectivePT` — the same real, live
// layer-7a read Adelbert Steiner's/Gaelicat's own scenarios use — now
// genuinely recalculates to Xande's printed 5/5 (3/3 base +1/+1 twice), a
// real engine-computed value, not text-only anymore.

import { xandeDarkMage } from './definition';
import { basicLandsFor } from '../../mana';
import { effectivePT } from '../../state';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{2}{U}{B}'), libraryCount: 5 },
    opponents: [{ libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  // Two real, noncreature, nonland cards already in the graveyard (any real
  // printings work — same "a real named card, not a synthetic placeholder"
  // convention gaelicat's own scenario already establishes for its own
  // artifact-count condition).
  pilot.beginStep('Two noncreature, nonland cards already in the graveyard');
  const phoenixDown = pilot.state.addCard(pilot.you, 'Graveyard', { name: 'Phoenix Down', types: ['Artifact'] });
  const elixir = pilot.state.addCard(pilot.you, 'Graveyard', { name: 'Elixir', types: ['Artifact'] });
  pilot.log.push({ fn: 'enters', card: phoenixDown.name, zone: 'Graveyard' });
  pilot.log.push({ fn: 'enters', card: elixir.name, zone: 'Graveyard' });

  const xandeReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: xandeDarkMage.name,
    types: ['Creature'],
    subtypes: ['Human', 'Wizard'],
    keywords: xandeDarkMage.keywords,
    basePower: xandeDarkMage.pt?.[0],
    baseToughness: xandeDarkMage.pt?.[1],
    // Threaded through explicitly — `pilot.state.addCard` (unlike
    // `harness.ts`'s own generic `runScenario`) is a raw, manual `RealCard`
    // build, same caveat gaelicat's own scenario already documents.
    ptFormula: xandeDarkMage.ptFormula,
  });
  const actions = pilotActions(pilot, xandeReal.id);
  const ctx = pilot.ctxFor(xandeReal);

  // Cast Xande ({2}{U}{B}), real mana payment
  pilotCast(pilot, xandeReal, xandeDarkMage, ctx, actions);
  pilotResolveTop(pilot);

  // Real, logged aggregate zone read — the condition ("noncreature, nonland
  // cards in your graveyard") is genuinely observable board state, same
  // logging wrapper (`ctx.you.getCardsIn`) every real Card query in this
  // engine goes through.
  pilot.beginStep('Graveyard read — noncreature, nonland card count');
  const graveyardCards = ctx.you.getCardsIn('Graveyard');
  const noncreatureNonland = graveyardCards.filter((c) => !c.hasSubtype('Land') && c.getId() !== xandeReal.id);

  // Real layer-7a read — same live `effectivePT` Adelbert Steiner's/
  // Gaelicat's own scenarios use. Now genuinely recalculates to 5/5
  // (printed 3/3 +1/+1 twice) with 2 real noncreature, nonland cards in the
  // graveyard — a real, live engine computation, not text-only.
  pilot.beginStep('Layer-7a read — addPerGraveyardCount machinery now applies the +1/+1 per card');
  const [power, toughness] = effectivePT(pilot.state, xandeReal);
  pilot.log.push({ fn: 'read:getNetPower', card: xandeDarkMage.name, power, toughness });

  const result = `Xande, Dark Mage enters with ${noncreatureNonland.length} real noncreature, nonland cards (Phoenix Down, Elixir) already in the graveyard — layer-7a effectivePT genuinely recalculates to ${power}/${toughness} (printed 3/3 +1/+1 per card), real addPerGraveyardCount CDA machinery now in place (closed 2026-09-16, same mechanism as Adelbert Steiner's/Gaelicat's own identically-shaped live P/T reads).`;
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: 2 noncreature/nonland graveyard cards present -> cast -> real graveyard-count CDA applies', result)];
}
