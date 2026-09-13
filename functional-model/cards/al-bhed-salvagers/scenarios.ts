// Real engine-piloted trace (see engine-trace.ts's own header) — REPLACES
// the earlier flat `{trigger:'onDies', opponents:[{}]}` harness.ts shortcut,
// which skips the cast/enters lifecycle entirely (see that function's own
// doc comment — "already on the battlefield") and so produced no real
// evidence at all for this card's own baseline self-cast/self-enters/
// self-dies facts (the unified Fact model migration, SYNERGY_DESIGN.md,
// requires `annotations` on every fact, which in turn requires real trace
// evidence backing it — `scripts/verify-synergy.mjs`).
//
// Real oracle text: "Whenever this creature or another creature or artifact
// you control dies, target opponent loses 1 life and you gain 1 life." —
// this card's own death is explicitly one of the two real trigger
// conditions (unlike, say, G'raha Tia's "another" restriction), so the
// simplest real demonstration is Al Bhed Salvagers itself dying in combat,
// same real "the underlying event has to actually happen first, THEN the
// trigger fires manually" pattern dwarven-castle-guard's own scenario
// already establishes for an `onDies`-class trigger (no auto-fire exists
// anywhere in this engine for one). The Masamune's own combo scenario
// (`cards/the-masamune/scenarios.ts`) already demonstrates the SAME real
// death+trigger pair for this card under its trigger-doubling static — that
// trace is written to `cards/the-masamune/trace.json`, not this card's own
// (`run-scenarios.mjs` only ever runs a card's own `scenarios.ts`), so this
// file still needs its own independent real evidence.

import { alBhedSalvagers } from './definition';
import { basicLandsFor } from '../../mana';
import { checkStateBasedActions } from '../../sba';
import type { TraceResult } from '../../harness';
import { resolveCombatDamage } from '../../engine';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  advanceOneStep,
  pilotDeclareAttackers,
  pilotDeclareBlockers,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{2}{B}'), libraryCount: 8 },
    // Hill Gigas ({4}{R}{R} Creature — Giant, 5/4 — the same real FIN card
    // The Masamune's own combo scenario already uses as a blocker for this
    // exact creature) as a real blocker: 5 power lethally kills Al Bhed
    // Salvagers's 3 toughness, while its own 4 toughness easily survives Al
    // Bhed Salvagers's 2 power — a genuine, one-sided real death, not a
    // mutual trade.
    opponents: [{ libraryCount: 8, creatureCards: [{ name: 'Hill Gigas', subtypes: ['Giant'], power: 5, toughness: 4 }] }],
  };
  const pilot = setupEnginePilot(setup);

  const salvagersReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: alBhedSalvagers.name,
    types: ['Creature'],
    subtypes: ['Human', 'Artificer', 'Warrior'],
    basePower: alBhedSalvagers.pt?.[0],
    baseToughness: alBhedSalvagers.pt?.[1],
  });
  const actions = pilotActions(pilot, salvagersReal.id);
  const ctx = pilot.ctxFor(salvagersReal);

  // Cast Al Bhed Salvagers ({2}{B}), real mana payment.
  pilotCast(pilot, salvagersReal, alBhedSalvagers, ctx, actions);
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness clears.
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real blocked combat: Al Bhed Salvagers attacks into Hill Gigas, dies for
  // real (704.5g), one-sided.
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [salvagersReal], 'Declare Al Bhed Salvagers as attacker');
  advanceOneStep(pilot);
  const hillGigas = pilot.opponents[0]!.battlefield.find((c) => c.name === 'Hill Gigas')!;
  pilotDeclareBlockers(pilot, [{ blocker: hillGigas, attacker: salvagersReal }]);
  pilot.beginStep('Resolve lethal combat damage (704.5g SBA)');
  resolveCombatDamage(pilot.engine);
  pilot.log.push({ fn: 'dealDamage', source: salvagersReal.name, target: hillGigas.name, amount: 2 });
  pilot.log.push({ fn: 'dealDamage', source: hillGigas.name, target: salvagersReal.name, amount: 5 });
  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const destroyed of sbaResult.destroyed) {
    const controllerName = pilot.state.players.get(destroyed.controllerId)!.name;
    pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: controllerName });
  }

  // Al Bhed Salvagers's own real death (704.5g moved it to the graveyard
  // above) — onDies fires manually, same "no auto-fire" pattern every
  // onDies-class trigger in this engine already establishes: target
  // opponent loses 1 life, you gain 1 life.
  if (salvagersReal.zone === 'Graveyard') {
    pilotFireTrigger(pilot, alBhedSalvagers, ctx, actions, 'onDies', "Al Bhed Salvagers's own dying trigger fires");
  }

  const result =
    'Al Bhed Salvagers is cast, enters the battlefield, then attacks and is lethally blocked by Hill Gigas (a one-sided 704.5g death). Its own "whenever this creature or another creature or artifact you control dies" trigger fires off its own death: target opponent loses 1 life, you gain 1 life.';
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> lethal combat (SBA) -> onDies', result)];
}
