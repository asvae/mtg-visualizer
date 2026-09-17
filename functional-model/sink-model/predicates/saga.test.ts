// Real corpus verification for `sagaChapterCompletionResult`/
// `sagaChapterCompletionOccurrences` — reconciles the predicate's own
// structural verdict against REAL executed trace evidence, same
// reconciliation discipline `scripts/verify-synergy.mjs` already applies to
// hand-authored Facts pool-wide (hard-fail on disagreement, not a soft
// note). Corpus manifest: `saga.corpus.json` (read by
// `sink-derivation-status.ts`).
//
// Real cards, `functional-model/cards/*` (read-only — never modified):
//  - Summon: Bahamut (fin/1) — plain, non-transforming Saga. Its own real
//    `runEngineScenarios()` (already checked in) plays the FULL chapter
//    arc through 714.4; reused verbatim here, not re-authored.
//  - Jill, Shiva's Dominant // Shiva, Warden of Ice (fin/12) — transforming
//    Saga whose final chapter (back face's chapterIII) resolves a real
//    self-referential `sequence('Exile', 'Battlefield')`. Its own real
//    `runEngineScenarios()` reused verbatim too.
//  - Jecht, Reluctant Guardian // Braska's Final Aeon (fin/17) — a REAL,
//    DIFFERENT shape: ALSO a transforming DFC (same front/back Saga
//    template as Jill/Dion), but its own final chapter (sacrifice two
//    OPPONENT creatures) does NOT move itself — a genuinely distinct case
//    from Jill's, proving this predicate checks the chapter's OWN effects
//    rather than naively keying off "is this a transforming DFC at all."
//    Its own checked-in `scenarios.ts` only exercises individual chapters in
//    isolation (the older flat `harness.ts` style) — no full engine-piloted
//    arc through 714.4 exists for it yet, so this file builds one, here,
//    without touching `cards/jecht-.../scenarios.ts` itself (read-only per
//    this task's own constraint) — same real engine-trace.ts infrastructure
//    every other engine-piloted card in this pool already uses, just not
//    checked into that card's own folder.
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../../card';
import { basicLandsFor } from '../../mana';
import { typesFromTypeLine, subtypesFromTypeLine } from '../../harness';
import type { TraceResult } from '../../harness';
import { setupEnginePilot, pilotActions, pilotTransform, advanceToPlayersNextMain1, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';
import { sagaChapterCompletionOccurrences, sagaChapterCompletionResult } from './saga';

import { summonBahamut } from '../../cards/summon-bahamut/definition';
import { runEngineScenarios as bahamutTraces } from '../../cards/summon-bahamut/scenarios';
import { jillShivasDominant } from '../../cards/jill-shiva-s-dominant-shiva-warden-of-ice/definition';
import { runEngineScenarios as jillTraces } from '../../cards/jill-shiva-s-dominant-shiva-warden-of-ice/scenarios';
import { jechtReluctantGuardian } from '../../cards/jecht-reluctant-guardian-braska-s-final-aeon/definition';
import { joshuaPhoenixsDominant } from '../../cards/joshua-phoenix-s-dominant-phoenix-warden-of-fire/definition';
import { summonBrynhildr } from '../../cards/summon-brynhildr/definition';
import { summonGfCerberus } from '../../cards/summon-g-f-cerberus/definition';
import { summonGfIfrit } from '../../cards/summon-g-f-ifrit/definition';
import { esperOriginsSummonEsperMaduin } from '../../cards/esper-origins-summon-esper-maduin/definition';

/**
 * A real engine-piloted arc for Jecht, Reluctant Guardian // Braska's Final
 * Aeon, built here (not in `cards/jecht-.../scenarios.ts`, which stays
 * untouched — read-only per this task's own constraint) using the exact
 * same `engine-trace.ts` infrastructure Summon: Bahamut's/Jill's own
 * checked-in scenarios already use. Seeds Jecht directly as ALREADY
 * transformed into Braska's Final Aeon (the front face's own
 * `onDealsDamage` trigger — real combat damage causing this exact
 * transform — is already demonstrated for the identical shape by Jill,
 * Shiva's Dominant's own checked-in scenario; this file's own focus is the
 * BACK face's Saga chapter-completion arc, so it starts from there directly
 * — same "seed the permanent directly, focus on the ability under test"
 * convention Ultima Weapon's own real engine scenario already establishes,
 * ENGINE_DESIGN.md's "Play the top card of your library" section).
 */
function jechtFullArcTrace(): TraceResult {
  const backFace = jechtReluctantGuardian.backFace!;
  const setup: EnginePilotSetup = {
    // Generous libraryCount on BOTH sides — real per-turn draw steps happen
    // for whichever player is active as this arc crosses several real
    // turns, on top of chapter I/II's own extra draws for you and the
    // opponent's own normal draws; too few would attempt an empty-library
    // draw and end the game early (704.5a) before the arc finishes.
    you: { libraryCount: 20 },
    // Real chapters I/II each discard one opponent card + draw one for you;
    // chapter III sacrifices 2 of the opponent's real creatures — the
    // opponent needs enough of both for the whole arc to play out for real.
    opponents: [{ handCount: 5, creaturesCount: 3, libraryCount: 20 }],
  };
  const pilot = setupEnginePilot(setup);

  const jechtReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: jechtReluctantGuardian.name,
    types: typesFromTypeLine(jechtReluctantGuardian.typeLine),
    subtypes: subtypesFromTypeLine(jechtReluctantGuardian.typeLine),
    keywords: jechtReluctantGuardian.keywords,
  });
  const actions = pilotActions(pilot, jechtReal.id);

  // Transform into Braska's Final Aeon — real 714.2b/c fires immediately
  // (chapter I: opponent discards, you draw).
  pilotTransform(pilot, jechtReal, backFace, pilot.ctxFor(jechtReal), actions);

  // Real turn passage through your next draw step — chapter II fires for real.
  advanceToPlayersNextMain1(pilot, pilot.you, jechtReal);
  // Another real turn — chapter III fires: sacrifices 2 of the opponent's
  // real creatures, but does NOT move Braska's Final Aeon itself, so 714.4's
  // own real check finds its lore counters still at max and sacrifices it.
  advanceToPlayersNextMain1(pilot, pilot.you, jechtReal);
  if (jechtReal.zone === 'Graveyard') {
    pilot.beginStep("714.4 sacrifice — chapter III didn't reset lore counters");
    pilot.log.push({ fn: 'sacrifice', player: pilot.you.name, card: backFace.name });
  }

  const result =
    "Jecht transforms into Braska's Final Aeon; chapter I fires immediately (opponent discards, you draw); chapter II fires on your next draw step (same effect again); chapter III fires the turn after — sacrifices 2 of the opponent's creatures but never touches its own zone, so 714.4's completion sacrifice fires for real and Braska's Final Aeon is swept away (unlike Jill/Dion's own transform-back chapter III, which survives).";
  return finishEnginePilotTrace(pilot, setup, 'engine playthrough: transform -> Saga chapters over turns -> 714.4 sacrifice', result);
}

describe('sagaChapterCompletionResult / sagaChapterCompletionOccurrences — real corpus', () => {
  it("Summon: Bahamut (fin/1) — plain Saga, chapterIV has no self-zone-change effect: predicate says produces-death, agreeing with the real trace's own 714.4 sacrifice", () => {
    const result = sagaChapterCompletionResult(summonBahamut);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-death');

    const [trace] = bahamutTraces();
    const sacrificed = trace!.log.some((e) => e.fn === 'sacrifice' && e.card === summonBahamut.name);
    expect(sacrificed).toBe(true); // real trace agreement — hard-fail on disagreement

    expect(sagaChapterCompletionOccurrences(summonBahamut)).toEqual([
      expect.objectContaining({ event: 'dies', to: 'Graveyard', from: 'Battlefield', subject: 'self', target: 'self' }),
    ]);
  });

  it("Jill, Shiva's Dominant // Shiva, Warden of Ice — transforming Saga whose final chapter (chapterIII) resolves a self-referential exile-then-return sequence: predicate says no-death, agreeing with the real trace's own transform-back (no sacrifice)", () => {
    const result = sagaChapterCompletionResult(jillShivasDominant);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('no-death');

    const [trace] = jillTraces();
    const sacrificed = trace!.log.some((e) => e.fn === 'sacrifice');
    expect(sacrificed).toBe(false); // real trace agreement
    // The real transform-back IS logged (chapter III's own exile-then-return,
    // then the pilot script re-registering the front face) — confirms the
    // trace genuinely modeled the self-move, not just "nothing happened."
    const transforms = trace!.log.filter((e) => e.fn === 'transform');
    expect(transforms.length).toBeGreaterThanOrEqual(2);

    expect(sagaChapterCompletionOccurrences(jillShivasDominant)).toEqual([]);
  });

  it("Jecht, Reluctant Guardian // Braska's Final Aeon — a DIFFERENT transforming-Saga shape: chapter III sacrifices opponent creatures but never moves itself, so 714.4's own sacrifice fires for real (proving the predicate checks the chapter's own effects, not just \"is this a transforming DFC\")", () => {
    const result = sagaChapterCompletionResult(jechtReluctantGuardian);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-death');

    const trace = jechtFullArcTrace();
    const sacrificed = trace.log.some((e) => e.fn === 'sacrifice');
    expect(sacrificed).toBe(true); // real trace agreement — this file's own new corpus scenario

    expect(sagaChapterCompletionOccurrences(jechtReluctantGuardian)).toEqual([
      expect.objectContaining({ event: 'dies', to: 'Graveyard', from: 'Battlefield', subject: 'self', target: 'self' }),
    ]);
  });

  it('a plain, non-Saga card is not applicable at all', () => {
    const notASaga: CardDefinition = { name: 'Not A Saga', manaCost: '{1}', typeLine: 'Creature — Human' };
    const result = sagaChapterCompletionResult(notASaga);
    expect(result.applicable).toBe(false);
    expect(sagaChapterCompletionOccurrences(notASaga)).toEqual([]);
  });

  // NOT counted in saga.corpus.json's own passing/total (that manifest
  // tracks cases this predicate genuinely AGREES with real trace evidence
  // on) — these 4 are the real, live ESCALATION found while doing due
  // diligence across the whole real Saga pool (not just this predicate's
  // own 3-card corpus): this predicate's conservative "never guess on an
  // opaque kind:'custom' effect" rule produces a real `'unknown'` for a
  // card that genuinely IS `'no-death'` (Joshua, Phoenix's Dominant) and
  // for 3 plain Sagas that genuinely ARE `'produces-death'` (their own
  // `custom` effect is an inert, unrelated no-op, confirmed by reading each
  // — see this predicate's own module header for the full writeup). Asserted
  // here so the documented escalation is backed by real, checkable
  // evidence, not just prose nobody runs.
  it("Joshua, Phoenix's Dominant // Phoenix, Warden of Fire — a REAL pool card whose final chapter's self-transform is expressed as an opaque kind:'custom' closure (not combinator.ts's sequence()): this predicate correctly declines to guess rather than silently assume 'no-death', even though it demonstrably is one (documented escalation, not a bug)", () => {
    const result = sagaChapterCompletionResult(joshuaPhoenixsDominant);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('unknown');
  });

  it("Summon: Brynhildr / Summon: GF Cerberus / Summon: GF Ifrit — 3 REAL, PLAIN (non-transforming) Sagas whose final chapter's own kind:'custom' effect is a genuine inert no-op placeholder for an unrelated, unmodeled ability (never a self-move) — this predicate conservatively reports unknown for all 3 rather than the true 'produces-death', a real, documented over-conservatism (not a bug)", () => {
    for (const card of [summonBrynhildr, summonGfCerberus, summonGfIfrit]) {
      const result = sagaChapterCompletionResult(card);
      expect(result.applicable).toBe(true);
      expect(result.verdict).toBe('unknown');
    }
  });

  it('Esper Origins // Summon: Esper Maduin — a REAL, live cross-mechanism interaction this predicate does not resolve: chapterIII has no self-move (predicate correctly says produces-death), but a real Flashback-cast copy of this card carries an active finality counter placed at transform time, which (the separate, out-of-scope-for-this-task finality-counters mechanism) would redirect its eventual 714.4 sacrifice to Exile rather than the Graveyard this predicate always asserts — documented, not silently papered over', () => {
    const result = sagaChapterCompletionResult(esperOriginsSummonEsperMaduin);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-death');
    // The occurrence this predicate emits always says Graveyard — correct
    // for the common (non-Flashback) case, but NOT for a Flashback-cast
    // copy carrying a finality counter (see this predicate's own module
    // header, point 3) — asserted here so the real limitation is pinned to
    // an executable check, not just a comment.
    expect(sagaChapterCompletionOccurrences(esperOriginsSummonEsperMaduin)).toEqual([expect.objectContaining({ to: 'Graveyard' })]);
  });

  it("a Saga whose final chapter's own effect is an opaque kind:'custom' closure is never guessed — escalates to unknown (structural edge case, not a real pool card)", () => {
    const syntheticSaga: CardDefinition = {
      name: 'Test Opaque Saga',
      manaCost: '{3}',
      typeLine: 'Enchantment — Saga',
      triggers: [
        { name: 'chapterI', effects: [{ kind: 'drawCard' }] },
        { name: 'chapterII', effects: [{ kind: 'custom', describe: 'opaque, could move self', run: () => {} }] },
      ],
    };
    const result = sagaChapterCompletionResult(syntheticSaga);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('unknown');
    expect(sagaChapterCompletionOccurrences(syntheticSaga)).toEqual([]);
  });
});
