// Real engine-piloted trace (see engine-trace.ts's own header) — one
// continuous playthrough covering both faces, same "1 dense scenario, not
// several" consolidation Dion, Bahamut's Dominant/Aerith Gainsborough's own
// scenarios.ts already establish: cast Venat; a real SECOND legendary spell
// is cast while Venat is already on the battlefield, firing "Whenever you
// cast a legendary spell, draw a card" for real (NOT Venat's own cast — a
// permanent's own triggered ability can't trigger off its own casting, since
// the ability doesn't function until the permanent is already on the
// battlefield and casting happens before that); real turn passage clears
// summoning sickness; Hero's Sundering ({7}, {T}) exiles a real opponent
// permanent and transforms Venat into Hydaelyn, the Mothercrystal; a real
// subsequent combat then fires Blessing of Light (a real +1/+1 counter, a
// real Indestructible grant, and a real conditional draw) on the other real
// legendary creature still on the battlefield.

import { venatHeartOfHydaelyn } from './definition';
import { basicLandsFor } from '../../mana';
import type { CardDefinition } from '../../card';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  advanceOneStep,
  pilotActivate,
  pilotTransform,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

// Freya Crescent (data/fin/fin_scryfall.json: {R} Legendary Creature — Rat
// Knight, 1/1 — same real, non-token card aerith-gainsborough's own scenario
// already uses as a bystander "other legendary creature you control"). Only
// her real name/mana cost/type line/P-T are modeled — her own printed Jump/
// restricted-mana abilities are irrelevant to what THIS scenario
// demonstrates, same simplified-stand-in treatment Aerith's own scenario
// already gives her (added there via plain `addCard`, never actually cast).
// Cast for real here (not just placed) specifically so Venat's own "cast a
// legendary spell" trigger has a real, legitimate second spell to observe.
const freyaCrescent: CardDefinition = { name: 'Freya Crescent', manaCost: '{R}', typeLine: 'Legendary Creature — Rat Knight', pt: [1, 1] };

function heroicSunderingThenBlessingOfLight(): TraceResult {
  const setup: EnginePilotSetup = {
    // {1}{W}{W} (Venat) + {R} (Freya) + {7} (Hero's Sundering), combined
    // into one aggregate cost so `basicLandsFor` sizes a single land base
    // covering every real cost this scenario pays across its own real turn
    // passages — untapping between turns means the SAME lands can fund all
    // three, no need to size for their sum.
    you: { basicLands: basicLandsFor('{8}{W}{W}{R}'), libraryCount: 10 },
    opponents: [{ libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  // Real opponent's nonland permanent — Hero's Sundering's own eventual
  // target (Coeurl, data/fin/fin_scryfall.json: {1}{W} Creature — Cat
  // Beast, 2/2 — same real, non-token filler summon-bahamut's/fate-of-the-
  // sun-cryst's/Dion's own scenarios already use).
  const oppCreature = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {
    name: 'Coeurl',
    types: ['Creature'],
    subtypes: ['Cat', 'Beast'],
    basePower: 2,
    baseToughness: 2,
    cmc: 2,
  });
  pilot.log.push({
    fn: 'enters',
    card: oppCreature.name,
    zone: 'Battlefield',
    power: oppCreature.basePower,
    toughness: oppCreature.baseToughness,
    controller: pilot.opponents[0]!.name,
  });

  const venatReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: venatHeartOfHydaelyn.name,
    types: ['Creature'],
    subtypes: ['Elder', 'Wizard', 'Legendary'],
    basePower: venatHeartOfHydaelyn.pt?.[0],
    baseToughness: venatHeartOfHydaelyn.pt?.[1],
  });
  const venatActions = pilotActions(pilot, venatReal.id);

  // Cast Venat ({1}{W}{W}), real mana payment; resolves onto the
  // battlefield (self-cast, self-enters).
  pilotCast(pilot, venatReal, venatHeartOfHydaelyn, pilot.ctxFor(venatReal), venatActions);
  pilotResolveTop(pilot);

  // Cast Freya Crescent ({R}) while Venat is already on the battlefield —
  // "Whenever you cast a legendary spell" has no auto-fire mechanism in
  // this engine (`Trigger.on` only recognizes 'enter'/'upkeep'/'endStep'),
  // so it's fired manually right after the real `cast` log line, matching
  // CR 601.2i's own real timing (the trigger goes on the stack as part of
  // casting, before the spell itself resolves).
  const freyaReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: freyaCrescent.name,
    types: ['Creature'],
    subtypes: ['Legendary', 'Rat', 'Knight'],
    basePower: freyaCrescent.pt?.[0],
    baseToughness: freyaCrescent.pt?.[1],
  });
  const freyaActions = pilotActions(pilot, freyaReal.id);
  pilotCast(pilot, freyaReal, freyaCrescent, pilot.ctxFor(freyaReal), freyaActions);
  pilotFireTrigger(pilot, venatHeartOfHydaelyn, pilot.ctxFor(venatReal), venatActions, 'onCastLegendarySpell');
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness (302.6) clears, letting Venat
  // pay its own {T} activation cost.
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Hero's Sundering — {7}, {T}: Exile target nonland permanent (the real
  // opponent's Coeurl, forced via `preferTarget` — the pool would otherwise
  // hit Freya first, this card's own controller's other nonland permanent,
  // since `chooseTarget` takes the first pool candidate absent a real
  // choice and "you" is checked before opponents). Transform Venat.
  pilotActivate(pilot, pilot.you, venatReal, venatHeartOfHydaelyn, pilot.ctxFor(venatReal, { preferTarget: (c) => c.getName() === 'Coeurl' }), venatActions);
  pilotResolveTop(pilot); // runs the real custom effect: exiles Coeurl, then exile+return simulates the transform
  const hydaelyn = venatHeartOfHydaelyn.backFace!;
  pilotTransform(pilot, venatReal, hydaelyn, pilot.ctxFor(venatReal), venatActions);

  // Real beginning of combat (507) — one phase past Main1.
  advanceOneStep(pilot, 'Advance to beginning of combat');

  // Blessing of Light — put a +1/+1 counter on another target creature you
  // control (Freya, the only other real creature you control), grant it
  // Indestructible for real, and — since Freya is legendary — draw a card.
  pilotFireTrigger(pilot, hydaelyn, pilot.ctxFor(venatReal, { preferTarget: (c) => c.getName() === 'Freya Crescent' }), venatActions, 'onBeginCombat');

  const result =
    "Venat enters; Freya Crescent (a second legendary spell) is cast while Venat is on the battlefield, firing \"Whenever you cast a legendary spell, draw a card.\" Turn passage clears summoning sickness; Hero's Sundering ({7}, {T}) exiles the opponent's Coeurl, then transforms Venat into Hydaelyn, the Mothercrystal. At the subsequent beginning of combat, Blessing of Light puts a +1/+1 counter on Freya Crescent, grants it Indestructible, and — since Freya is legendary — draws another card.";

  return finishEnginePilotTrace(pilot, setup, "real engine playthrough: cast -> cast (legendary trigger) -> transform (Hero's Sundering) -> beginning of combat (Blessing of Light)", result);
}

export function runEngineScenarios(): TraceResult[] {
  return [heroicSunderingThenBlessingOfLight()];
}
