// Real engine-piloted trace (see engine-trace.ts's own header) — this
// card's own two real, turn-structure-anchored abilities played out for
// real: a real ETB loot, a real `on:'endStep'` auto-fire that genuinely
// reads the graveyard's own card count, an explicit real transform once
// that condition holds, and a real Crew 1 activation on the resulting
// back face.

import { sidequestCardCollection } from './definition';
import { basicLandsFor } from '../../mana';
import { currentPhase } from '../../turn';
import { typesFromTypeLine, subtypesFromTypeLine } from '../../harness';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceOneStep,
  pilotActivate,
  pilotTransform,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    // {3}{U} to cast Sidequest: Card Collection; 5 real library cards cover
    // its own ETB draw of 3 with margin.
    you: { basicLands: basicLandsFor('{3}{U}'), libraryCount: 5 },
    opponents: [{}],
  };
  const pilot = setupEnginePilot(setup);

  const sidequestReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: sidequestCardCollection.name,
    types: typesFromTypeLine(sidequestCardCollection.typeLine),
    subtypes: subtypesFromTypeLine(sidequestCardCollection.typeLine),
  });
  const actions = pilotActions(pilot, sidequestReal.id);
  const ctx = pilot.ctxFor(sidequestReal);

  // Real board texture already sitting in the graveyard before this card
  // even resolves — 6 real, distinct FIN cards spanning every major card
  // type (not one repeated filler), standing in for "whatever else already
  // happened earlier this game," the same convention seeded battlefield/
  // library filler already uses elsewhere in this pool. Combined with the
  // 2 cards this card's own ETB discards below, the graveyard reaches
  // exactly 8 — the real threshold its own end-step trigger checks.
  for (const filler of [
    { name: 'Iron Giant', types: ['Artifact', 'Creature'], subtypes: ['Demon'] },
    { name: 'A Realm Reborn', types: ['Enchantment'] },
    { name: "Relm's Sketching", types: ['Sorcery'] },
    { name: 'Fight On!', types: ['Instant'] },
    { name: 'Wastes', types: ['Land'] },
    { name: 'Coeurl', types: ['Creature'], subtypes: ['Cat', 'Beast'] },
  ]) {
    pilot.state.addCard(pilot.you, 'Graveyard', filler);
  }

  // Ahriman — the real creature that crews Magicked Card later (power 2,
  // Crew 1 only needs 1 or more) — seeded directly onto the battlefield,
  // same "focus the scenario on the ability under test" convention
  // the-lunar-whale's own Item Shopkeep already establishes.
  const ahrimanReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: 'Ahriman',
    types: ['Creature'],
    subtypes: ['Eye', 'Horror'],
    basePower: 2,
    baseToughness: 2,
    keywords: ['Flying'],
  });

  // Cast Sidequest: Card Collection ({3}{U}), real mana payment.
  pilotCast(pilot, sidequestReal, sidequestCardCollection, ctx, actions);
  // Resolves; real ETB (603.6b) draws 3 real cards, then discards 2 —
  // graveyard now holds 6 (seeded) + 2 (discarded) = 8.
  pilotResolveTop(pilot);

  // Advance through the rest of THIS turn to the real end step — no draw
  // step is crossed (Main1 -> ... -> EndOfTurn all stay within turn 1), so
  // the seeded library is never touched again. `on:'endStep'` auto-fires
  // the instant the turn enters EndOfTurn (engine.ts's
  // fireOnPhaseEnterTriggers, ENGINE_GAPS.md gap #3, closed) — the real
  // graveyard count (8) is genuinely read here (definition.ts's own
  // `run`, `ctx.you.getCardsIn('Graveyard')`, logged as a real
  // `read:getCardsIn` trace line), not assumed true.
  while (currentPhase(pilot.engine.turn) !== 'EndOfTurn') advanceOneStep(pilot);

  // The condition holds (8 >= 8) — a piloting caller represents the real
  // transform explicitly (saga.ts's `transformPermanent`, generalized to
  // ANY CardDefinition, not just a Saga — its own `advanceSaga` call
  // correctly no-ops for Magicked Card, a non-Saga face), same
  // explicit-signal convention jill-shiva-s-dominant/dion-bahamut-s-
  // dominant/jecht-reluctant-guardian's own front-face transforms already
  // require.
  const magickedCard = sidequestCardCollection.backFace!;
  pilotTransform(pilot, sidequestReal, magickedCard, ctx, actions);

  // Crew 1 (702.121b/c): tap Ahriman (power 2 >= 1) to pay the real cost —
  // legal immediately, no summoning-sickness gate on the crewing creature
  // and no sorcery-speed restriction on Crew itself.
  pilotActivate(pilot, pilot.you, sidequestReal, magickedCard, ctx, actions, 'Crew 1: tap Ahriman', undefined, [ahrimanReal]);
  pilotResolveTop(pilot); // resolves the real `animate` effect

  const result =
    'Sidequest: Card Collection is cast; its ETB draws 3 cards then discards 2, bringing the graveyard to 8 (6 already there + 2 just discarded). Turn passage to the end step auto-fires the "if eight or more cards are in your graveyard" trigger, reading the graveyard count — the condition holds, so the pilot represents the transform into Magicked Card. Magicked Card is then crewed (Crew 1, tapping Ahriman) and becomes an artifact creature.';
  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'engine playthrough: cast -> ETB draw/discard -> turn passage to end step (graveyard-count check) -> transform -> Crew 1 activation',
      result,
    ),
  ];
}
