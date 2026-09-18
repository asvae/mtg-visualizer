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

  it('the registry is seeded with exactly the one real, confirmed Ward entry', () => {
    expect(ENGINE_SUPPORT_REGISTRY.map((e) => e.id)).toEqual(['ward-not-enforced']);
  });
});
