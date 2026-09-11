// Real engine-piloted trace (see engine-trace.ts's own header) — this
// card's transforming-DFC-into-a-Saga arc played out for real, one
// continuous playthrough, same real shape jill-shiva-s-dominant-shiva-
// warden-of-ice's own scenarios.ts already established (2026-09-11
// consolidation, user's own live call: "let's make 1 scenario, not 5" —
// replaces the old 5 separate flat harness.ts scenarios, one per named
// trigger/chapter, each of which skipped straight to "already on the
// battlefield" and never demonstrated a real cast or real turn passage at
// all).

import { dionBahamutsDominant } from './definition';
import { basicLandsFor } from '../../mana';
import { typesFromTypeLine, subtypesFromTypeLine } from '../../harness';
import { effectiveKeywords } from '../../state';
import type { TraceResult } from '../../harness';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  advanceToPlayersNextMain1,
  pilotActivate,
  pilotTransform,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  // Real Coeurl on the opponent's side — a real, demonstrated target for
  // Gigaflare's own "Destroy target permanent" later (real script:
  // ValidTgts$ Permanent, no owner restriction). Also replaces the old flat
  // scenario's own documented self-destroy modeling-limitation finding
  // (chooseTarget's own first-pool-candidate rule always picked Dion/
  // Bahamut itself when nothing forced otherwise) with a real, explicit
  // `preferTarget` choice instead, same technique jill-shiva-s-dominant's
  // own ETB bounce target uses.
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{4}{W}{W}'), libraryCount: 15 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  const oppCreature = pilot.state.addCard(pilot.opponents[0]!, 'Battlefield', {
    name: 'Coeurl',
    types: ['Creature'],
    subtypes: ['Cat', 'Beast'],
    basePower: 2,
    baseToughness: 2,
    cmc: 2,
  });
  pilot.log.push({ fn: 'enters', card: oppCreature.name, zone: 'Battlefield', power: oppCreature.basePower, toughness: oppCreature.baseToughness, controller: pilot.opponents[0]!.name });

  const dionReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: dionBahamutsDominant.name,
    types: typesFromTypeLine(dionBahamutsDominant.typeLine),
    subtypes: subtypesFromTypeLine(dionBahamutsDominant.typeLine),
    basePower: dionBahamutsDominant.pt?.[0],
    baseToughness: dionBahamutsDominant.pt?.[1],
  });
  const actions = pilotActions(pilot, dionReal.id);

  // Cast Dion from hand (601), real {3}{W} mana payment
  pilotCast(pilot, dionReal, dionBahamutsDominant, pilot.ctxFor(dionReal), actions);
  // Resolves; real ETB (603.6b) creates a 2/2 white Knight creature token
  pilotResolveTop(pilot);

  // Real, deliberate query against the real board state — Dragonfire Dive's
  // own front-face grant (`continuousKeywordGrants`, ENGINE_GAPS.md gap #14)
  // is QUERY-TIME, not a discrete action, so no `fn:'grantKeyword'` line
  // could ever prove it fired; this asks the exact same real function
  // `hasKeyword` itself consults (`state.ts`'s own `effectiveKeywords`),
  // same "manual CDA read" pattern adelbert-steiner's own `read:getNetPower`
  // line already establishes. It's genuinely your own turn right now (turn
  // 1, right after Dion resolves), so this is real, true evidence, not
  // fabricated.
  pilot.beginStep("Real query: Dragonfire Dive's own grant, during your turn");
  pilot.log.push({ fn: 'read:hasKeyword', target: dionReal.name, keyword: 'Flying', result: effectiveKeywords(pilot.state, dionReal).includes('Flying') });

  // Real turn passage — summoning sickness (302.6) clears
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Activate the transform (602.1: {4}{W}{W}, {T}, sorcery speed)
  pilotActivate(pilot, pilot.you, dionReal, dionBahamutsDominant, pilot.ctxFor(dionReal), actions);
  pilotResolveTop(pilot);

  // Front -> Bahamut, Warden of Light. Real 714.2b/c: enters as a Saga with
  // no lore counters, then immediately gets its first — chapter I fires
  // here (Wings of Light: +1/+1 counter and flying on the Knight token,
  // the real "other creature you control").
  const backFace = dionBahamutsDominant.backFace!;
  const bahamutCtx = pilot.ctxFor(dionReal);
  pilotTransform(pilot, dionReal, backFace, bahamutCtx, actions);

  // Real turn passage through your next draw step — chapter II fires for
  // real (Wings of Light again)
  advanceToPlayersNextMain1(pilot, pilot.you, dionReal);

  // Gigaflare's own real target, set on the SAME ctx object saga.ts's own
  // automatic tick below reuses (EnginePilotCtxOpts's own doc comment:
  // mutating a previously-returned ctx before a LATER automatic trigger
  // fire is how a pilot script feeds it a value an earlier call didn't
  // need yet) — the opponent's real Coeurl, not Bahamut itself.
  bahamutCtx.preferTarget = (c) => c.getName() === 'Coeurl';

  // Another real turn — chapter III fires: destroys the opponent's Coeurl
  // (Gigaflare), then exiles Bahamut and returns it transformed back to
  // Dion
  advanceToPlayersNextMain1(pilot, pilot.you, dionReal);

  // Re-register the front face after the transform-back (saga.ts's own
  // convention: a piloting caller must call this explicitly)
  pilotTransform(pilot, dionReal, dionBahamutsDominant, pilot.ctxFor(dionReal), actions);

  const result =
    "Dion enters; real ETB (603.6b) creates a 2/2 white Knight token. Once summoning sickness clears, {4}{W}{W}, {T} exiles Dion and returns it transformed as Bahamut, Warden of Light — real 714.2b/c, chapter I fires immediately (Wings of Light: +1/+1 counter and flying on the Knight token). Chapter II fires on your next draw step (Wings of Light again). Chapter III fires the turn after (Gigaflare: destroys the opponent's real Coeurl, then exiles Bahamut and returns it as Dion) — all through the real turn-based engine.";

  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> ETB -> transform -> Saga chapters over real turns', result)];
}
