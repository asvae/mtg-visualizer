import type { AnnotationRef, Fact } from '../../functional-model/synergy';

/** One row of the Facts tab table (app/pages/app/card/[set]/[number].vue)
 * — a raw `Fact` plus its own stable display key (see that page's own
 * `factKey`). */
export interface FactRow {
  fact: Fact;
  key: string;
}

/**
 * Reorders `rows` (assumed already in "authored" order — synergy.json's
 * own source-array-then-sink-array concatenation, the order a human reads
 * the file in) to follow the card's own PRINTED oracle-text order instead
 * — user's own request against fin/279 The Gold Saucer, where the lone
 * artifact-sacrifice sink fact (logically tied to the card's LAST ability)
 * rendered as row 1 under the old sink-then-source concatenation.
 *
 * Mechanism (2026-09-11 rework — see `.claude/contracts/card-schema.md`'s
 * "Fact-to-oracle-text pointers" section): a fact's own baked
 * `Fact.annotations` (`AnnotationRef[]`, `functional-model/synergy.ts`)
 * already carries its real (line, start) position within its owning
 * face's own oracle text — no server-built segment tree to walk anymore,
 * just read the fact's own first annotation directly. A fact with no
 * `annotations` at all (no `sourceText`/`highlight` authored, or the match
 * never landed — e.g. Gold Saucer's two Treasure facts and its
 * artifact-sink fact) inherits the position of the nearest PRECEDING fact
 * in `rows`' own authored order that already has one (real or itself
 * inherited) — i.e. it stays immediately after whatever real ability it's
 * authored right next to. A fact with no such predecessor at all (nothing
 * positioned precedes it anywhere in `rows`) sorts before every positioned
 * fact, in plain authored order — matches the pre-existing order for Gold
 * Saucer's own `played`/`battlefield-presence` facts (self, authored
 * first, nothing precedes them).
 *
 * Tiebreak for two facts sharing the exact same (line, start) position (a
 * real shared anchor — one line that's both a cost, a sink, and an
 * effect, a source, e.g. "Sacrifice two artifacts: Draw a card."): the
 * SINK sorts first, matching real reading order (pay the cost, then get
 * the effect); still tied, plain authored order. A tie with NO resolved
 * position at all (nothing anchored precedes any of them) does NOT get
 * this sink-first treatment — there's no real shared "line" to reason
 * about yet, so plain authored order is the only defensible fallback (see
 * this file's own `.test.ts`: Zanarkand's three wholly-unanchored
 * back-face facts keep their synergy.json order rather than a sink fact
 * jumping to the front for no textual reason).
 *
 * Applied PER FACE GROUP independently by the caller (once per
 * `factRowGroups` entry — front face's own facts alone for "Main card,"
 * every other face's own facts for "Other faces/functions") — a fact's
 * `line`/`start` numbers are only ever meaningful relative to its OWN
 * owning face's oracle text (see `AnnotationRef`'s own doc comment), so
 * this function never needs (and no longer takes) the face's own oracle
 * text at all — just the rows themselves, already scoped by the caller to
 * one face group at a time.
 *
 * A `target: 'typeLine'` annotation (see `AnnotationRef`) has no `line` at
 * all — the type line has no paragraph structure and, visually, sits ABOVE
 * line 0 of the oracle text on the rendered card — so it's given a
 * synthetic `line: -1` here purely for this function's own sort purposes
 * (never read/served as a real line number anywhere else), keeping it
 * ordered before every real oracle-text line, tie-broken by its own `start`.
 */
function annotationPosition(ann: AnnotationRef): { line: number; start: number } {
  return { line: ann.target === 'typeLine' ? -1 : ann.line, start: ann.start };
}

export function orderByTextPosition(rows: FactRow[]): FactRow[] {
  const positions = new Map<string, { line: number; start: number }>();
  for (const row of rows) {
    // Only the fact's own FIRST annotation is used as its position — same
    // "one fact -> one position" rule the pre-pointer segment-tree walk
    // effectively enforced too (a fact's first-encountered segment), and no
    // current fact needs more than one anchor for ordering purposes.
    const ann = row.fact.annotations?.[0];
    if (ann) positions.set(row.key, annotationPosition(ann));
  }

  let carry: { line: number; start: number } | undefined;
  const resolved: ({ line: number; start: number } | undefined)[] = rows.map((row) => {
    const real = positions.get(row.key);
    if (real) carry = real;
    return real ?? carry;
  });

  return rows
    .map((row, i) => ({ row, i, pos: resolved[i] }))
    .sort((a, b) => {
      if (!a.pos && !b.pos) return a.i - b.i;
      if (!a.pos) return -1;
      if (!b.pos) return 1;
      if (a.pos.line !== b.pos.line) return a.pos.line - b.pos.line;
      if (a.pos.start !== b.pos.start) return a.pos.start - b.pos.start;
      if (a.row.fact.role !== b.row.fact.role) return a.row.fact.role === 'sink' ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.row);
}
