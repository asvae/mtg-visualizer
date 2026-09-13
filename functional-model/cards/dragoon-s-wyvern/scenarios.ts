// Real engine-piloted trace (see engine-trace.ts's own header) — replaces
// the old flat harness.ts `{ result, trigger: 'onEnter' }` shortcut
// (2026-09-12, continuation of the fin/1-49 unified-Fact rollout). Standing
// rule: default to ONE real scenario per card (branching/multi-scenario
// needs a significant reason — this card, close to vanilla-plus-one-
// trigger, has none). Dragoon's Wyvern's own printed Flying is a bare
// keyword (no grant, no fact) — nothing to demonstrate beyond the real
// card's basic function: cast -> real ETB -> its real onEnter trigger
// auto-fires, creating a real 1/1 colorless Hero creature token.

import { dragoonsWyvern } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{2}{U}') },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  const wyvernReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: dragoonsWyvern.name,
    types: ['Creature'],
    subtypes: ['Drake'],
    keywords: dragoonsWyvern.keywords,
    basePower: dragoonsWyvern.pt?.[0],
    baseToughness: dragoonsWyvern.pt?.[1],
  });
  const actions = pilotActions(pilot, wyvernReal.id);
  const ctx = pilot.ctxFor(wyvernReal);

  // Cast Dragoon's Wyvern ({2}{U}), real mana payment; resolving it auto-fires
  // its real onEnter trigger — creates a real 1/1 colorless Hero creature
  // token, same auto-fire-on-resolve mechanism weapons-vendor's own ETB draw
  // already demonstrates.
  pilotCast(pilot, wyvernReal, dragoonsWyvern, ctx, actions);
  pilotResolveTop(pilot);

  const result =
    "Dragoon's Wyvern is cast for {2}{U} and resolves, entering the battlefield; its onEnter trigger auto-fires, creating a 1/1 colorless Hero creature token.";
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> ETB -> onEnter auto-fires -> creates a 1/1 colorless Hero creature token', result)];
}
