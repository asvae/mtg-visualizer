// Real engine-piloted trace (see engine-trace.ts's own header) — REPLACES
// the earlier flat `harness.ts` scenario (which only demonstrated the plain
// Equip activation) now that a real, full combo line is worth showing:
// Al Bhed Salvagers (a real FIN creature already modeled with its own
// `onDies` trigger, `cards/al-bhed-salvagers/definition.ts`) is equipped
// with The Masamune, then genuinely dies in real combat — its own dying
// trigger fires TWICE, because Masamune's own "Equipped creature has 'If a
// creature dying causes a triggered ability of this creature ... to
// trigger, that ability triggers an additional time'" is now real machinery
// (ENGINE_GAPS.md gap #13, closed 2026-09-12: `card.ts`'s `triggerDoubling`,
// `triggers.ts`'s shared `fireTrigger`, `state.ts`'s `shouldDoubleTrigger`).
//
// Same real "the underlying event has to actually happen first, THEN the
// trigger fires manually" pattern dwarven-castle-guard's own scenario
// already establishes for an `onDies`-class trigger (no auto-fire exists
// anywhere in this engine for a dies-triggered ability) — this scenario
// additionally passes a real `{kind:'dying'}` cause to `pilotFireTrigger` so
// Masamune's own `causedBy:'dying'`-gated grant is genuinely checked, not
// just its `equippedSelf` scope.
//
// Real, accepted simplification, not a new gap: this engine has no SBA that
// unattaches an Equipment when its wearer leaves the battlefield (CR
// 704.5m-adjacent — not modeled anywhere here) — Masamune's own
// `attachedToId` link to Al Bhed Salvagers is untouched by Al Bhed
// Salvagers's own move to the graveyard, so the doubling grant is still
// found by last-known-attachment at the moment the dying trigger fires,
// which is the REAL 603.6b-correct answer here anyway (an ability that
// triggers on a creature leaving the battlefield uses its last-known
// information, including "was this creature equipped by Masamune").
//
// The "as long as equipped creature is attacking, it has first strike and
// must be blocked if able" static has no representable mechanism in this
// engine (see definition.ts's own comment) — unexercised by this scenario,
// same as before.

import { theMasamune } from './definition';
import { alBhedSalvagers } from '../al-bhed-salvagers/definition';
import { basicLandsFor } from '../../mana';
import { checkStateBasedActions } from '../../sba';
import type { TraceResult } from '../../harness';
import { resolveCombatDamage } from '../../engine';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  pilotActivate,
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
    // {2}{B} (Al Bhed Salvagers) + {3} (Masamune) + {2} (Equip {2}) = 7
    // generic-equivalent mana total, plus the one real {B} pip — a single
    // land pool covers every real cast/activation across both turns (lands
    // fully untap between them), same "one pool suffices" convention
    // cloud-midgar-mercenary's own scenario already establishes.
    you: { basicLands: basicLandsFor('{2}{B}{3}{2}'), libraryCount: 8 },
    // Hill Gigas ({4}{R}{R} Creature — Giant, 5/4 — the same real FIN card
    // diamond-weapon's own scenario already uses as a real attacker) as a
    // real blocker: 5 power lethally kills Al Bhed Salvagers's 3 toughness,
    // while its own 4 toughness easily survives Al Bhed Salvagers's 2 power
    // — a genuine, ONE-SIDED real death, not a mutual trade, so the ONLY
    // thing that dies is the creature whose own dying trigger this scenario
    // needs to demonstrate.
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
  const salvagersActions = pilotActions(pilot, salvagersReal.id);
  const salvagersCtx = pilot.ctxFor(salvagersReal);

  // Turn 1: cast Al Bhed Salvagers ({2}{B}), real mana payment.
  pilotCast(pilot, salvagersReal, alBhedSalvagers, salvagersCtx, salvagersActions);
  pilotResolveTop(pilot);

  const masamuneReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: theMasamune.name,
    types: ['Artifact'],
    subtypes: ['Equipment'],
  });
  const masamuneActions = pilotActions(pilot, masamuneReal.id);
  const masamuneCtx = pilot.ctxFor(masamuneReal);

  // Still turn 1: cast The Masamune ({3}).
  pilotCast(pilot, masamuneReal, theMasamune, masamuneCtx, masamuneActions);
  pilotResolveTop(pilot); // enters the battlefield, unattached

  // Turn 2 (lands untap for real; Al Bhed Salvagers's own 302.6 summoning
  // sickness has now genuinely cleared, entered turn 1).
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Equip {2}: attach Masamune to Al Bhed Salvagers for real
  // (`actions.equip`, 301.5c sorcery-speed-gated).
  pilotActivate(pilot, pilot.you, masamuneReal, theMasamune, masamuneCtx, masamuneActions, 'Equip {2}: attach The Masamune to Al Bhed Salvagers');
  pilotResolveTop(pilot); // runs the real custom effect: chooses Al Bhed Salvagers (the only creature you control), attaches

  // Real blocked combat: Al Bhed Salvagers attacks into Hill Gigas, dies for real (704.5g).
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [salvagersReal], 'Declare Al Bhed Salvagers (equipped) as attacker');
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
  // above) — onDies fires manually (same real "no auto-fire" pattern
  // dwarven-castle-guard's own scenario already establishes), passing the
  // real `{kind:'dying'}` cause Masamune's own doubling grant is gated on.
  // Because it was genuinely equipped by Masamune when it died, this fires
  // TWICE — the opponent loses 1 life and the caster gains 1 life, TWICE.
  if (salvagersReal.zone === 'Graveyard') {
    pilotFireTrigger(
      pilot,
      alBhedSalvagers,
      salvagersCtx,
      salvagersActions,
      'onDies',
      "Al Bhed Salvagers's own dying trigger fires — doubled by The Masamune's own equipped static",
      { kind: 'dying' }
    );
  }

  const result =
    "Al Bhed Salvagers is cast, then equipped with The Masamune (Equip {2}). It attacks and is lethally blocked by Hill Gigas (a one-sided 704.5g death — only Al Bhed Salvagers dies). Its own \"whenever this creature or another creature or artifact you control dies\" trigger fires — and, because a creature's OWN death caused it while equipped by Masamune, Masamune's own \"triggers an additional time\" static (ENGINE_GAPS.md gap #13) doubles it: the opponent loses 1 life and you gain 1 life, TWICE.";
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      "engine playthrough: cast + equip Al Bhed Salvagers -> lethal combat (SBA) -> its own dying trigger fires TWICE (The Masamune's own doubling static)",
      result
    ),
  ];
}
