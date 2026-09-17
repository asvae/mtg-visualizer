// Unit tests for `card-status.ts`'s pure 8-bucket dashboard classifier —
// see that file's own header for the full priority-order rationale.
// `compute-card-status.mjs` (the real fs/dynamic-import orchestration this
// feeds) is exercised end-to-end via `npm run card-status` against the real
// pool, not re-tested here — this file only covers the pure decision logic.
import { describe, expect, it } from 'vitest';
import type { CardDefinition, Effect } from './card';
import {
  cardStatusBaseline,
  cardStatusColor,
  classifyCardStatus,
  collectEffects,
  findUnsupportedConstructs,
  isUnsupportedNoOp,
} from './card-status';
import type { CardStatusBucket } from './card-status';

function baseCard(overrides: Partial<CardDefinition> = {}): CardDefinition {
  return { name: 'Test Card', manaCost: '{1}{W}', typeLine: 'Creature — Test', ...overrides };
}

describe('card-status — isUnsupportedNoOp / findUnsupportedConstructs', () => {
  it('flags a real block-body no-op custom effect (the pool\'s own established "unsupported construct" convention)', () => {
    const effect: Effect = { kind: 'custom', describe: 'no Effect kind exists for this', run: () => {} };
    expect(isUnsupportedNoOp(effect)).toBe(true);
  });

  it('does NOT flag a custom effect with a real block body', () => {
    const effect: Effect = {
      kind: 'custom',
      describe: 'attach to target creature you control',
      run: (ctx, actions) => {
        const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        if (target) actions.equip(ctx.self, target);
      },
    };
    expect(isUnsupportedNoOp(effect)).toBe(false);
  });

  it('does NOT flag a real implicit-return (no braces) single-expression arrow — the confirmed relentless-x-atm092 false-positive class', () => {
    const effect: Effect = { kind: 'custom', describe: 'tap this card as it returns to the battlefield', run: (ctx, actions) => actions.tap(ctx.self) };
    expect(isUnsupportedNoOp(effect)).toBe(false);
  });

  it('does NOT flag a non-custom effect', () => {
    const effect: Effect = { kind: 'drawCard' };
    expect(isUnsupportedNoOp(effect)).toBe(false);
  });

  it('flags a no-op even when the block body is only whitespace/comments', () => {
    const effect: Effect = { kind: 'custom', describe: 'x', run: () => { /* nothing real happens here */ } };
    expect(isUnsupportedNoOp(effect)).toBe(true);
  });

  it('collectEffects walks effects, triggers, abilities, nested modal modes, and backFace', () => {
    const noop: Effect = { kind: 'custom', describe: 'deep one', run: () => {} };
    const def = baseCard({
      effects: [{ kind: 'drawCard' }],
      triggers: [{ name: 'onEnter', effects: [{ kind: 'modal', modes: [{ describe: 'mode A', effects: [noop] }] }] }],
      abilities: [{ name: 'ability', cost: '{1}', effects: [{ kind: 'gainLife', amount: 1 }] }],
      backFace: baseCard({ name: 'Test Card — Back', effects: [{ kind: 'custom', describe: 'back-face gap', run: () => {} }] }),
    });
    const all = collectEffects(def);
    expect(all).toContain(noop);
    // Both the front face's nested-modal no-op AND the backFace's own
    // no-op are collected — `collectEffects` recurses into `backFace` the
    // same way `card.ts`'s own `synergyTags()` does, so a transforming
    // DFC's back-face-only gap (a real pool shape, e.g.
    // `crystal-fragments-summon-alexander`) is never silently missed.
    expect(all.filter((e) => e.kind === 'custom')).toHaveLength(2);
    expect(findUnsupportedConstructs(def)).toEqual(['deep one', 'back-face gap']);
  });
});

describe('card-status — classifyCardStatus priority order', () => {
  const number = '1';
  const name = 'Test Card';

  it('red wins over everything else, even with otherwise-clean provenanced facts', () => {
    const definition = baseCard({ effects: [{ kind: 'custom', describe: 'no Effect kind exists for granting a new triggered ability', run: () => {} }] });
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition, synergy, textCoverage: { ratio: 1, gaps: [] } });
    expect(entry.status).toBe('red');
    expect(entry.reasons[0]).toMatch(/unsupported construct/);
  });

  it('gray when no definition was resolved at all', () => {
    const entry = classifyCardStatus({ number, name, definition: undefined, synergy: undefined, textCoverage: undefined });
    expect(entry.status).toBe('gray');
    expect(entry.reasons[0]).toMatch(/no functional-model card directory/);
  });

  it('gray when definition.ts exists but synergy.json was never generated', () => {
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy: undefined, textCoverage: undefined });
    expect(entry.status).toBe('gray');
    expect(entry.reasons[0]).toMatch(/never been generated/);
  });

  it('gray when synergy.json has 0 facts (not just no facts field at all)', () => {
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy: { source: [], sink: [] }, textCoverage: undefined });
    expect(entry.status).toBe('gray');
    expect(entry.reasons[0]).toMatch(/0 facts/);
  });

  it('gray takes priority over what would otherwise vacuously look like a clean yellow/green (0 facts, no coverage gaps to report)', () => {
    // A naive top-down check of "no unprovenanced facts" + "no coverage gaps"
    // would both be vacuously true for an empty fact list — gray must win.
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy: { source: [], sink: [] }, textCoverage: { ratio: 0, gaps: [] } });
    expect(entry.status).toBe('gray');
  });

  it('orange when at least one fact has no parser provenance', () => {
    const synergy = {
      source: [
        { event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } },
        { event: 'destroy' }, // hand-authored, no provenance at all
      ],
      sink: [],
    };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 1, gaps: [] } });
    expect(entry.status).toBe('orange');
    expect(entry.reasons[0]).toMatch(/1 of 2 fact\(s\) missing provenance/);
  });

  it('green when every fact is provenanced and text coverage reports 0 gaps', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.9, gaps: [] } });
    expect(entry.status).toBe('green');
  });

  it('green (not verified) when review is "ai" — the default, un-upgraded case', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.9, gaps: [] }, review: 'ai' });
    expect(entry.status).toBe('green');
  });

  it('green (not verified) when review is entirely absent — undefined never upgrades', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.9, gaps: [] } });
    expect(entry.status).toBe('green');
  });

  it('verified — a NARROWING of green, when review is "human" on an otherwise-green card', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.9, gaps: [] }, review: 'human' });
    expect(entry.status).toBe('verified');
    expect(entry.reasons[0]).toMatch(/human-reviewed/);
  });

  it('does NOT upgrade to verified when review is "human" but the card is otherwise yellow (real gap left)', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.5, gaps: [{ face: 'front', text: 'uncovered clause' }] }, review: 'human' });
    expect(entry.status).toBe('yellow');
  });

  it('does NOT upgrade to verified when review is "human" but the card is otherwise orange (unprovenanced fact)', () => {
    const synergy = { source: [{ event: 'drawCard' }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 1, gaps: [] }, review: 'human' });
    expect(entry.status).toBe('orange');
  });

  it('does NOT upgrade to verified when review is "human" but the card is otherwise gray (0 facts)', () => {
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy: { source: [], sink: [] }, textCoverage: undefined, review: 'human' });
    expect(entry.status).toBe('gray');
  });

  it('does NOT upgrade to verified when review is "human" but the card is otherwise red (unsupported construct)', () => {
    const definition = baseCard({ effects: [{ kind: 'custom', describe: 'no Effect kind exists for granting a new triggered ability', run: () => {} }] });
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition, synergy, textCoverage: { ratio: 1, gaps: [] }, review: 'human' });
    expect(entry.status).toBe('red');
  });

  it('uncertain — a NARROWING of green, when a non-empty reviewCaveat is present on an otherwise-green card', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({
      number,
      name,
      definition: baseCard(),
      synergy,
      textCoverage: { ratio: 0.9, gaps: [] },
      reviewCaveat: 'no generic "has a triggered ability" Fact category exists to model this as a graph relation',
    });
    expect(entry.status).toBe('uncertain');
    expect(entry.reasons[0]).toMatch(/flagged with a known caveat/);
  });

  it('uncertain wins over verified — a caveat is a stronger signal than a plain human review, even when review is also "human"', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({
      number,
      name,
      definition: baseCard(),
      synergy,
      textCoverage: { ratio: 0.9, gaps: [] },
      review: 'human',
      reviewCaveat: 'known conceptual gap, not yet modelable as a Fact',
    });
    expect(entry.status).toBe('uncertain');
  });

  it('does NOT become uncertain when reviewCaveat is an empty/whitespace-only string — treated the same as absent', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entryEmpty = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.9, gaps: [] }, reviewCaveat: '' });
    expect(entryEmpty.status).toBe('green');
    const entryWhitespace = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.9, gaps: [] }, reviewCaveat: '   ' });
    expect(entryWhitespace.status).toBe('green');
  });

  it('a reviewCaveat is ignored (does NOT change the bucket) on an otherwise-yellow card (real gap left)', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({
      number,
      name,
      definition: baseCard(),
      synergy,
      textCoverage: { ratio: 0.5, gaps: [{ face: 'front', text: 'uncovered clause' }] },
      reviewCaveat: 'some known caveat',
    });
    expect(entry.status).toBe('yellow');
  });

  it('a reviewCaveat is ignored (does NOT change the bucket) on an otherwise-orange card (unprovenanced fact)', () => {
    const synergy = { source: [{ event: 'drawCard' }], sink: [] };
    const entry = classifyCardStatus({
      number,
      name,
      definition: baseCard(),
      synergy,
      textCoverage: { ratio: 1, gaps: [] },
      reviewCaveat: 'some known caveat',
    });
    expect(entry.status).toBe('orange');
  });

  it('a reviewCaveat is ignored (does NOT change the bucket) on an otherwise-red card (unsupported construct)', () => {
    const definition = baseCard({ effects: [{ kind: 'custom', describe: 'no Effect kind exists for granting a new triggered ability', run: () => {} }] });
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition, synergy, textCoverage: { ratio: 1, gaps: [] }, reviewCaveat: 'some known caveat' });
    expect(entry.status).toBe('red');
  });

  it('a reviewCaveat is ignored (does NOT change the bucket) on an otherwise-gray card (0 facts)', () => {
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy: { source: [], sink: [] }, textCoverage: undefined, reviewCaveat: 'some known caveat' });
    expect(entry.status).toBe('gray');
  });

  it('re-review — a NARROWING of green, when review is "regression" on an otherwise-green card', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.9, gaps: [] }, review: 'regression' });
    expect(entry.status).toBe('re-review');
    expect(entry.reasons[0]).toMatch(/previously human-reviewed and verified, but real content has changed since/);
  });

  it('re-review wins over uncertain — a real detected drift outranks a stale-but-still-present caveat', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({
      number,
      name,
      definition: baseCard(),
      synergy,
      textCoverage: { ratio: 0.9, gaps: [] },
      review: 'regression',
      reviewCaveat: 'known conceptual gap, not yet modelable as a Fact',
    });
    expect(entry.status).toBe('re-review');
  });

  it('confirming review: "human" still upgrades to verified as before (untouched by the new "regression" value)', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.9, gaps: [] }, review: 'human' });
    expect(entry.status).toBe('verified');
  });

  it('does NOT upgrade to re-review when review is "regression" but the card is otherwise yellow (real gap left)', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.5, gaps: [{ face: 'front', text: 'uncovered clause' }] }, review: 'regression' });
    expect(entry.status).toBe('yellow');
  });

  it('does NOT upgrade to re-review when review is "regression" but the card is otherwise orange (unprovenanced fact)', () => {
    const synergy = { source: [{ event: 'drawCard' }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 1, gaps: [] }, review: 'regression' });
    expect(entry.status).toBe('orange');
  });

  it('does NOT upgrade to re-review when review is "regression" but the card is otherwise red (unsupported construct)', () => {
    const definition = baseCard({ effects: [{ kind: 'custom', describe: 'no Effect kind exists for granting a new triggered ability', run: () => {} }] });
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition, synergy, textCoverage: { ratio: 1, gaps: [] }, review: 'regression' });
    expect(entry.status).toBe('red');
  });

  it('does NOT upgrade to re-review when review is "regression" but the card is otherwise gray (0 facts)', () => {
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy: { source: [], sink: [] }, textCoverage: undefined, review: 'regression' });
    expect(entry.status).toBe('gray');
  });

  it('yellow when every fact is provenanced but text coverage reports a real gap', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: { ratio: 0.5, gaps: [{ face: 'front', text: 'uncovered clause' }] } });
    expect(entry.status).toBe('yellow');
    expect(entry.reasons[0]).toMatch(/1 uncovered span/);
  });

  it('yellow (not green) when text coverage could not be computed at all — never assumes full coverage without checking', () => {
    const synergy = { source: [{ event: 'drawCard', provenance: { origin: 'parser', rule: 'drawCard-effect-structural' } }], sink: [] };
    const entry = classifyCardStatus({ number, name, definition: baseCard(), synergy, textCoverage: undefined });
    expect(entry.status).toBe('yellow');
    expect(entry.reasons[0]).toMatch(/could not be computed/);
  });
});

describe('card-status — cardStatusBaseline / cardStatusColor (5-state display-axis translation)', () => {
  it('folds red and gray to the gray baseline/color', () => {
    for (const status of ['red', 'gray'] as const) {
      expect(cardStatusBaseline(status)).toBe('gray');
      expect(cardStatusColor(status)).toBe('gray');
    }
  });

  it('folds orange and (coverage-gap) yellow to the purple baseline/color', () => {
    for (const status of ['orange', 'yellow'] as const) {
      expect(cardStatusBaseline(status)).toBe('purple');
      expect(cardStatusColor(status)).toBe('purple');
    }
  });

  it('folds green and re-review to the blue baseline/color (a stale re-review confirmation is dropped, not carried forward as green)', () => {
    for (const status of ['green', 're-review'] as const) {
      expect(cardStatusBaseline(status)).toBe('blue');
      expect(cardStatusColor(status)).toBe('blue');
    }
  });

  it('verified has a blue baseline but a green (confirmed) color', () => {
    expect(cardStatusBaseline('verified')).toBe('blue');
    expect(cardStatusColor('verified')).toBe('green');
  });

  it('uncertain has a blue baseline but a yellow (flagged) color', () => {
    expect(cardStatusBaseline('uncertain')).toBe('blue');
    expect(cardStatusColor('uncertain')).toBe('yellow');
  });

  it('every real CardStatusBucket value maps to exactly one of the 5 display colors (exhaustiveness smoke test)', () => {
    const allBuckets: CardStatusBucket[] = ['verified', 'uncertain', 're-review', 'green', 'yellow', 'orange', 'red', 'gray'];
    const validColors = new Set(['gray', 'purple', 'blue', 'yellow', 'green']);
    for (const status of allBuckets) {
      expect(validColors.has(cardStatusColor(status))).toBe(true);
    }
  });
});
