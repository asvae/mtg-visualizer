// Real corpus verification for `lifelinkProductionResult`/
// `lifelinkProductionOccurrences` — reconciles the predicate's own
// structural verdict against a real `state.ts`'s `dealDamage` engine call (a
// direct function call, not a scripted turn-by-turn scenario/trace) using
// minimal, hand-constructed `CardDefinition`/`RealCard` MOCKS, per the
// 2026-09-18 policy decision recorded in `.claude/agent-memory/engine/
// notes.md`: a sink-derivation predicate is a pure function of
// `CardDefinition` SHAPE — it doesn't care which real card produced that
// shape. Corpus manifest: `lifelink.corpus.json` (read by
// `sink-derivation-status.ts`).
//
// Real card names appear ONLY as readability anchors in comments/test names
// below — the fixtures themselves are synthetic:
//  - Felidar Savior (FDN #12) — a real, printed-Lifelink-only creature (no
//    other lifegain-shaped effect anywhere on its own definition) — the
//    real motivating card for this predicate.
//  - Healer's Hawk (FDN) — printed Flying + Lifelink, cited directly by
//    `matcher-model/match-query.ts`'s own header as the real gap this predicate
//    closes.
//  - Serra Angel (FDN) — printed Flying + Vigilance, NO Lifelink — the real
//    negative case proving this predicate discriminates by keyword identity,
//    not "any keyword counts."
import { describe, expect, it } from 'vitest';
import type { CardDefinition } from '../card';
import { setupEnginePilot, type EnginePilotSetup } from '../engine-trace';
import { lifelinkProductionOccurrences, lifelinkProductionResult } from './lifelink';

/** Mirrors Felidar Savior's real shape: printed Lifelink, no other lifegain-shaped effect. */
const mockLifelinkCreature: CardDefinition = {
  name: 'Mock Lifelink Creature (printed Lifelink only)',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Cat Beast',
  pt: [2, 3],
  keywords: ['Lifelink'],
};

/** Mirrors Healer's Hawk's real shape: Flying + Lifelink together — proves the OTHER printed keyword doesn't interfere. */
const mockFlyingLifelinkCreature: CardDefinition = {
  name: 'Mock Flying Lifelink Creature',
  manaCost: '{W}',
  typeLine: 'Creature — Bird',
  pt: [1, 1],
  keywords: ['Flying', 'Lifelink'],
};

/** Mirrors Serra Angel's real shape: Flying + Vigilance, no Lifelink at all — real discrimination. */
const mockNonLifelinkCreature: CardDefinition = {
  name: 'Mock Flying Vigilance Creature (no Lifelink)',
  manaCost: '{3}{W}{W}',
  typeLine: 'Creature — Angel',
  pt: [4, 4],
  keywords: ['Flying', 'Vigilance'],
};

/** `sourceReal` (a real permanent controlled by `you`) deals damage to
 * `opponent` (a real opposing PLAYER, not a creature) — the plain, real
 * "damage an opposing player" shape 702.15e's own Lifelink grant applies to
 * regardless of what dealt the damage; keeps the target/source players
 * distinct so a test's own life-total assertions are unambiguous (no
 * "gained the life right back" bookkeeping to untangle). */
function pilotWithDamageSource(source: CardDefinition) {
  const setup: EnginePilotSetup = { you: {}, opponents: [{}] };
  const pilot = setupEnginePilot(setup);
  const sourceReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: source.name,
    types: ['Creature'],
    basePower: source.pt?.[0] ?? 0,
    baseToughness: source.pt?.[1] ?? 1,
    keywords: source.keywords,
  });
  return { pilot, you: pilot.you, opponent: pilot.opponents[0]!, sourceReal };
}

describe('lifelinkProductionResult / lifelinkProductionOccurrences — corpus (mocked CardDefinition fixtures)', () => {
  it("printed Lifelink only: predicate says produces-lifegain, agreeing with a real dealDamage call genuinely granting its controller life (mirrors Felidar Savior, FDN #12)", () => {
    const result = lifelinkProductionResult(mockLifelinkCreature);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-lifegain');

    const { pilot, you, opponent, sourceReal } = pilotWithDamageSource(mockLifelinkCreature);
    const yourLifeBefore = you.life;
    const opponentLifeBefore = opponent.life;
    const { lifeGained } = pilot.state.dealDamage(opponent, 3, sourceReal);
    expect(lifeGained).toBe(3); // real trace agreement — hard-fail on disagreement
    expect(opponent.life).toBe(opponentLifeBefore - 3); // the target genuinely lost life
    expect(you.life).toBe(yourLifeBefore + 3); // the SOURCE's controller genuinely gained life

    expect(lifelinkProductionOccurrences(mockLifelinkCreature)).toEqual([expect.objectContaining({ event: 'lifegain', controller: 'you' })]);
  });

  it('printed Flying + Lifelink together: predicate still says produces-lifegain, not confused by the coexisting unrelated keyword (mirrors Healer\'s Hawk, FDN)', () => {
    const result = lifelinkProductionResult(mockFlyingLifelinkCreature);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('produces-lifegain');

    const { pilot, you, opponent, sourceReal } = pilotWithDamageSource(mockFlyingLifelinkCreature);
    const yourLifeBefore = you.life;
    const { lifeGained } = pilot.state.dealDamage(opponent, 1, sourceReal);
    expect(lifeGained).toBe(1); // real trace agreement
    expect(you.life).toBe(yourLifeBefore + 1);

    expect(lifelinkProductionOccurrences(mockFlyingLifelinkCreature)).toHaveLength(1);
  });

  it('printed Flying + Vigilance, NO Lifelink: predicate says no-lifegain, agreeing with a real dealDamage call granting zero life (mirrors Serra Angel, FDN — real discrimination, not "any keyword counts")', () => {
    const result = lifelinkProductionResult(mockNonLifelinkCreature);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('no-lifegain');

    const { pilot, you, opponent, sourceReal } = pilotWithDamageSource(mockNonLifelinkCreature);
    const yourLifeBefore = you.life;
    const opponentLifeBefore = opponent.life;
    const { lifeGained } = pilot.state.dealDamage(opponent, 4, sourceReal);
    expect(lifeGained).toBe(0); // real trace agreement — hard-fail on disagreement
    expect(opponent.life).toBe(opponentLifeBefore - 4);
    expect(you.life).toBe(yourLifeBefore); // no life gained at all

    expect(lifelinkProductionOccurrences(mockNonLifelinkCreature)).toEqual([]);
  });

  // --- structural cases (pure predicate calls, no engine run needed — NOT
  // counted in lifelink.corpus.json's own passing/total, same convention
  // saga.test.ts's own real-card-anchored structural cases already
  // establish: that manifest tracks cases this predicate genuinely AGREES
  // with real engine evidence on, not every structural branch its own code
  // takes). ---

  it('a card with no keywords at all is no-lifegain, not a crash', () => {
    const card: CardDefinition = { name: 'Mock Vanilla Creature', manaCost: '{2}', typeLine: 'Creature — Human', pt: [2, 2] };
    const result = lifelinkProductionResult(card);
    expect(result.applicable).toBe(true);
    expect(result.verdict).toBe('no-lifegain');
    expect(lifelinkProductionOccurrences(card)).toEqual([]);
  });

  it('Lifelink printed on the BACK face of a transforming DFC is still recognized (front face has no keywords of its own)', () => {
    const card: CardDefinition = {
      name: 'Mock Front Face (no Lifelink)',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Human',
      pt: [1, 1],
      backFace: {
        name: 'Mock Back Face (printed Lifelink)',
        manaCost: '',
        typeLine: 'Creature — Spirit',
        pt: [3, 3],
        keywords: ['Lifelink'],
      },
    };
    const result = lifelinkProductionResult(card);
    expect(result.verdict).toBe('produces-lifegain');
    expect(result.via).toContain('back face');
    expect(lifelinkProductionOccurrences(card)).toHaveLength(1);
  });

  it('front face Lifelink is checked independently of back face keywords — a front-Lifelink DFC whose back face has none still produces-lifegain', () => {
    const card: CardDefinition = {
      name: 'Mock Front Face (printed Lifelink)',
      manaCost: '{1}{W}',
      typeLine: 'Creature — Human',
      pt: [1, 1],
      keywords: ['Lifelink'],
      backFace: {
        name: 'Mock Back Face (no Lifelink)',
        manaCost: '',
        typeLine: 'Creature — Spirit',
        pt: [3, 3],
      },
    };
    const result = lifelinkProductionResult(card);
    expect(result.verdict).toBe('produces-lifegain');
    expect(result.via).toContain('front face');
  });
});
