// Real engine-piloted trace (see engine-trace.ts's own header) — replaces
// the old 4-scenario, flat harness.ts shape with ONE real playthrough, per
// this session's own standing rule (SYNERGY_DESIGN.md): default to 1
// scenario, demonstrating real BASIC function only. Real playthrough: cast
// -> real ETB (enters with a +1/+1 counter) -> real board-state filler (a
// second real creature you control, a real Equipment already attached to
// Zack Fair) -> the sacrifice ability fires for real, demonstrating all
// three of its real consequences at once (indestructible grant, counter
// transfer, Equipment re-attachment) on the same chosen target.
//
// The activation itself is fired directly via `resolveCard` (bypassing
// `pilotActivate`/`canActivateAbility`), not because this scenario is
// avoiding an edge case, but because the real ability genuinely cannot be
// legally activated through this engine's own cost-legality pipeline at
// all — see definition.ts's own `activationCost` comment (engine.ts's
// `unsupportedCostComponent` doesn't recognize a NAMED self-sacrifice cost
// as payable, and can't be taught to without risking this card's own
// "read Zack Fair's live state" logic). This is the same real limitation
// the old flat harness.ts scenario's own `activate` step silently worked
// around too (that path never called `canActivateAbility` either) — just
// made explicit here instead of implicit.
//
// Real FIN permanents (data/fin/fin_scryfall.json), not invented filler:
// Buster Sword ({3} Artifact — Equipment, "Equipped creature gets +3/+2" —
// Zack Fair's own iconic weapon in the source material) is the Equipment
// already attached to Zack Fair. The second creature you control reuses
// harness.ts's own shared `GENERIC_FILLER_CREATURE` ("Grizzly Bears," a
// real, specific, non-FIN Scryfall card already used as filler across this
// pool — see phoenix-down/paladin-s-arms/moogles-valor/etc.).

import { zackFair } from './definition';
import { basicLandsFor } from '../../mana';
import { resolveCard } from '../../card';
import { GENERIC_FILLER_CREATURE } from '../../harness';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{W}') },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  const zackReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: zackFair.name,
    types: ['Creature'],
    subtypes: ['Human', 'Soldier'],
    basePower: zackFair.pt?.[0],
    baseToughness: zackFair.pt?.[1],
  });
  const actions = pilotActions(pilot, zackReal.id);
  const ctx = pilot.ctxFor(zackReal, { preferTarget: (c) => c.getName() === GENERIC_FILLER_CREATURE });

  // Cast Zack Fair ({W}), real mana payment (a real Plains, seeded via
  // `basicLands` above); resolving it auto-fires its real 603.6b onEnter
  // trigger — a real +1/+1 counter for real.
  pilotCast(pilot, zackReal, zackFair, ctx, actions);
  pilotResolveTop(pilot);

  // Real board-state filler: a second real creature you control (the
  // "target creature you control" the sacrifice ability actually needs,
  // rather than a trivial self-only pool), and a real Equipment (Buster
  // Sword) already attached to Zack Fair — both required for the
  // activation below to demonstrate its fullest real behavior.
  pilot.beginStep(`Second creature (${GENERIC_FILLER_CREATURE}) and an Equipment (Buster Sword) already attached to Zack Fair`);
  const otherCreature = pilot.state.addCard(pilot.you, 'Battlefield', { name: GENERIC_FILLER_CREATURE, types: ['Creature'], subtypes: ['Bear'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: otherCreature.name, zone: 'Battlefield', power: otherCreature.basePower, toughness: otherCreature.baseToughness, controller: pilot.you.name });
  const busterSword = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Buster Sword', types: ['Artifact'], subtypes: ['Equipment'], cmc: 3 });
  pilot.log.push({ fn: 'enters', card: busterSword.name, zone: 'Battlefield', controller: pilot.you.name });
  pilot.state.equip(busterSword, zackReal);
  pilot.log.push({ fn: 'equip', equipment: busterSword.name, target: zackReal.name });

  // Activate "{1}, Sacrifice Zack Fair: ..." — fired directly (see this
  // file's own header for why `pilotActivate` can't be used here): a real,
  // documented engine gap, not an avoided edge case. Zack Fair's own
  // counters/attached Equipment are read live, exactly as if the sacrifice
  // cost had already been paid (last-known-information, CR 608.2h),
  // because nothing actually removes it from the battlefield first.
  pilot.beginStep('Activate {1}, Sacrifice Zack Fair (fired directly — self-sacrifice-as-cost is not payable through canActivateAbility, see this file\'s own header)');
  pilot.log.push({ fn: 'activate', card: zackFair.name, cost: zackFair.activationCost ?? '' });
  resolveCard(zackFair, ctx, actions);

  const result =
    'Zack Fair is cast for {W} and enters with a +1/+1 counter; with a second creature and a Buster Sword already attached, activating {1}, Sacrifice Zack Fair fires the ability directly, granting the target indestructible, moving Zack Fair\'s own +1/+1 counter onto it, and re-attaching the Buster Sword to it — all three consequences, on the same target.';
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'engine playthrough: cast -> ETB counter -> board-state filler (second creature, attached Equipment) -> sacrifice ability fires directly, granting indestructible, transferring counters, and re-attaching the Equipment',
      result,
    ),
  ];
}
