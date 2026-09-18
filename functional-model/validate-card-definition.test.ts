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
import { findNameOnlyTriggerGapReasons, findStaticAbilityGapReasons } from './scripts/validate-card-definition.mjs';
import type { CardDefinition, Trigger } from './card';

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

// `findNameOnlyTriggerGapReasons` — the fourth silent-gap-family rule
// (2026-09-18: real bugs found on `fdn-cards/armasaur-guide`,
// `dazzling-angel`, `exemplar-of-light`, `courageous-goblin` — see that
// function's own doc comment in `scripts/validate-card-definition.mjs`
// for the full writeup, including why this rule is FDN-only in practice
// even though the function itself takes no pool/slug argument).
describe('findNameOnlyTriggerGapReasons', () => {
  it('returns [] for a card with no triggers field at all', () => {
    expect(findNameOnlyTriggerGapReasons(mockDefinition({}))).toEqual([]);
  });

  it('returns [] for a trigger that has a real `on` value (the only real auto-fire path)', () => {
    const def = mockDefinition({
      triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'drawCard', amount: 1 }] } satisfies Trigger],
    });
    expect(findNameOnlyTriggerGapReasons(def)).toEqual([]);
  });

  it('flags a trigger with no `on` value, naming it by its own `name`', () => {
    const def = mockDefinition({
      triggers: [{ name: 'onMassAttack', effects: [{ kind: 'drawCard', amount: 1 }] } satisfies Trigger],
    });
    const reasons = findNameOnlyTriggerGapReasons(def);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('onMassAttack');
    expect(reasons[0]).toContain('no real `on` value');
  });

  it('includes a `description`/`describe` field when present, even though neither is part of the real Trigger type', () => {
    const withDescription = mockDefinition({
      triggers: [
        { name: 'RaidETB', description: 'Raid — when this creature enters, if you attacked this turn, draw a card.', effects: [] } as unknown as Trigger,
      ],
    });
    expect(findNameOnlyTriggerGapReasons(withDescription)[0]).toContain('Raid — when this creature enters');

    const withDescribe = mockDefinition({
      triggers: [{ describe: 'Whenever an opponent discards a card, exile it.', effects: [] } as unknown as Trigger],
    });
    expect(findNameOnlyTriggerGapReasons(withDescribe)[0]).toContain('Whenever an opponent discards a card');
  });

  it('flags multiple name-only triggers on the same card independently', () => {
    // Mirrors Exemplar of Light's own real shape: two separate name-only
    // triggers, neither backed by a real `on` value.
    const def = mockDefinition({
      triggers: [
        { name: 'onLifeGain', effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 }] } satisfies Trigger,
        { name: 'onCounterAdded', activationLimit: 1, effects: [{ kind: 'drawCard', amount: 1 }] } satisfies Trigger,
      ],
    });
    const reasons = findNameOnlyTriggerGapReasons(def);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain('onLifeGain');
    expect(reasons[1]).toContain('onCounterAdded');
  });

  it('walks the back face too, tagging its reasons distinctly from the front face', () => {
    const def = mockDefinition({
      triggers: [{ name: 'frontTrigger', effects: [] } satisfies Trigger],
      backFace: mockDefinition({ name: 'Mock Back', triggers: [{ name: 'backTrigger', effects: [] } satisfies Trigger] }),
    });
    const reasons = findNameOnlyTriggerGapReasons(def);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain('frontTrigger');
    expect(reasons[0]).not.toContain('[back face]');
    expect(reasons[1]).toContain('backTrigger');
    expect(reasons[1]).toContain('[back face]');
  });

  it('does not flag a card with zero triggers even if it has other real Effects/staticAbilities', () => {
    const def = mockDefinition({
      keywords: ['Flying'],
      effects: [{ kind: 'drawCard', amount: 1 }],
    });
    expect(findNameOnlyTriggerGapReasons(def)).toEqual([]);
  });
});
