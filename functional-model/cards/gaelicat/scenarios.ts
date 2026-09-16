// Real engine-piloted trace (see engine-trace.ts's own header). Gaelicat has
// no triggers/resolvable effects of its own to pilot — its only real text
// beyond the bare printed Flying/Vigilance keywords is a conditional
// layer-7a CDA ("As long as you control two or more artifacts, this
// creature gets +2/+0"), now real via `card.ts`'s
// `ptFormula.kind:'thresholdBonus'` (closed 2026-09-15, fin/16-25 pass —
// see that field's own doc comment for the real Forge citation). This
// trace demonstrates BOTH halves for real: (1) the condition (2+ real
// Artifact permanents you control) via genuine logged `isArtifact()` reads;
// (2) `effectivePT` — the same real, live layer-7a read Adelbert Steiner's
// own scenario uses — now genuinely recalculates to Gaelicat's printed 3/3
// (1/3 base +2/+0) once the threshold is met, a real engine-computed
// value, not text-only anymore.

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
  pilot.beginStep('Artifacts already on the battlefield (2, meets the printed threshold)');
  const phoenixDown = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Phoenix Down', types: ['Artifact'] });
  const elixir = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Elixir', types: ['Artifact'] });
  // A real `enters` entry for each bystander (aerith-gainsborough/
  // scenarios.ts's own convention) — without one, a permanent placed
  // directly via `addCard` never shows up on the replay board at all (the
  // replay UI only seeds a card from a real log entry naming it; a later
  // `read:isArtifact` entry alone registers it in the 'Unknown' zone, not
  // 'Battlefield' — confirmed the hard way: the user-visible bug this fixes,
  // both real artifacts invisible on fin/22's replay board).
  pilot.log.push({ fn: 'enters', card: phoenixDown.name, zone: 'Battlefield' });
  pilot.log.push({ fn: 'enters', card: elixir.name, zone: 'Battlefield' });

  const gaelicatReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: gaelicat.name,
    types: ['Creature'],
    subtypes: ['Cat'],
    keywords: gaelicat.keywords,
    basePower: gaelicat.pt?.[0],
    baseToughness: gaelicat.pt?.[1],
    // `pilot.state.addCard` (unlike `harness.ts`'s own generic `runScenario`,
    // which copies `effectiveCard.ptFormula` onto every card automatically)
    // is a raw, manual `RealCard` build — `ptFormula` has to be threaded
    // through explicitly here or the real layer-7a CDA this card now has
    // never actually applies (a real bug this pilot script itself hit
    // 2026-09-15, caught by the stale doc comment/result string below
    // claiming a gap that was already closed).
    ptFormula: gaelicat.ptFormula,
  });
  const actions = pilotActions(pilot, gaelicatReal.id);
  const ctx = pilot.ctxFor(gaelicatReal);

  // Cast Gaelicat ({2}{W}), real mana payment
  pilotCast(pilot, gaelicatReal, gaelicat, ctx, actions);
  pilotResolveTop(pilot);

  // Real, per-object type reads — the condition ("you control two or more
  // artifacts") is genuinely observable board state, same logging wrapper
  // (`loggingCard`) every real Card query in this engine goes through.
  pilot.beginStep("Condition check — 'you control two or more artifacts'");
  const phoenixIsArtifact = loggingCard(pilot.state, phoenixDown, pilot.log).isArtifact();
  const elixirIsArtifact = loggingCard(pilot.state, elixir, pilot.log).isArtifact();

  // Real layer-7a read — same live `effectivePT` Adelbert Steiner's own
  // scenario uses. Now genuinely recalculates to 3/3 (printed 1/3 +2/+0)
  // once the threshold is met — a real, live engine computation, not
  // text-only.
  pilot.beginStep('Layer-7a read — threshold-CDA machinery now applies the +2/+0');
  const [power, toughness] = effectivePT(pilot.state, gaelicatReal);
  pilot.log.push({ fn: 'read:getNetPower', card: gaelicat.name, power, toughness });

  const result = `Gaelicat enters with 2 Artifacts (Phoenix Down, Elixir; confirmed isArtifact()=${phoenixIsArtifact}/${elixirIsArtifact}) already on the battlefield, meeting the printed "two or more artifacts" threshold — layer-7a effectivePT genuinely recalculates to ${power}/${toughness} (printed 1/3 +2/+0), real threshold-CDA machinery now in place (closed 2026-09-15, same mechanism as scorpion-sentinel/gigantoad's own identically-shaped land-count buffs).`;
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: 2 artifacts present -> cast -> real threshold-CDA pump applies', result)];
}
