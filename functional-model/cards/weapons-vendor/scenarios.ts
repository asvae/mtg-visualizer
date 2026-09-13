// Real engine-piloted trace (see engine-trace.ts's own header) — replaces
// the old 4-scenario, declarative `equipmentCount`/`creaturesCount` harness
// shape with ONE real playthrough, per this session's own standing rule
// (SYNERGY_DESIGN.md): default to 1 scenario. Real playthrough: cast ->
// real ETB draw -> real turn passage to the beginning of combat, with a
// real Equipment already on the battlefield -> the optional pay-{1}-then-
// attach effect fires for real, targeting a real second creature you
// control (not just Weapons Vendor itself).
//
// Real FIN permanents (data/fin/fin_scryfall.json), not invented filler:
// Dragoon's Lance ({1}{W} Artifact — Equipment) and Coeurl ({1}{W} 2/2
// Cat Beast — this exact pool's own real printing, reused here purely as
// board-state filler the same way it's reused elsewhere in this pool) are
// placed directly onto the battlefield (not cast — pure board-state filler,
// same convention adelbert-steiner's/slash-of-light's own engine-piloted
// scenarios already use for a real permanent that isn't the card under
// test).

import { weaponsVendor } from './definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceOneStep,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{3}{W}') },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  const cardReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: weaponsVendor.name,
    types: ['Creature'],
    subtypes: ['Human', 'Artificer'],
    basePower: weaponsVendor.pt?.[0],
    baseToughness: weaponsVendor.pt?.[1],
  });
  const actions = pilotActions(pilot, cardReal.id);
  const ctx = pilot.ctxFor(cardReal, { preferTarget: (c) => c.getName() === 'Coeurl' });

  // Cast Weapons Vendor ({3}{W}), real mana payment; resolving it auto-fires
  // its real 603.6b onEnter trigger — draws a card for real.
  pilotCast(pilot, cardReal, weaponsVendor, ctx, actions);
  pilotResolveTop(pilot);

  // Real board-state filler: one real Equipment already on the battlefield
  // (the real "if you control an Equipment" condition), and one real other
  // creature you control (the real "target creature you control" the
  // Equipment attaches to, rather than a trivial self-attach).
  pilot.beginStep("Equipment (Dragoon's Lance) and a second creature (Coeurl) already on the battlefield");
  const equipment = pilot.state.addCard(pilot.you, 'Battlefield', { name: "Dragoon's Lance", types: ['Artifact'], subtypes: ['Equipment'], cmc: 2 });
  pilot.log.push({ fn: 'enters', card: equipment.name, zone: 'Battlefield', controller: pilot.you.name });
  const otherCreature = pilot.state.addCard(pilot.you, 'Battlefield', { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'], basePower: 2, baseToughness: 2, cmc: 2 });
  pilot.log.push({ fn: 'enters', card: otherCreature.name, zone: 'Battlefield', power: otherCreature.basePower, toughness: otherCreature.baseToughness, controller: pilot.you.name });

  // Real turn passage (302.1) — one step, Main1 -> the beginning of combat
  // (`turn.ts`'s own fixed PHASES order has no other phase between them).
  advanceOneStep(pilot, 'Advance to the beginning of combat');

  // `engine.ts`'s `fireOnPhaseEnterTriggers` only auto-fires
  // upkeep/end-step triggers (a real, documented gap) — "beginning of
  // combat" has no auto-fire mechanism yet, so this pilots it manually,
  // same as Ardyn's/Beatrix's/Raubahn's own real onBeginCombat/onAttack
  // triggers would need if they were engine-piloted too.
  pilotFireTrigger(pilot, weaponsVendor, ctx, actions, 'onBeginCombat', 'Beginning of combat on your turn — pay {1}, attach the Equipment');

  const result =
    "Weapons Vendor is cast for {3}{W} and resolves, drawing a card on ETB; an Equipment (Dragoon's Lance) and a second creature (Coeurl) are already on the battlefield when turn passage reaches the beginning of combat on your turn, so the optional pay-{1} ability fires and attaches the Equipment to Coeurl.";
  return [finishEnginePilotTrace(pilot, setup, 'engine playthrough: cast -> ETB draw -> turn passage to beginning of combat -> pay {1}, attach Equipment to a creature', result)];
}
