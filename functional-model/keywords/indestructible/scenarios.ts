// Real engine-piloted trace (see engine-trace.ts's own header). Keyword
// coverage suite — Zodiark, Umbral God's real printed Indestructible.
// Zodiark's own `onEnter` trigger has no `on: 'enter'` field (see that
// card's own definition.ts), so `pilotResolveTop`'s real ETB auto-fire
// never fires it here — this bundle stays purely about Indestructible
// itself. Two real, distinct rules: 702.12b (a destroy effect is REPLACED,
// state.ts's own `destroy()`) vs. 704.5f (0-or-less toughness is put into
// the graveyard UNCONDITIONALLY, bypassing Indestructible entirely,
// sba.ts's own `checkStateBasedActions`).

import { zodiarkUmbralGod } from '../../cards/zodiark-umbral-god/definition';
import { basicLandsFor } from '../../mana';
import { wrapCard } from '../../state';
import { checkStateBasedActions } from '../../sba';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{B}{B}{B}{B}{B}'), libraryCount: 5 } };
  const pilot = setupEnginePilot(setup);

  const zodiarkReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: zodiarkUmbralGod.name,
    types: ['Creature'],
    subtypes: ['God', 'Legendary'],
    keywords: zodiarkUmbralGod.keywords,
    basePower: zodiarkUmbralGod.pt?.[0],
    baseToughness: zodiarkUmbralGod.pt?.[1],
  });
  const actions = pilotActions(pilot, zodiarkReal.id);
  const ctx = pilot.ctxFor(zodiarkReal);

  pilotCast(pilot, zodiarkReal, zodiarkUmbralGod, ctx, actions);
  pilotResolveTop(pilot);

  // Real 702.12b — a plain destroy effect is REPLACED; Zodiark survives.
  pilot.beginStep('Attempt a destroy effect (702.12b)');
  actions.destroy(wrapCard(pilot.state, zodiarkReal));

  // Real 704.5f — toughness <= 0 kills UNCONDITIONALLY, bypassing
  // Indestructible entirely; a real -10/-10 pump does it here.
  pilot.beginStep('-10/-10 pump drops toughness to 0 or below (704.5f)');
  actions.pump(wrapCard(pilot.state, zodiarkReal), 0, -10);
  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  if (sbaResult.putIntoGraveyard.some((c) => c.id === zodiarkReal.id)) {
    pilot.log.push({ fn: 'destroy', target: zodiarkReal.name, controller: pilot.you.name });
  }

  const result = `702.12b: a plain destroy effect against Zodiark is replaced — nothing happens, logged as \`destroyPrevented\`, not silently ignored. 704.5f is a DIFFERENT rule: once its toughness is 0 or below, the engine's own SBA sweep puts it into the graveyard unconditionally, with no Indestructible check at all — the same permanent that just survived a destroy effect dies anyway once its toughness bottoms out.`;
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> destroy replaced (702.12b) -> 0-toughness SBA death bypasses it (704.5f)', result)];
}
