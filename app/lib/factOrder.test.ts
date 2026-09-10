import { describe, expect, it } from 'vitest';
import { orderByTextPosition } from './factOrder';
import type { FactRow } from './factOrder';
import type { Fact } from '../../functional-model/synergy';
import type { AnnotatedFace } from '../types';

/** Builds a `FactRow` for a fact identified by `id` alone (matches this
 * file's own `annotatedFactRefKey`/the page's own `factKey`, both of which
 * prefer `id` over the sourceText/description fallback) — keeps every
 * fixture below to just the fields the ordering logic itself reads. */
function row(id: string, role: 'source' | 'sink' = 'source'): FactRow {
  const fact = { id, role, event: 'placeholder' } as unknown as Fact;
  return { fact, key: id };
}

/** One face whose `oracleLines` link the given fact ids, in order — each
 * id becomes its own one-segment line, so the Nth id given is the Nth
 * line/position a real card's oracle text would put it at. */
function faceWithAnchors(...ids: string[]): AnnotatedFace {
  return {
    name: 'Test Face',
    manaCost: '',
    typeLine: 'Test',
    oracleLines: ids.map((id) => [{ text: 'placeholder text', facts: [{ id, role: 'source', description: '', sourceText: '' }] }]),
  };
}

describe('orderByTextPosition', () => {
  it('reorders fin/279 The Gold Saucer\'s own facts to printed oracle-text order', () => {
    // Authored order (synergy.json's own source-array-then-sink-array) —
    // exactly today's real on-disk order: played/battlefield-presence
    // (self, no anchor), mana (anchored), coin-flip (anchored), the two
    // Treasure facts (no anchor, authored right after coin-flip), draws-a-
    // card (anchored), then the single sink fact (no anchor, authored
    // last).
    const rows = [
      row('played'),
      row('battlefield-presence'),
      row('mana'),
      row('coin-flip'),
      row('treasure-battlefield-presence'),
      row('treasure-enters-battlefield'),
      row('draws-a-card'),
      row('artifact-sink', 'sink'),
    ];
    // Real printed line order: {T}: Add {C}. / {2},{T}: Flip a coin... /
    // {3},{T}, Sacrifice two artifacts: Draw a card. — only these 3 facts
    // ever get a real textual anchor on this card.
    const faces = [faceWithAnchors('mana', 'coin-flip', 'draws-a-card')];

    const result = orderByTextPosition(rows, faces).map((r) => r.key);

    // played/battlefield-presence: nothing anchored precedes them -> stay
    // at the very front, in authored order.
    // mana, coin-flip: real anchors, in their own text order.
    // the two Treasure facts: no anchor of their own, inherit coin-flip's
    // position (the nearest preceding anchored fact) -> land right after
    // it, in authored order between themselves.
    // artifact-sink and draws-a-card: draws-a-card is a real anchor;
    // artifact-sink has no anchor of its own but is authored right after
    // it (source-array-then-sink-array), so it inherits the SAME position
    // -> tied with draws-a-card, and the sink-before-source tiebreak
    // (user's own "sacrifice" rule) puts it first.
    expect(result).toEqual([
      'played',
      'battlefield-presence',
      'mana',
      'coin-flip',
      'treasure-battlefield-presence',
      'treasure-enters-battlefield',
      'artifact-sink',
      'draws-a-card',
    ]);
  });

  it('leaves wholly-unanchored facts in plain authored order (no sink-first jump) when NOTHING in the group has a real anchor', () => {
    // fin/293 Zanarkand's own "Other faces/functions" group: none of its 3
    // facts (a token-creation source, a putCounter source, and a
    // wants-lands sink) ever get a real textual anchor on the back face —
    // this is NOT the same as the Gold Saucer artifact-sink case above
    // (which had a REAL anchored predecessor, draws-a-card, to inherit
    // from and tie against). With no anchor anywhere in this face at all,
    // there's no real "shared line" for the sink-first tiebreak to apply
    // to — plain authored order is the only defensible fallback.
    const rows = [row('token-creation'), row('put-counter'), row('wants-lands', 'sink')];
    const faces = [faceWithAnchors()]; // no anchors linked on this face at all

    expect(orderByTextPosition(rows, faces).map((r) => r.key)).toEqual(['token-creation', 'put-counter', 'wants-lands']);
  });

  it('passes a simple single-fact card through unchanged (e.g. fin/271 Adventurer\'s Inn)', () => {
    const rows = [row('lifegain')];
    const faces = [faceWithAnchors()];
    expect(orderByTextPosition(rows, faces).map((r) => r.key)).toEqual(['lifegain']);
  });

  it('sorts a sink before a source when both are anchored to the exact same real line', () => {
    const rows = [row('effect', 'source'), row('cost', 'sink')];
    const faces: AnnotatedFace[] = [
      {
        name: 'Test Face',
        manaCost: '',
        typeLine: 'Test',
        oracleLines: [
          [
            {
              text: 'Sacrifice an artifact: draw a card.',
              facts: [
                { id: 'cost', role: 'sink', description: '', sourceText: '' },
                { id: 'effect', role: 'source', description: '', sourceText: '' },
              ],
            },
          ],
        ],
      },
    ];
    expect(orderByTextPosition(rows, faces).map((r) => r.key)).toEqual(['cost', 'effect']);
  });

  it('inherits a preceding anchored position across MULTIPLE consecutive unanchored facts', () => {
    const rows = [row('anchored-1'), row('unanchored-a'), row('unanchored-b'), row('anchored-2')];
    const faces = [faceWithAnchors('anchored-1', 'anchored-2')];
    // unanchored-a/-b both inherit anchored-1's position (the nearest
    // preceding anchored fact), landing right after it and before
    // anchored-2's own later position.
    expect(orderByTextPosition(rows, faces).map((r) => r.key)).toEqual(['anchored-1', 'unanchored-a', 'unanchored-b', 'anchored-2']);
  });

  it('reorders a fact whose real anchor appears LATER in oracle text ahead of one authored earlier but anchored sooner', () => {
    // Authored (synergy.json) order is the opposite of printed order here —
    // this is the whole point of the feature: text position wins over
    // authored position once both facts ARE anchored.
    const rows = [row('second-ability'), row('first-ability')];
    const faces = [faceWithAnchors('first-ability', 'second-ability')];
    expect(orderByTextPosition(rows, faces).map((r) => r.key)).toEqual(['first-ability', 'second-ability']);
  });
});
