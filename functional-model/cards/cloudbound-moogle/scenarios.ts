// Real engine-piloted trace (see engine-trace.ts's own header). Two
// independent real scenarios, same "genuinely two different real actions,
// not two branches of one" reasoning auron-s-inspiration's own normalCast/
// flashbackCast split already establishes: Cloudbound Moogle is either CAST
// normally (its own ETB fires) or CYCLED (discarded from hand instead,
// never entering the battlefield at all) — never both with the same
// physical card.
//
// Plainscycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) is now a
// real, structured, engine-piloted activated ability — see definition.ts's
// own comment for the full mechanism. Its own real Forge citation:
// `res/cardsfolder/t/timeless_dragon.txt`'s `K:TypeCycling:Plains:2`.

import { cloudboundMoogle } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotActivate, pilotFireTrigger, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

function castAndEnters(): TraceResult {
  // Another real creature already on the battlefield so the ETB's own
  // +1/+1-counter target lands on IT, not self (same board shape the old
  // flat scenario used — `chooseTarget`'s deterministic pool ordering picks
  // the pre-existing creature over the just-resolved self).
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{3}{W}{W}'), creaturesCount: 1 } };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Hand', {
    name: cloudboundMoogle.name,
    types: ['Creature'],
    subtypes: ['Moogle'],
    keywords: cloudboundMoogle.keywords,
    basePower: cloudboundMoogle.pt?.[0],
    baseToughness: cloudboundMoogle.pt?.[1],
  });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  pilotCast(pilot, real, cloudboundMoogle, ctx, actions);
  pilotResolveTop(pilot);
  // onEnter has no `on: 'enter'` auto-fire wiring on this card — fired
  // manually, same convention every non-auto-fired ETB in this pool uses.
  pilotFireTrigger(pilot, cloudboundMoogle, ctx, actions, 'onEnter');

  const result = 'Cloudbound Moogle is cast ({3}{W}{W} paid) and enters the battlefield; its ETB puts a +1/+1 counter on the other real creature you control.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> resolve -> enters -> ETB counter', result);
}

function plainscycling(): TraceResult {
  const setup: EnginePilotSetup = { you: { basicLands: basicLandsFor('{2}') } };
  const pilot = setupEnginePilot(setup);
  // A real Plains, not invented placeholder filler — the actual real card
  // Plainscycling's own search needs to find.
  pilot.state.addCard(pilot.you, 'Library', { name: 'Plains', types: ['Land'], subtypes: ['Plains'] });
  const real = pilot.state.addCard(pilot.you, 'Hand', { name: cloudboundMoogle.name, types: ['Creature'], subtypes: ['Moogle'] });
  const actions = pilotActions(pilot, real.id);
  const ctx = pilot.ctxFor(real);

  // Real 602.1 activation FROM HAND: {2} paid, Cloudbound Moogle itself
  // genuinely discarded (Hand -> Graveyard) as part of the cost, then the
  // ability resolves as a real library search — never entering the
  // battlefield at all.
  pilotActivate(pilot, pilot.you, real, cloudboundMoogle, ctx, actions, 'Activate Plainscycling ({2}, Discard this card): search for a Plains', 'cycling');
  pilotResolveTop(pilot);

  const result =
    'Plainscycling {2} is activated from hand: {2} is paid, Cloudbound Moogle is genuinely discarded (never cast, never enters the battlefield) as part of the cost, then the ability resolves for real — searching the library for the real Plains card, putting it into hand, then shuffling.';
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: Plainscycling activated from hand -> discard self -> search library -> shuffle', result);
}

export function runEngineScenarios(): TraceResult[] {
  return [castAndEnters(), plainscycling()];
}
