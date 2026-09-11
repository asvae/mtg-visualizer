// Wires `scripts/annotation-coverage.mjs`'s check into the project's real
// `npm run test` path (`vitest run`) — not just a manually-run CLI script,
// same "don't let this bitrot into a one-off nobody runs again" discipline
// `scenario-card-names.test.ts` already established for its own check. A
// fact with zero `annotations` on a card that has opted into the
// annotations model (`ANNOTATED_CARD_SLUGS`) is a straight authoring
// invariant violation (2026-09-11, explicit user ask — "no annotation if
// undefined should be a thing"), so this test HARD FAILS (not
// `console.warn`/`it.skip`) whenever an opted-in card has one.
import { describe, expect, it } from 'vitest';
// `annotation-coverage.mjs` is deliberately plain JS, not `.ts` — same
// "importable under plain node/vite-node, no build step" convention
// `scenario-card-names.mjs` already established (and the same known,
// harmless TS7016 "could not find a declaration file" tsc quirk that comes
// with it — inert to runtime, see that file's own test's comment for the
// precedent). Also mirrors that file's own `: ScenarioCardNameViolation[]`
// trick below: the whole module resolves to `any` (per TS7016), so an
// explicit `AnnotationCoverageViolation[]` annotation on the one variable
// that matters gives real type-checking downstream (catches a typo'd field
// name in `v.slug`/`v.role`/etc.) without needing a real `.d.ts`.
import { findMissingAnnotations, findMissingAnnotationsInSynergy, ANNOTATED_CARD_SLUGS, type AnnotationCoverageViolation } from './scripts/annotation-coverage.mjs';

describe('annotation coverage — the checker itself has real teeth', () => {
  it('flags a fact with annotations entirely absent', () => {
    const synergy = { source: [{ event: 'cast', target: 'self' }], sink: [] };
    const violations = findMissingAnnotationsInSynergy('fake-slug', synergy);
    expect(violations).toEqual([{ slug: 'fake-slug', role: 'source', index: 0, description: 'cast' }]);
  });

  it('flags a fact whose annotations array is present but empty', () => {
    const synergy = { source: [], sink: [{ zone: 'Battlefield', annotations: [] }] };
    const violations = findMissingAnnotationsInSynergy('fake-slug', synergy);
    expect(violations).toEqual([{ slug: 'fake-slug', role: 'sink', index: 0, description: 'Battlefield' }]);
  });

  it('does NOT flag a fact with at least one real annotation', () => {
    const synergy = {
      source: [{ event: 'cast', target: 'self', annotations: [{ target: 'typeLine', start: 0, end: 8 }] }],
      sink: [],
    };
    expect(findMissingAnnotationsInSynergy('fake-slug', synergy)).toEqual([]);
  });
});

describe('annotation coverage — every opted-in card in the real pool', () => {
  it('has no fact with zero annotations (ANNOTATED_CARD_SLUGS)', async () => {
    const cardsDir = new URL('cards/', import.meta.url);
    const violations: AnnotationCoverageViolation[] = await findMissingAnnotations({ cardsDir });
    const summary = violations.map((v) => `${v.slug} [${v.role}][${v.index}] — ${v.description}`).join('\n');
    expect(violations, `Fact(s) with zero annotations found on an opted-in card:\n${summary}`).toEqual([]);
  });

  it('ANNOTATED_CARD_SLUGS is non-empty (this check is actually exercised against something real)', () => {
    expect(ANNOTATED_CARD_SLUGS.size).toBeGreaterThan(0);
  });
});
