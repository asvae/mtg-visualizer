// Real corpus verification for `sagaChapterCompletionResult`/
// `sagaChapterCompletionOccurrences` — reconciles the predicate's own
// structural verdict against a real `saga.ts`'s `advanceSaga` engine call
// (a direct, repeated function call, not a scripted turn-by-turn scenario/
// trace) using minimal, hand-constructed `CardDefinition` MOCKS built from
// the same public combinator/builder functions real cards use
// (`combinator.ts`'s `sequence`/`branch`/`compare`), per the 2026-09-18
// policy decision recorded in `.claude/agent-memory/engine/notes.md`: a
// sink-derivation predicate is a pure function of `CardDefinition` SHAPE —
// it doesn't care which real card produced that shape, only whether the
// structural shape (a `Sequence`-shaped final chapter, an opaque `custom`
// closure) is present. Corpus manifest: `saga.corpus.json` (read by
// `sink-derivation-status.ts`).
//
// Real card names appear ONLY as readability anchors in comments/test
// names below — the fixtures themselves are synthetic, mirroring the real
// shape each anchor card has (checked directly against that card's own
// `functional-model/cards/<slug>/definition.ts` at the time this file was
// written, never copied from it):
//  - Summon: Bahamut (fin/1) — a plain, non-transforming Saga whose final
//    chapter has no self-move effect.
//  - Jill, Shiva's Dominant // Shiva, Warden of Ice (fin/12) / Dion,
//    Bahamut's Dominant // Bahamut, Warden of Light — a transforming Saga
//    whose final chapter resolves a real self-referential
//    `sequence('Exile', 'Battlefield')`.
//  - Jecht, Reluctant Guardian // Braska's Final Aeon — ALSO a transforming
//    DFC (same front/back Saga template as Jill/Dion), but its own final
//    chapter does NOT move itself — proves this predicate checks the
//    chapter's OWN effects, not just "is this a transforming DFC."
//  - Joshua, Phoenix's Dominant // Phoenix, Warden of Fire — a real final
//    chapter that DOES self-move, but expressed as an opaque `kind:'custom'`
//    closure rather than `combinator.ts`'s `sequence()` — this predicate
//    correctly declines to guess and escalates to 'unknown'.
//  - Summon: Brynhildr / Summon: GF Cerberus / Summon: GF Ifrit — plain,
//    non-transforming Sagas whose own final chapter's `kind:'custom'`
//    effect is a genuine inert no-op placeholder for an unrelated ability
//    (never a self-move) — the true verdict IS 'produces-death', but this
//    predicate has no safe way to distinguish that from an opaque closure
//    that DOES move self, so it also escalates to 'unknown' (a real,
//    documented over-conservatism, not a bug).
import { describe, expect, it } from 'vitest';
import type { CardDefinition, EffectContext, Actions } from '../card';
import type { RealCard } from '../state';
import { advanceSaga } from '../saga';
import { sequence, branch, compare } from '../combinator';
import { setupEnginePilot, pilotActions, type EnginePilotSetup } from '../engine-trace';
import { sagaChapterCompletionOccurrences, sagaChapterCompletionResult } from './saga';

/** Registers `card` on the battlefield and advances its Saga chapters (via
 * real, repeated `advanceSaga` calls — a direct function call, never a
 * scripted turn-by-turn pilot script) all the way through its final
 * chapter, returning the real permanent so a test can check whether it was
 * genuinely sacrificed (714.4) or survived. Reuses `engine-trace.ts`'s
 * `setupEnginePilot`/`pilotActions` purely as cheap engine/player
 * construction (a real, already-wired `Actions` implementation bound to a
 * live `GameEngine`) — NOT as a scripted scenario/trace runner; this
 * function never calls anything from `harness.ts`'s scenario shape. */
function registerAndAdvanceThroughFinalChapter(card: CardDefinition, chapterCount: number): RealCard {
  const setup: EnginePilotSetup = { you: {}, opponents: [{}] };
  const pilot = setupEnginePilot(setup);
  const real = pilot.state.addCard(pilot.you, 'Battlefield', { name: card.name, types: ['Enchantment'], subtypes: ['Saga'] });
  const registered = {
    card,
    ctx: pilot.ctxFor(real),
    actions: pilotActions(pilot, real.id),
  };
  for (let i = 0; i < chapterCount; i++) advanceSaga(pilot.engine, real, registered);
  return real;
}

// --- corpus fixtures (counted in saga.corpus.json's own passing/total) ---

/** Plain, non-transforming Saga — final chapter has no self-move effect. Mirrors Summon: Bahamut's real shape. */
const mockPlainSaga: CardDefinition = {
  name: 'Mock Plain Saga (no self-move)',
  manaCost: '{2}{R}',
  typeLine: 'Enchantment — Saga',
  triggers: [
    { name: 'chapterI', effects: [{ kind: 'drawCard' }] },
    { name: 'chapterII', effects: [{ kind: 'destroy', validType: 'creature', qty: 1 }] },
    { name: 'chapterIII', effects: [{ kind: 'dealDamageTarget', amount: 3 }] },
  ],
};

/** A transforming Saga (back face) whose final chapter resolves a real self-referential Sequence. Mirrors Jill, Shiva's Dominant / Dion, Bahamut's Dominant's real shape. */
const mockTransformBackSaga: CardDefinition = {
  name: 'Mock Transforming Saga (self-move via Sequence)',
  manaCost: '',
  typeLine: 'Enchantment Creature — Saga Elemental',
  triggers: [
    { name: 'chapterI', effects: [{ kind: 'drawCard' }] },
    { name: 'chapterII', effects: [{ kind: 'destroy', validType: 'creature', qty: 1 }] },
    {
      name: 'chapterIII',
      effects: [{ kind: 'program', describe: 'exile this permanent, then return it to the battlefield', program: sequence('Exile', 'Battlefield') }],
    },
  ],
};

/** ALSO a "transforming-shaped" Saga (declares its own backFace, same as the case above) whose final chapter does NOT move itself — proves the predicate checks the chapter's own effects, not just "does this card have a backFace." Mirrors Jecht, Reluctant Guardian // Braska's Final Aeon's real shape. */
const mockTransformShapedButNoSelfMoveSaga: CardDefinition = {
  name: 'Mock Front Face (not itself a Saga)',
  manaCost: '{1}{R}',
  typeLine: 'Legendary Creature — Human Warrior',
  backFace: {
    name: 'Mock Back Face Saga (transform-shaped, but no self-move)',
    manaCost: '',
    typeLine: 'Legendary Enchantment Creature — Saga Warrior',
    triggers: [
      { name: 'chapterI', effects: [{ kind: 'discard', owner: 'opponents', qty: 1 }] },
      { name: 'chapterII', effects: [{ kind: 'discard', owner: 'opponents', qty: 1 }] },
      { name: 'chapterIII', effects: [{ kind: 'sacrifice', owner: 'opponents', validType: 'creature', qty: 2 }] },
    ],
  },
};

describe('sagaChapterCompletionResult / sagaChapterCompletionOccurrences — corpus (mocked CardDefinition fixtures)', () => {
  it('plain Saga, final chapter has no self-zone-change effect: predicate says produces-death, agreeing with a real advanceSaga sacrifice (mirrors Summon: Bahamut)', () => {
    const result = sagaChapterCompletionResult(mockPlainSaga);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-death');

    const real = registerAndAdvanceThroughFinalChapter(mockPlainSaga, 3);
    expect(real.zone).toBe('Graveyard'); // real trace agreement — hard-fail on disagreement

    expect(sagaChapterCompletionOccurrences(mockPlainSaga)).toEqual([
      expect.objectContaining({ event: 'dies', to: 'Graveyard', from: 'Battlefield', subject: 'self', target: 'self' }),
    ]);
  });

  it("transforming Saga whose final chapter resolves a self-referential exile-then-return Sequence: predicate says no-death, agreeing with a real advanceSaga transform-back (no sacrifice, lore counters reset) — mirrors Jill, Shiva's Dominant / Dion, Bahamut's Dominant", () => {
    const result = sagaChapterCompletionResult(mockTransformBackSaga);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('no-death');

    const real = registerAndAdvanceThroughFinalChapter(mockTransformBackSaga, 3);
    expect(real.zone).toBe('Battlefield'); // real trace agreement — survives instead of being sacrificed
    expect(real.counters['LORE'] ?? 0).toBe(0); // real 400.7 reset from the exile-then-return move

    expect(sagaChapterCompletionOccurrences(mockTransformBackSaga)).toEqual([]);
  });

  it("a transform-shaped Saga (has its own backFace) whose final chapter does NOT move itself: predicate still says produces-death, agreeing with a real advanceSaga sacrifice — proving it checks the chapter's own effects rather than 'is this a transforming DFC' — mirrors Jecht, Reluctant Guardian // Braska's Final Aeon", () => {
    const backFace = mockTransformShapedButNoSelfMoveSaga.backFace!;
    const result = sagaChapterCompletionResult(mockTransformShapedButNoSelfMoveSaga);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-death');

    const real = registerAndAdvanceThroughFinalChapter(backFace, 3);
    expect(real.zone).toBe('Graveyard'); // real trace agreement — hard-fail on disagreement

    expect(sagaChapterCompletionOccurrences(mockTransformShapedButNoSelfMoveSaga)).toEqual([
      expect.objectContaining({ event: 'dies', to: 'Graveyard', from: 'Battlefield', subject: 'self', target: 'self' }),
    ]);
  });

  // --- structural / escalation cases (pure predicate calls, no engine run
  // needed — NOT counted in saga.corpus.json's own passing/total, same
  // convention the prior real-card version of this file established: that
  // manifest tracks cases this predicate genuinely AGREES with real engine
  // evidence on, not every structural branch its own code takes). ---

  it("an opaque kind:'custom' final chapter is never guessed, even though it DOES move self — escalates to unknown (mirrors Joshua, Phoenix's Dominant, whose real final chapter is expressed this way instead of combinator.ts's sequence())", () => {
    const card: CardDefinition = {
      name: 'Mock Saga (opaque custom final chapter that actually self-moves)',
      manaCost: '',
      typeLine: 'Enchantment — Saga',
      triggers: [
        { name: 'chapterI', effects: [{ kind: 'drawCard' }] },
        {
          name: 'chapterII',
          effects: [{ kind: 'custom', describe: 'exile then return (opaque)', run: (ctx: EffectContext, actions: Actions) => { actions.moveTo(ctx.self, 'Exile'); actions.moveTo(ctx.self, 'Battlefield'); } }],
        },
      ],
    };
    const result = sagaChapterCompletionResult(card);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('unknown');
    expect(sagaChapterCompletionOccurrences(card)).toEqual([]);
  });

  it("a genuinely inert, unrelated kind:'custom' no-op final chapter ALSO escalates to unknown, not silently 'produces-death' — a real, documented over-conservatism, not a bug (mirrors Summon: Brynhildr / Summon: GF Cerberus / Summon: GF Ifrit, whose true verdict IS produces-death)", () => {
    const card: CardDefinition = {
      name: 'Mock Saga (opaque custom final chapter that is a genuine no-op)',
      manaCost: '',
      typeLine: 'Enchantment — Saga',
      triggers: [
        { name: 'chapterI', effects: [{ kind: 'drawCard' }] },
        { name: 'chapterII', effects: [{ kind: 'custom', describe: 'unrelated inert placeholder ability', run: () => {} }] },
      ],
    };
    const result = sagaChapterCompletionResult(card);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('unknown');
  });

  it('the greatest chapter is found by NAME, not by array-authoring order — a Saga whose triggers are authored out of numeric order still checks the highest-numbered one', () => {
    const card: CardDefinition = {
      name: 'Mock Saga (chapters authored out of order)',
      manaCost: '',
      typeLine: 'Enchantment — Saga',
      triggers: [
        // chapterII authored FIRST in the array, chapterI SECOND — finalChapterName must still resolve chapterII as the greatest (CHAPTER_NAMES-order lookup, not array position).
        { name: 'chapterII', effects: [{ kind: 'program', describe: 'exile then return', program: sequence('Exile', 'Battlefield') }] },
        { name: 'chapterI', effects: [{ kind: 'drawCard' }] },
      ],
    };
    const result = sagaChapterCompletionResult(card);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('no-death');
    expect(result.via).toContain('chapterII');
  });

  it("a self-move nested inside a Branch's own `then` arm is still detected (walkProgram-style recursion into a nested Branch, not just a top-level Sequence)", () => {
    const card: CardDefinition = {
      name: 'Mock Saga (self-move nested in a Branch then-arm)',
      manaCost: '',
      typeLine: 'Enchantment — Saga',
      triggers: [
        { name: 'chapterI', effects: [{ kind: 'drawCard' }] },
        {
          name: 'chapterII',
          effects: [{ kind: 'program', describe: 'conditionally exile then return', program: branch(compare(1, '>', 0), [sequence('Exile', 'Battlefield')]) }],
        },
      ],
    };
    const result = sagaChapterCompletionResult(card);
    expect(result.verdict).toBe('no-death');
  });

  it("a self-move nested inside a Branch's own `else` arm is also detected", () => {
    const card: CardDefinition = {
      name: 'Mock Saga (self-move nested in a Branch else-arm)',
      manaCost: '',
      typeLine: 'Enchantment — Saga',
      triggers: [
        { name: 'chapterI', effects: [{ kind: 'drawCard' }] },
        {
          name: 'chapterII',
          effects: [{ kind: 'program', describe: 'conditionally exile then return', program: branch(compare(0, '>', 1), [], [sequence('Exile', 'Battlefield')]) }],
        },
      ],
    };
    const result = sagaChapterCompletionResult(card);
    expect(result.verdict).toBe('no-death');
  });

  it("a self-move nested inside one mode of a kind:'modal' final chapter is still detected", () => {
    const card: CardDefinition = {
      name: 'Mock Saga (self-move nested in one mode of a modal final chapter)',
      manaCost: '',
      typeLine: 'Enchantment — Saga',
      triggers: [
        { name: 'chapterI', effects: [{ kind: 'drawCard' }] },
        {
          name: 'chapterII',
          effects: [
            {
              kind: 'modal',
              modes: [
                { describe: 'draw a card', effects: [{ kind: 'drawCard' }] },
                { describe: 'exile then return', effects: [{ kind: 'program', describe: 'exile then return', program: sequence('Exile', 'Battlefield') }] },
              ],
            },
          ],
        },
      ],
    };
    const result = sagaChapterCompletionResult(card);
    expect(result.verdict).toBe('no-death');
  });

  it('a Saga typeLine with no recognized chapterI-V trigger at all is not applicable-enough to have a real verdict — escalates to unknown', () => {
    const card: CardDefinition = {
      name: 'Mock Saga (no recognized chapter trigger)',
      manaCost: '',
      typeLine: 'Enchantment — Saga',
      triggers: [{ name: 'onEnter', effects: [{ kind: 'drawCard' }] }],
    };
    const result = sagaChapterCompletionResult(card);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('unknown');
    expect(sagaChapterCompletionOccurrences(card)).toEqual([]);
  });

  it('a plain, non-Saga card is not applicable at all', () => {
    const notASaga: CardDefinition = { name: 'Not A Saga', manaCost: '{1}', typeLine: 'Creature — Human' };
    const result = sagaChapterCompletionResult(notASaga);
    expect(result.applicable).toBe(false);
    expect(sagaChapterCompletionOccurrences(notASaga)).toEqual([]);
  });
});
