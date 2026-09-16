// Real engine-piloted trace (see engine-trace.ts's own header) — replaces
// the old harness.ts-style `Scenario[]` (2-scenario, declarative
// `creaturesCount`/`equipmentCount` shape) with ONE real playthrough, per
// this session's own standing rule (SYNERGY_DESIGN.md): default to 1
// scenario for a simple, non-branching Instant — this card just needs to
// demonstrate real damage with a real nonzero creature+Equipment count
// present, not exhaustive coverage of every magnitude combination.
//
// Real FIN permanents (data/fin/fin_scryfall.json), not invented filler:
// you control two real creatures (Coeurl, {1}{W} 2/2; Dwarven Castle Guard,
// {1}{W} 2/1 — this exact card's own real printing, reused here purely as
// board-state filler the same way it's reused as a blocker elsewhere in
// this pool) and one real Equipment (White Mage's Staff, {1}{W} Artifact —
// Equipment) — magnitude 2 creatures + 1 Equipment = 3. An opponent's
// creature (Ahriman, {2}{B} 2/2) is present too, to show the pool really is
// cross-player (real `ValidTgts$ Creature` carries no owner restriction).
//
// RESOLVED (2026-09-16, engine-core): `combinator.ts`'s own `SelectUpTo`
// case used to call `actions.chooseTarget(remaining)` with NO predicate
// argument at all, unlike `card.ts`'s own `resolveTargets` (every plain
// declarative `dealDamageTarget`/`pumpTarget`/etc. effect), which threads
// `ctx.preferTarget` through on every call — a real testability/
// determinism regression this card's own migration surfaced (this
// scenario's `preferTarget` below was silently ignored, landing the target
// on Coeurl, your own creature, instead of the intended Ahriman). Fixed by
// a new private `selectPool` helper in `combinator.ts` mirroring
// `resolveTargets` exactly (`ctx.declaredTargets` first, then
// `actions.chooseTarget(remaining, ctx.preferTarget)`) — `preferTarget`
// below is honored again, and the target is genuinely Ahriman once more.

import { slashOfLight } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{1}{W}') },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  const yourCreature1 = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: yourCreature1.name, zone: 'Battlefield', power: yourCreature1.basePower, toughness: yourCreature1.baseToughness, controller: pilot.you.name });

  const yourCreature2 = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Dwarven Castle Guard', types: ['Creature'], subtypes: ['Dwarf', 'Soldier'], basePower: 2, baseToughness: 1, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: yourCreature2.name, zone: 'Battlefield', power: yourCreature2.basePower, toughness: yourCreature2.baseToughness, controller: pilot.you.name });

  const yourEquipment = pilot.state.addCard(pilot.you, 'Battlefield', { name: "White Mage's Staff", types: ['Artifact'], subtypes: ['Equipment'], cmc: 2 });
  pilot.log.push({ fn: 'enters', card: yourEquipment.name, zone: 'Battlefield', controller: pilot.you.name });

  const opp = pilot.opponents[0]!;
  const oppCreature = pilot.state.addCard(opp, 'Battlefield', { name: 'Ahriman', types: ['Creature'], subtypes: ['Eye', 'Horror'], basePower: 2, baseToughness: 2, cmc: 3 });
  pilot.log.push({ fn: 'enters', card: oppCreature.name, zone: 'Battlefield', power: oppCreature.basePower, toughness: oppCreature.baseToughness, controller: opp.name });

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', { name: slashOfLight.name, types: [] });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { preferTarget: (c) => c.getName() === 'Ahriman' });

  pilotCast(pilot, cardReal, slashOfLight, ctx, actions);
  pilotResolveTop(pilot);

  const result =
    "Slash of Light is cast for {1}{W} targeting Ahriman, the opponent's creature (a genuine CR 601.2c choice among legal candidates, honored via `preferTarget` — see this file's own header comment) — its damage (equal to the 2 creatures plus 1 Equipment you control, a total of 3) is dealt to Ahriman, then the spell itself goes to its owner's graveyard after resolving (CR 608.2m).";
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> resolve (damage = creatures you control + Equipment you control) -> target creature', result)];
}
