// Unit tests for `scripts/validate-card-definition.mjs`'s
// `findStaticAbilityGapReasons` — the blunt, deterministic
// `staticAbilities`-presence rule (2026-09-18: real bug found on
// `fdn-cards/inspiring-paladin`, whose own second real ability was left
// completely unmodeled as inert `staticAbilities` free text with no
// structural marker at all, yet the gate still returned `ok:true`/`blue`
// — see that file's own header for the full writeup). Deliberately tests
// only this one pure, fs/tsc-free function directly against mocked
// `CardDefinition`-shaped objects (same "predicate corpus uses mocks"
// convention this pool's other structural-check tests already follow,
// e.g. `card-status.test.ts`'s own `isUnsupportedNoOp`/
// `findUnsupportedConstructs` tests) — the full `validateCardDefinition`
// end-to-end path (dynamic import + scoped `tsc`) is exercised live via
// `gate-and-write-status.mjs --all`, not re-tested here.
import { describe, expect, it } from 'vitest';
import { findStaticAbilityGapReasons } from './scripts/validate-card-definition.mjs';
import type { CardDefinition } from './card';

function mockDefinition(overrides: Partial<CardDefinition>): CardDefinition {
  return { name: 'Mock Card', manaCost: '{1}', typeLine: 'Creature — Mock', ...overrides } as CardDefinition;
}

describe('findStaticAbilityGapReasons', () => {
  it('returns [] for a card with no staticAbilities field at all', () => {
    expect(findStaticAbilityGapReasons(mockDefinition({}))).toEqual([]);
  });

  it('returns [] for a card with an explicitly empty staticAbilities array', () => {
    expect(findStaticAbilityGapReasons(mockDefinition({ staticAbilities: [] }))).toEqual([]);
  });

  it('returns one reason per real staticAbilities entry, regardless of whether the card ALSO models that same clause elsewhere', () => {
    // Mirrors Inspiring Paladin's own real shape: ability 1 is genuinely
    // modeled via continuousKeywordGrants elsewhere on this same
    // definition, yet its own staticAbilities text entry still counts —
    // the blunt rule has no "already modeled elsewhere" exception.
    const def = mockDefinition({
      staticAbilities: [
        'During your turn, this creature has first strike.',
        'During your turn, creatures you control with +1/+1 counters on them have first strike.',
      ],
      continuousKeywordGrants: [{ includeSelf: true, onlyDuringYourTurn: true, keywords: ['FirstStrike'] }],
    });
    const reasons = findStaticAbilityGapReasons(def);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain('During your turn, this creature has first strike.');
    expect(reasons[1]).toContain('During your turn, creatures you control with +1/+1 counters on them have first strike.');
    for (const r of reasons) expect(r).toContain('inert free text');
  });

  it('walks the back face too, tagging its reasons distinctly from the front face', () => {
    const def = mockDefinition({
      staticAbilities: ['front face static ability'],
      backFace: mockDefinition({ name: 'Mock Back', staticAbilities: ['back face static ability'] }),
    });
    const reasons = findStaticAbilityGapReasons(def);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain('front face static ability');
    expect(reasons[0]).not.toContain('[back face]');
    expect(reasons[1]).toContain('back face static ability');
    expect(reasons[1]).toContain('[back face]');
  });

  it('does not flag a card with zero staticAbilities even if it has other real Effects/triggers', () => {
    const def = mockDefinition({
      keywords: ['Flying'],
      effects: [{ kind: 'drawCard', amount: 1 }],
    });
    expect(findStaticAbilityGapReasons(def)).toEqual([]);
  });
});
