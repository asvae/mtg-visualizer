// Real engine-piloted trace (see engine-trace.ts's own header). Gaelicat has
// no triggers/resolvable effects of its own to pilot — its only real text
// beyond the bare printed Flying/Vigilance keywords is a conditional
// layer-7a CDA ("As long as you control two or more artifacts, this
// creature gets +2/+0"). Unlike Adelbert Steiner's own count-scaling
// `ptFormula` CDA, this is a THRESHOLD-gated shape this engine has no
// `ptFormula` variant for (see definition.ts's own comment, and
// `card.ts`'s `CardDefinition.ptFormula` doc comment) — so this trace
// deliberately demonstrates BOTH halves honestly: (1) the condition itself
// (2+ real Artifact permanents you control) is real, observable board
// state, via genuine logged `isArtifact()` reads; (2) `effectivePT` — the
// same real, live layer-7a read Steiner's own scenario uses — stays at
// Gaelicat's unmodified printed 1/3 even with 2 real artifacts present,
// which is the honest, documented engine gap, not a fabricated bonus.

import { gaelicat } from './definition';
import { basicLandsFor } from '../../mana';
import { effectivePT } from '../../state';
import { loggingCard } from '../../harness';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{2}{W}'), libraryCount: 5 },
    opponents: [{ libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  // Two real named fin Artifacts (any real printing works — same "a real
  // named card, not a synthetic placeholder" convention ashe-princess-of-
  // dalmasca's own scenario already establishes for a single real artifact).
  pilot.beginStep('Real artifacts already on the battlefield (2, meets the printed threshold)');
  const phoenixDown = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Phoenix Down', types: ['Artifact'] });
  const elixir = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Elixir', types: ['Artifact'] });

  const gaelicatReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: gaelicat.name,
    types: ['Creature'],
    subtypes: ['Cat'],
    keywords: gaelicat.keywords,
    basePower: gaelicat.pt?.[0],
    baseToughness: gaelicat.pt?.[1],
  });
  const actions = pilotActions(pilot, gaelicatReal.id);
  const ctx = pilot.ctxFor(gaelicatReal);

  // Cast Gaelicat ({2}{W}), real mana payment
  pilotCast(pilot, gaelicatReal, gaelicat, ctx, actions);
  pilotResolveTop(pilot);

  // Real, per-object type reads — the condition ("you control two or more
  // artifacts") is genuinely observable board state, same logging wrapper
  // (`loggingCard`) every real Card query in this engine goes through.
  pilot.beginStep("Real condition check — 'you control two or more artifacts'");
  const phoenixIsArtifact = loggingCard(pilot.state, phoenixDown, pilot.log).isArtifact();
  const elixirIsArtifact = loggingCard(pilot.state, elixir, pilot.log).isArtifact();

  // Real layer-7a read — same live `effectivePT` Adelbert Steiner's own
  // scenario uses. Honestly reports Gaelicat's UNMODIFIED printed 1/3: this
  // engine has no threshold-gated `ptFormula` variant, so the printed
  // "+2/+0" never actually applies here — a real, documented gap, not
  // fabricated evidence of a bonus that doesn't happen.
  pilot.beginStep('Real layer-7a read — no threshold-CDA machinery, so the +2/+0 does not apply');
  const [power, toughness] = effectivePT(pilot.state, gaelicatReal);
  pilot.log.push({ fn: 'read:getNetPower', card: gaelicat.name, power, toughness });

  const result = `Gaelicat enters with 2 real Artifacts (Phoenix Down, Elixir; confirmed isArtifact()=${phoenixIsArtifact}/${elixirIsArtifact}) already on the battlefield, meeting the printed "two or more artifacts" threshold — but real layer-7a effectivePT still reports Gaelicat's unmodified printed ${power}/${toughness}, since this engine has no threshold-gated CDA machinery to apply the printed +2/+0 (a real, documented gap, same class as scorpion-sentinel/gigantoad's own identically-shaped land-count buffs).`;
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: 2 real artifacts present -> cast -> real condition/CDA reads (gap documented)', result)];
}
