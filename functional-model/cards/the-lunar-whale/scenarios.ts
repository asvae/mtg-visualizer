// Real engine-piloted trace (ENGINE_GAPS.md gap #16, closed 2026-09-12): crew
// The Lunar Whale for real, attack for real (setting the real
// `RealCard.attackedThisTurn` flag), then play the top card of the library
// twice — once a real LAND, once a real SPELL — proving `engine.ts`'s new
// `canPlayFromLibraryTop`/`playFromLibraryTop` genuinely dispatches on the
// revealed card's own type rather than a fabricated hybrid action.
//
// Real filler, not invented placeholders: Item Shopkeep (`data/fin/
// fin_scryfall.json`: {1}{R} Creature — Human Citizen, 2/2, vanilla) crews
// the Vehicle; Barret Wallace ({3}{R} Legendary Creature — Human Rebel, 4/4,
// Reach, vanilla otherwise) is the real spell found on top of the library;
// a basic Forest is the real land found on top of the library the FIRST
// time (before Barret Wallace becomes the new top).
import { theLunarWhale } from './definition';
import { itemShopkeep } from '../item-shopkeep/definition';
import { barretWallace } from '../barret-wallace/definition';
import type { CardDefinition } from '../../card';
import { basicLandsFor } from '../../mana';
import { currentPhase } from '../../turn';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotActivate,
  pilotResolveTop,
  advanceToDeclareAttackersStep,
  advanceOneStep,
  pilotDeclareAttackers,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

// A real basic Forest — Magic's own basic land, not a fabricated filler
// (same convention `mana.ts`'s own `basicLandsFor`/`GENERIC_FILLER_LAND`
// already treat basics as real, playable cards).
const forest: CardDefinition = { name: 'Forest', manaCost: '', typeLine: 'Basic Land — Forest' };

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    // {3}{R} covers Barret Wallace's own real cast cost once he's the top
    // card (colored sources freely pay a generic cost, mana.ts's own
    // `canAfford` — no other cast happens this scenario).
    you: { basicLands: basicLandsFor('{3}{R}') },
    // A real legal defending player (508.1a) — The Lunar Whale's own attack
    // never actually deals combat damage in this scenario (no
    // `resolveCombatDamage` call — the ability under test is the "play"
    // permission, not combat math), but a real attacker declaration still
    // needs a real opponent to attack.
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  // The Lunar Whale itself, seeded directly onto the battlefield as an
  // uncrewed Vehicle (an Artifact, not yet a Creature) — same "seed the
  // permanent directly, focus the scenario on the ability under test"
  // convention Cloud, Midgar Mercenary's own engine scenario already uses
  // for Ultima Weapon (never seeded/cast pre-equip machinery it doesn't
  // need to demonstrate).
  const lunarWhaleReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: theLunarWhale.name,
    types: ['Artifact'],
    subtypes: ['Vehicle'],
    basePower: 3,
    baseToughness: 5,
    keywords: ['Flying'],
  });
  // Item Shopkeep, the real creature that crews it (Crew 1 — power 2 >= 1).
  const shopkeepReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: itemShopkeep.name,
    types: ['Creature'],
    subtypes: ['Human', 'Citizen'],
    basePower: 2,
    baseToughness: 2,
  });
  // Library, front-to-back (index 0 is the real top — `state.dig`'s own
  // `.splice(0, qty)` convention): Forest first, Barret Wallace second — so
  // the FIRST `playFromLibraryTop` finds the real land, and once it's
  // played, the SECOND finds the real spell underneath it.
  pilot.state.addCard(pilot.you, 'Library', { name: forest.name, types: ['Land'], subtypes: ['Forest'] });
  pilot.state.addCard(pilot.you, 'Library', {
    name: barretWallace.name,
    types: ['Creature'],
    subtypes: ['Human', 'Rebel'],
    basePower: 4,
    baseToughness: 4,
    keywords: ['Reach'],
  });

  const lunarWhaleActions = pilotActions(pilot, lunarWhaleReal.id);
  const lunarWhaleCtx = pilot.ctxFor(lunarWhaleReal);

  // Crew 1: tap Item Shopkeep to pay the real cost (702.121b/c,
  // `crewedBy`), animating The Lunar Whale into a real Artifact Creature.
  pilotActivate(pilot, pilot.you, lunarWhaleReal, theLunarWhale, lunarWhaleCtx, lunarWhaleActions, 'Crew 1: tap Item Shopkeep', undefined, [shopkeepReal]);
  pilotResolveTop(pilot); // resolves the real `animate` effect

  advanceToDeclareAttackersStep(pilot);
  // Real 508.1f attack declaration — sets the real `RealCard.attackedThisTurn`
  // flag this same pass added (ENGINE_GAPS.md gap #16), the real condition
  // The Lunar Whale's own "as long as it attacked this turn" reads.
  pilotDeclareAttackers(pilot, [lunarWhaleReal], 'Declare The Lunar Whale (crewed) as attacker');

  // Real 305.3/307.1a sorcery-speed timing (this same primitive's own
  // `canPlayFromLibraryTop` reuses `canPlayLand`/`canCastSpell`'s existing
  // timing gate, not a bespoke one) — playing a land or casting a spell off
  // the library top is STILL only legal in a main phase with an empty
  // stack, even under a "you may play" permission that doesn't itself say
  // otherwise. `RealCard.attackedThisTurn` stays true for the rest of the
  // turn regardless (cleared only at Cleanup), so waiting until Main2 here
  // is real, legal sequencing, not a workaround.
  while (currentPhase(pilot.engine.turn) !== 'Main2') advanceOneStep(pilot);

  // "As long as The Lunar Whale attacked this turn, you may play the top
  // card of your library" — modeled as a named effect bundle
  // (`triggers: [{name:'playFromLibraryTop', ...}]`, definition.ts's own
  // comment) manually invoked here, same shape a real triggered ability
  // this engine can't auto-fire already uses (`pilotFireTrigger`). First
  // play: the real top card is Forest, a LAND — dispatches to the real
  // `playLand` (no stack, direct Battlefield move).
  pilotFireTrigger(
    pilot,
    theLunarWhale,
    pilot.ctxFor(lunarWhaleReal, { topLibraryCard: forest }),
    lunarWhaleActions,
    'playFromLibraryTop',
    'Play the top card of the library (Forest, a land)',
  );
  pilotResolveTop(pilot); // no-op — a land-drop never touches the stack

  // Second play: the real top card is now Barret Wallace (Forest already
  // played), a SPELL — dispatches to the real `castSpell` (real {3}{R}
  // mana payment, pushed onto the real stack).
  pilotFireTrigger(
    pilot,
    theLunarWhale,
    pilot.ctxFor(lunarWhaleReal, { topLibraryCard: barretWallace }),
    lunarWhaleActions,
    'playFromLibraryTop',
    'Play the top card of the library (Barret Wallace, a spell)',
  );
  pilotResolveTop(pilot); // resolves the real cast — Barret Wallace enters the battlefield

  const result =
    'The Lunar Whale is crewed (Item Shopkeep taps, real 702.121b/c) and becomes a real Artifact Creature; it attacks (508.1f), genuinely setting RealCard.attackedThisTurn. That real flag is what The Lunar Whale\'s own "as long as it attacked this turn" clause reads. The top card of the library is played twice: first a real Forest (dispatches to the real playLand — direct Battlefield move, no stack), then — once the Forest is gone — the real Barret Wallace underneath it (dispatches to the real castSpell — {3}{R} genuinely paid, pushed onto and resolved off the real stack). Both dispatches reuse engine.ts\'s existing playLand/canPlayLand and castSpell/canCastSpell pairs via the new canPlayFromLibraryTop/playFromLibraryTop primitive — no fabricated hybrid action.';
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'real engine playthrough: crew The Lunar Whale -> real attack (sets attackedThisTurn) -> play a real land off the library top -> play a real spell off the library top',
      result,
    ),
  ];
}
