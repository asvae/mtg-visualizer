// Unit tests for `scripts/validate-card-definition.mjs`'s pure,
// fs/tsc-free structural checkers — `findStaticAbilitiesPolicyViolationReasons`,
// `findMissingSchemaFunctionalityGapReasons`, `findNameOnlyTriggerGapReasons`,
// `validateCoverageJustification` — directly against mocked
// `CardDefinition`-shaped objects (same "predicate corpus uses mocks"
// convention this pool's other structural-check tests already follow, e.g.
// `card-status.test.ts`'s own `isUnsupportedNoOp`/`findUnsupportedConstructs`
// tests) — the full `validateCardDefinition` end-to-end path (dynamic
// import + scoped `tsc`) is exercised live via `gate-and-write-status.mjs
// --all`, not re-tested here.
//
// `findStaticAbilitiesPolicyViolationReasons`/`findMissingSchemaFunctionality
// GapReasons`/`validateCoverageJustification` are all new (2026-09-18,
// later same day again — the schema-tightness redesign: `staticAbilities`
// is now a hard FDN policy violation, `missingSchemaFunctionality` is the
// structured successor to what `staticAbilities` used to informally mark,
// and a real `coverageJustification` manifest is now required to reach
// EITHER `purple` or `blue` — see `validate-card-definition.mjs`'s own
// header for the full writeup). The retired `findStaticAbilityGapReasons`
// (real bug it originally closed: `fdn-cards/inspiring-paladin`'s second
// real ability, left completely unmodeled as inert `staticAbilities` free
// text with no structural marker at all, yet the gate still returned
// `ok:true`/`blue`) is gone — its old behavior is now split across the two
// new functions below.
import { describe, expect, it } from 'vitest';
import {
  findMissingSchemaFunctionalityGapReasons,
  findNameOnlyTriggerGapReasons,
  findStaticAbilitiesPolicyViolationReasons,
  validateCoverageJustification,
} from './scripts/validate-card-definition.mjs';
import type { CardDefinition, Trigger } from './card';

function mockDefinition(overrides: Partial<CardDefinition>): CardDefinition {
  return { name: 'Mock Card', manaCost: '{1}', typeLine: 'Creature — Mock', ...overrides } as CardDefinition;
}

describe('findStaticAbilitiesPolicyViolationReasons', () => {
  it('returns [] for a card with no staticAbilities field at all', () => {
    expect(findStaticAbilitiesPolicyViolationReasons(mockDefinition({}))).toEqual([]);
  });

  it('returns [] for a card with an explicitly empty staticAbilities array', () => {
    expect(findStaticAbilitiesPolicyViolationReasons(mockDefinition({ staticAbilities: [] }))).toEqual([]);
  });

  it('returns one reason per real staticAbilities entry, regardless of whether the card ALSO models that same clause elsewhere', () => {
    // Mirrors Inspiring Paladin's own real pre-migration shape: ability 1
    // is genuinely modeled via continuousKeywordGrants elsewhere on this
    // same definition, yet its own staticAbilities text entry still
    // counts — the blunt rule has no "already modeled elsewhere"
    // exception, and staticAbilities usage AT ALL is now disallowed for an
    // FDN card regardless of what it says.
    const def = mockDefinition({
      staticAbilities: [
        'During your turn, this creature has first strike.',
        'During your turn, creatures you control with +1/+1 counters on them have first strike.',
      ],
      continuousKeywordGrants: [{ includeSelf: true, onlyDuringYourTurn: true, keywords: ['FirstStrike'] }],
    });
    const reasons = findStaticAbilitiesPolicyViolationReasons(def);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toContain('During your turn, this creature has first strike.');
    expect(reasons[1]).toContain('During your turn, creatures you control with +1/+1 counters on them have first strike.');
    for (const r of reasons) expect(r).toContain('disallowed for an FDN card');
  });

  it('walks the back face too, tagging its reasons distinctly from the front face', () => {
    const def = mockDefinition({
      staticAbilities: ['front face static ability'],
      backFace: mockDefinition({ name: 'Mock Back', staticAbilities: ['back face static ability'] }),
    });
    const reasons = findStaticAbilitiesPolicyViolationReasons(def);
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
    expect(findStaticAbilitiesPolicyViolationReasons(def)).toEqual([]);
  });
});

describe('findMissingSchemaFunctionalityGapReasons', () => {
  it('returns [] for a card with no missingSchemaFunctionality field at all', () => {
    expect(findMissingSchemaFunctionalityGapReasons(mockDefinition({}))).toEqual([]);
  });

  it('returns [] for a card with an explicitly empty missingSchemaFunctionality array', () => {
    expect(findMissingSchemaFunctionalityGapReasons(mockDefinition({ missingSchemaFunctionality: [] }))).toEqual([]);
  });

  it('returns one reason per real entry, quoting both clause and demand', () => {
    const def = mockDefinition({
      missingSchemaFunctionality: [
        { clause: 'Ward—Pay 7 life.', demand: 'Keyword needs a cost-payload field for a non-default Ward cost.' },
      ],
    });
    const reasons = findMissingSchemaFunctionalityGapReasons(def);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('Ward—Pay 7 life.');
    expect(reasons[0]).toContain('Keyword needs a cost-payload field for a non-default Ward cost.');
  });

  it('walks the back face too, tagging its reasons distinctly from the front face', () => {
    const def = mockDefinition({
      missingSchemaFunctionality: [{ clause: 'front clause', demand: 'front demand' }],
      backFace: mockDefinition({ name: 'Mock Back', missingSchemaFunctionality: [{ clause: 'back clause', demand: 'back demand' }] }),
    });
    const reasons = findMissingSchemaFunctionalityGapReasons(def);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).not.toContain('[back face]');
    expect(reasons[1]).toContain('[back face]');
  });
});

describe('validateCoverageJustification', () => {
  it('fails when coverageJustification is missing entirely', () => {
    const result = validateCoverageJustification(mockDefinition({}));
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain('missing/empty coverageJustification manifest');
  });

  it('fails when coverageJustification is an explicitly empty array', () => {
    const result = validateCoverageJustification(mockDefinition({ coverageJustification: [] }));
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain('missing/empty coverageJustification manifest');
  });

  it('passes for a well-formed manifest whose coveredBy pointers all resolve', () => {
    const def = mockDefinition({
      keywords: ['Lifelink'],
      coverageJustification: [
        { clause: 'Lifelink', coveredBy: { kind: 'keyword', keyword: 'Lifelink' }, reasoning: 'Printed Lifelink keyword, mechanically enforced by state.ts dealDamage.' },
      ],
    });
    expect(validateCoverageJustification(def)).toEqual({ ok: true, reasons: [] });
  });

  it('fails when a coveredBy pointer names a keyword the card does not actually have', () => {
    const def = mockDefinition({
      keywords: ['Flying'],
      coverageJustification: [{ clause: 'Lifelink', coveredBy: { kind: 'keyword', keyword: 'Lifelink' }, reasoning: 'real reasoning' }],
    });
    const result = validateCoverageJustification(def);
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain("not present in this card's own `keywords`");
  });

  it('fails when a coveredBy pointer names a trigger that does not exist', () => {
    const def = mockDefinition({
      coverageJustification: [{ clause: 'ETB', coveredBy: { kind: 'trigger', name: 'onEnter' }, reasoning: 'real reasoning' }],
    });
    const result = validateCoverageJustification(def);
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain('not a real trigger name');
  });

  it('fails when clause or reasoning text is missing/empty', () => {
    const def = mockDefinition({
      keywords: ['Flying'],
      coverageJustification: [{ clause: '', coveredBy: { kind: 'keyword', keyword: 'Flying' }, reasoning: '   ' } as never],
    });
    const result = validateCoverageJustification(def);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('no real, non-empty `clause`'))).toBe(true);
    expect(result.reasons.some((r) => r.includes('no real, non-empty `reasoning`'))).toBe(true);
  });

  it('fails when a real missingSchemaFunctionality entry has no manifest entry referencing it', () => {
    const def = mockDefinition({
      keywords: ['Ward'],
      missingSchemaFunctionality: [{ clause: 'Ward—Pay 7 life.', demand: 'cost-payload field' }],
      coverageJustification: [{ clause: 'Ward', coveredBy: { kind: 'keyword', keyword: 'Ward' }, reasoning: 'Printed Ward keyword, base fact tracked.' }],
    });
    const result = validateCoverageJustification(def);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((r) => r.includes('has no coverageJustification entry referencing it'))).toBe(true);
  });

  it('passes when a real missingSchemaFunctionality entry IS referenced by a manifest entry', () => {
    const def = mockDefinition({
      keywords: ['Ward'],
      missingSchemaFunctionality: [{ clause: 'Ward—Pay 7 life.', demand: 'cost-payload field' }],
      coverageJustification: [
        { clause: 'Ward', coveredBy: { kind: 'keyword', keyword: 'Ward' }, reasoning: 'Printed Ward keyword, base fact tracked.' },
        { clause: 'Ward—Pay 7 life.', coveredBy: { kind: 'missingSchemaFunctionality', index: 0 }, reasoning: 'No cost-payload field exists yet; declared as a demand.' },
      ],
    });
    expect(validateCoverageJustification(def)).toEqual({ ok: true, reasons: [] });
  });

  it('walks the back face too, requiring its own independent manifest', () => {
    const def = mockDefinition({
      keywords: ['Flying'],
      coverageJustification: [{ clause: 'Flying', coveredBy: { kind: 'keyword', keyword: 'Flying' }, reasoning: 'Printed Flying keyword.' }],
      backFace: mockDefinition({ name: 'Mock Back', keywords: ['Menace'] }),
    });
    const result = validateCoverageJustification(def);
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toContain('[back face]');
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
