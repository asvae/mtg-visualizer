// Real engine-piloted trace (see engine-trace.ts's own header) — REPLACES
// the earlier bare `{trigger:'onOtherPermanentsDie'}` flat-scenario shortcut.
// That shape's own `lifecycleBefore`/`lifecycleAfter` (harness.ts) skip the
// cast/enters lifecycle entirely for a `trigger`-shaped scenario ("already on
// the battlefield" — see that function's own doc comment), so it produced no
// real evidence at all for this card's own baseline self-cast/self-enters
// facts. `onDies`-class triggers deliberately never auto-fire anywhere in
// this engine (same real pattern aerith-gainsborough/dwarven-castle-guard
// already establish): the real event has to actually happen first, THEN the
// trigger fires manually to demonstrate its own effect.
//
// Real oracle text: "Reach\nThe Allagan Eye — Whenever one or more OTHER
// creatures and/or artifacts you control die, draw a card." — the creature
// that dies here is deliberately NOT G'raha Tia itself (a separate real
// creature, Town Greeter), matching the printed "other" restriction; G'raha
// survives untouched.

import { gRahaTia } from './definition';
import { basicLandsFor } from '../../mana';
import { checkStateBasedActions } from '../../sba';
import { effectivePT } from '../../state';
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
    you: { basicLands: basicLandsFor('{4}{W}'), libraryCount: 8 },
    opponents: [{ libraryCount: 8 }],
  };
  const pilot = setupEnginePilot(setup);

  const grahaReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: gRahaTia.name,
    types: ['Creature'],
    subtypes: ['Cat', 'Archer'],
    keywords: gRahaTia.keywords,
    basePower: gRahaTia.pt?.[0],
    baseToughness: gRahaTia.pt?.[1],
  });
  const actions = pilotActions(pilot, grahaReal.id);
  const ctx = pilot.ctxFor(grahaReal);

  // Cast G'raha Tia ({4}{W}), real mana payment
  pilotCast(pilot, grahaReal, gRahaTia, ctx, actions);
  pilotResolveTop(pilot);

  // A real, SEPARATE creature you control (Town Greeter — real fin {1}{G}
  // 1/1 Human Citizen, added directly rather than cast; its own real ETB
  // text never fires here, only its stat block matters as combat filler) —
  // this is the one that dies below, never G'raha itself.
  const townGreeter = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: 'Town Greeter',
    types: ['Creature'],
    subtypes: ['Human', 'Citizen'],
    basePower: 1,
    baseToughness: 1,
  });
  pilot.log.push({ fn: 'enters', card: townGreeter.name, zone: 'Battlefield', power: 1, toughness: 1, controller: pilot.you.name });

  // A real opponent's 2/2 (Coeurl — same real card dwarven-castle-guard's
  // own scenario already uses as a blocker) — kills Town Greeter outright
  // in blocked combat while taking no lethal damage back.
  const blocker = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {
    name: 'Coeurl',
    types: ['Creature'],
    subtypes: ['Cat', 'Beast'],
    basePower: 2,
    baseToughness: 2,
  });
  pilot.log.push({ fn: 'enters', card: blocker.name, zone: 'Battlefield', power: 2, toughness: 2, controller: pilot.opponents[0]!.name });

  // Real turn passage — summoning sickness clears for Town Greeter
  advanceToPlayersNextMain1(pilot, pilot.you);

  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [townGreeter], 'Declare Town Greeter as attacker');
  advanceOneStep(pilot);
  pilotDeclareBlockers(pilot, [{ blocker, attacker: townGreeter }]);
  pilot.beginStep('Resolve lethal combat damage (704.5g SBA) — Town Greeter dies, Coeurl survives');
  const attackerPower = effectivePT(pilot.state, townGreeter)[0];
  const blockerPower = effectivePT(pilot.state, blocker)[0];
  resolveCombatDamage(pilot.engine);
  if (attackerPower > 0) pilot.log.push({ fn: 'dealDamage', source: townGreeter.name, target: blocker.name, amount: attackerPower });
  if (blockerPower > 0) pilot.log.push({ fn: 'dealDamage', source: blocker.name, target: townGreeter.name, amount: blockerPower });
  const sbaResult = checkStateBasedActions(pilot.state, pilot.engine.players);
  for (const destroyed of sbaResult.destroyed) {
    const controllerName = pilot.state.players.get(destroyed.controllerId)!.name;
    pilot.log.push({ fn: 'destroy', target: destroyed.name, controller: controllerName });
  }

  // G'raha's own real trigger — a real OTHER creature you control just died
  // (Town Greeter, above); fired manually once the real death has already
  // happened, same "no auto-fire" pattern every onDies-class trigger in this
  // engine already uses.
  if (townGreeter.zone === 'Graveyard') pilotFireTrigger(pilot, gRahaTia, ctx, actions, 'onOtherPermanentsDie');

  const result =
    "G'raha Tia is cast and enters the battlefield; a separate creature you control (Town Greeter) attacks, is blocked by a 2/2 (Coeurl) and dies in lethal combat (704.5g) while G'raha survives untouched — G'raha's own The Allagan Eye trigger then fires, drawing a card.";
  return [
    finishEnginePilotTrace(pilot, setup, "engine playthrough: cast -> other-creature combat death -> onOtherPermanentsDie", result),
  ];
}
