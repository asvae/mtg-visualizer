import type { Fact, AnnotatedFactRef } from '../../functional-model/synergy';
import type { AnnotatedFace } from '../types';

/** One row of the Facts tab table (app/pages/app/card/[set]/[number].vue)
 * — a raw `Fact` plus its own stable display key (see that page's own
 * `factKey`, the same shape `annotatedFactRefKey` below mirrors for an
 * `AnnotatedFactRef` instead). */
export interface FactRow {
  fact: Fact;
  key: string;
}

/** Same shape as the page's own `factKey` (`Fact` -> string), applied to
 * an `AnnotatedFactRef` instead — matches a fact-linked phrase in a face's
 * own `oracleLines` back to the `FactRow` it belongs to. */
export function annotatedFactRefKey(ref: AnnotatedFactRef): string {
  return ref.id ?? `${ref.role}::${ref.sourceText}::${ref.description}`;
}

/**
 * Reorders `rows` (assumed already in "authored" order — synergy.json's
 * own source-array-then-sink-array concatenation, the order a human reads
 * the file in) to follow the card's own PRINTED oracle-text order instead
 * — user's own request against fin/279 The Gold Saucer, where the lone
 * artifact-sacrifice sink fact (logically tied to the card's LAST ability)
 * rendered as row 1 under the old sink-then-source concatenation.
 *
 * Mechanism: walk `faces`' own `oracleLines` (already-computed, ordered
 * line/segment runs) top to bottom, left to right; a fact's TEXT POSITION
 * is the index of its first occurrence in that walk. A fact with no
 * textual anchor at all (no `sourceText`/`highlight`, so it never appears
 * in `oracleLines` — e.g. Gold Saucer's two Treasure facts and its
 * artifact-sink fact) inherits the text position of the nearest PRECEDING
 * fact in `rows`' own authored order that already has one (real or itself
 * inherited) — i.e. it stays immediately after whatever real ability it's
 * authored right next to. A fact with no such predecessor at all (nothing
 * positioned precedes it anywhere in `rows`) sorts before every positioned
 * fact, in plain authored order — matches the pre-existing order for Gold
 * Saucer's own `played`/`battlefield-presence` facts (self, authored
 * first, nothing precedes them).
 *
 * Tiebreak for two facts sharing the exact same RESOLVED position (a real
 * shared anchor — one line that's both a cost, a sink, and an effect, a
 * source, e.g. "Sacrifice two artifacts: Draw a card."): the SINK sorts
 * first, matching real reading order (pay the cost, then get the effect);
 * still tied, plain authored order. A tie with NO resolved position at all
 * (nothing anchored precedes any of them) does NOT get this sink-first
 * treatment — there's no real shared "line" to reason about yet, so plain
 * authored order is the only defensible fallback (see this file's own
 * `.test.ts`: Zanarkand's three wholly-unanchored back-face facts keep
 * their synergy.json order rather than a sink fact jumping to the front
 * for no textual reason).
 *
 * Applied PER FACE GROUP independently by the caller (once per
 * `factRowGroups` entry, each with its own relevant `faces` slice — front
 * face alone for "Main card," every other face for "Other
 * faces/functions") — never one global cross-face position, so a
 * back-face fact's position never competes against a front-face fact's.
 */
export function orderByTextPosition(rows: FactRow[], faces: AnnotatedFace[]): FactRow[] {
  const textPosition = new Map<string, number>();
  let next = 0;
  for (const face of faces) {
    for (const seg of face.oracleLines.flat()) {
      for (const ref of seg.facts ?? []) {
        const key = annotatedFactRefKey(ref);
        if (!textPosition.has(key)) textPosition.set(key, next++);
      }
    }
  }

  let carry: number | undefined;
  const resolved: (number | undefined)[] = rows.map((row) => {
    const real = textPosition.get(row.key);
    if (real !== undefined) carry = real;
    return real !== undefined ? real : carry;
  });

  return rows
    .map((row, i) => ({ row, i, pos: resolved[i] }))
    .sort((a, b) => {
      if (a.pos === undefined && b.pos === undefined) return a.i - b.i;
      if (a.pos === undefined) return -1;
      if (b.pos === undefined) return 1;
      if (a.pos !== b.pos) return a.pos - b.pos;
      if (a.row.fact.role !== b.row.fact.role) return a.row.fact.role === 'sink' ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.row);
}
