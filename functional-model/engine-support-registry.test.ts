// Unit tests for `engine-support-registry.ts`'s pure classifier —
// `computeEngineSupport(definition)` — against synthetic fixtures (same
// "predicate corpus uses mocks" convention `coverage-justification.test.ts`
// already follows for this same pipeline).
import { describe, expect, it } from 'vitest';
import { computeEngineSupport, ENGINE_SUPPORT_REGISTRY } from './engine-support-registry';
import type { CardDefinition } from './card';

function mockDefinition(overrides: Partial<CardDefinition>): CardDefinition {
  return { name: 'Mock Card', manaCost: '{1}', typeLine: 'Creature — Mock', ...overrides } as CardDefinition;
}

describe('computeEngineSupport', () => {
  it("returns 'off' for a front-face card with keywords:['Ward']", () => {
    const definition = mockDefinition({ keywords: ['Ward'] });
    expect(computeEngineSupport(definition)).toBe('off');
  });

  it("returns 'on' for a card with no Ward (and no other tracked gap)", () => {
    const definition = mockDefinition({ keywords: ['FirstStrike', 'Trample'] });
    expect(computeEngineSupport(definition)).toBe('on');
  });

  it("returns 'on' for a card with no keywords at all", () => {
    const definition = mockDefinition({});
    expect(computeEngineSupport(definition)).toBe('on');
  });

  it("returns 'off' when only the backFace carries Ward", () => {
    const definition = mockDefinition({
      keywords: ['FirstStrike'],
      backFace: mockDefinition({ name: 'Mock Card // Back', keywords: ['Ward'] }),
    });
    expect(computeEngineSupport(definition)).toBe('off');
  });

  it("returns 'on' when neither face carries Ward", () => {
    const definition = mockDefinition({
      keywords: ['FirstStrike'],
      backFace: mockDefinition({ name: 'Mock Card // Back', keywords: ['Trample'] }),
    });
    expect(computeEngineSupport(definition)).toBe('on');
  });

  it('the registry is seeded with exactly the real, confirmed entries (Ward + the 2026-09-18 schema-completeness cluster + the same-day trigger-dispatch-cluster pass)', () => {
    expect(ENGINE_SUPPORT_REGISTRY.map((e) => e.id)).toEqual([
      'ward-not-enforced',
      'kicker-not-enforced',
      'prowess-not-enforced',
      'cant-block-not-enforced',
      'board-state-condition-not-enforced',
      'other-permanent-enters-trigger-not-enforced',
      'fdn-trigger-cluster-not-enforced',
      'spell-cost-reduction-card-type-gate-not-enforced',
    ]);
  });

  it("returns 'off' for a front-face card with keywords:['Kicker']", () => {
    expect(computeEngineSupport(mockDefinition({ keywords: ['Kicker'] }))).toBe('off');
  });

  it("returns 'off' for a front-face card with keywords:['Prowess']", () => {
    expect(computeEngineSupport(mockDefinition({ keywords: ['Prowess'] }))).toBe('off');
  });

  it("returns 'off' for a front-face card with keywords:['CantBlock']", () => {
    expect(computeEngineSupport(mockDefinition({ keywords: ['CantBlock'] }))).toBe('off');
  });

  it("returns 'off' for a card whose only backFace carries Kicker/Prowess/CantBlock", () => {
    expect(
      computeEngineSupport(
        mockDefinition({ keywords: ['FirstStrike'], backFace: mockDefinition({ name: 'Mock Card // Back', keywords: ['Kicker'] }) }),
      ),
    ).toBe('off');
  });

  it("returns 'off' for a trigger carrying a BoardStateCondition", () => {
    const definition = mockDefinition({
      triggers: [{ name: 'onAttack', on: 'attacks', condition: { kind: 'attackedThisTurn' }, effects: [] }],
    });
    expect(computeEngineSupport(definition)).toBe('off');
  });

  it("returns 'off' for a continuousKeywordGrants entry carrying a BoardStateCondition (backFace only)", () => {
    const definition = mockDefinition({
      keywords: ['FirstStrike'],
      backFace: mockDefinition({
        name: 'Mock Card // Back',
        continuousKeywordGrants: [{ includeSelf: true, keywords: ['Unblockable'], condition: { kind: 'graveyardCountAtLeast', min: 7 } }],
      }),
    });
    expect(computeEngineSupport(definition)).toBe('off');
  });

  it("returns 'on' for a trigger/grant with no condition set at all", () => {
    const definition = mockDefinition({
      triggers: [{ name: 'onEnter', on: 'enter', effects: [] }],
      continuousPTGrants: [{ includeSelf: true, power: 1, toughness: 1 }],
    });
    expect(computeEngineSupport(definition)).toBe('on');
  });

  it("returns 'off' for a trigger using on:'otherPermanentEnters'", () => {
    const definition = mockDefinition({
      triggers: [{ name: 'onOtherEnter', on: 'otherPermanentEnters', otherPermanentEntersMatch: { sameController: true }, effects: [] }],
    });
    expect(computeEngineSupport(definition)).toBe('off');
  });

  it("returns 'on' for a trigger using the pre-existing on:'enter' (not the new watch-trigger value)", () => {
    const definition = mockDefinition({ triggers: [{ name: 'onEnter', on: 'enter', effects: [] }] });
    expect(computeEngineSupport(definition)).toBe('on');
  });

  it.each(['lifeGained', 'dies', 'otherCreatureDies', 'attackersDeclared', 'drawNthCardThisTurn', 'castNoncreatureSpell', 'castInstantOrSorcery', 'dealsCombatDamageToPlayer', 'creatureYouControlDealsCombatDamageToPlayer', 'opponentLifeLost'] as const)(
    "returns 'off' for a trigger using on:'%s' (2026-09-18 trigger-dispatch-cluster pass)",
    (on) => {
      const definition = mockDefinition({ triggers: [{ name: 'onX', on, effects: [] }] });
      expect(computeEngineSupport(definition)).toBe('off');
    },
  );

  it("returns 'off' when only the backFace carries a trigger using on:'dies'", () => {
    const definition = mockDefinition({
      keywords: ['FirstStrike'],
      backFace: mockDefinition({ name: 'Mock Card // Back', triggers: [{ name: 'onDeath', on: 'dies', effects: [] }] }),
    });
    expect(computeEngineSupport(definition)).toBe('off');
  });

  it("returns 'off' for a spellCostReductionGrants entry carrying a non-empty cardTypes", () => {
    const definition = mockDefinition({ spellCostReductionGrants: [{ amount: 1, colors: [], cardTypes: ['Instant', 'Sorcery'] }] });
    expect(computeEngineSupport(definition)).toBe('off');
  });

  it("returns 'on' for a spellCostReductionGrants entry with no cardTypes (colors-only, pre-existing shape)", () => {
    const definition = mockDefinition({ spellCostReductionGrants: [{ amount: 1, colors: ['W'] }] });
    expect(computeEngineSupport(definition)).toBe('on');
  });

  it("returns 'off' when only the backFace carries a cardTypes-gated spellCostReductionGrants entry", () => {
    const definition = mockDefinition({
      keywords: ['FirstStrike'],
      backFace: mockDefinition({ name: 'Mock Card // Back', spellCostReductionGrants: [{ amount: 1, colors: [], cardTypes: ['Instant'] }] }),
    });
    expect(computeEngineSupport(definition)).toBe('off');
  });
});
