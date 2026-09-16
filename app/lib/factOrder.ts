import type { AnnotationRef, Fact } from '../../functional-model/synergy';
import type { AnnotatedNonFactSpan } from '../../server/api/card/[set]/[number]';

// Re-exported so any consumer of `NonFactSpanRow` (CardDetailTabs.vue,
// FunctionalModelText.vue) can get the underlying span type from this one
// module too, without a second import from the server route.
export type { AnnotatedNonFactSpan };

/** One row of the Facts tab table (app/pages/app/card/[set]/[number].vue)
 * — a raw `Fact` plus its own stable display key (see that page's own
 * `factKey`). */
export interface FactRow {
  fact: Fact;
  key: string;
}

/** A non-Fact row (2026-09-16, `progress.json`'s own `annotatedNonFactSpans`
 * — see `.claude/contracts/card-schema.md`) — real oracle-text/type-line
 * spans that are accounted for but deliberately carry no `Fact` at all.
 * Same "display row" shape convention as `FactRow` (a stable `key` plus the
 * underlying data), but never has a `role` (no source/sink — these are
 * never rendered with the role icon, and never feed synergy matching). Only
 * ever shown behind the Facts tab's own opt-in toggle, but — once shown —
 * ordered into the exact SAME text-ordered list as real fact rows via
 * `orderByTextPosition` below, never a separate section
 * (`feedback_facts_text_order_role_icon_only` applies here too). */
export interface NonFactSpanRow {
  span: AnnotatedNonFactSpan;
  key: string;
}

/** Either kind of Facts-tab row `orderByTextPosition` can place — a plain
 * union rather than a shared base interface, since a `FactRow`'s position
 * comes off `fact.annotations[0]` and a `NonFactSpanRow`'s comes directly
 * off its own `span` (itself already `AnnotationRef`-shaped plus `kind`/
 * `note`) — `rowAnnotation` below is the one place that distinction is
 * bridged. */
export type DisplayRow = FactRow | NonFactSpanRow;

// Exported (not just an internal helper) so CardDetailTabs.vue's own
// template can narrow a `DisplayRow` the same way this module does
// internally, rather than re-deriving an equivalent `'fact' in row` check.
export function isFactRow(row: DisplayRow): row is FactRow {
  return 'fact' in row;
}

/** Short, human-facing label for a non-Fact span's own `kind` (2026-09-16
 * follow-up, per direct user feedback) — the Facts tab row itself, and
 * `FunctionalModelText.vue`'s own hover tooltip, both show this short label
 * instead of the raw `kind` string. The span's own `note` free text is
 * authoring-only detail now — never rendered anywhere in the UI. */
export const NON_FACT_SPAN_KIND_LABEL: Record<AnnotatedNonFactSpan['kind'], string> = {
  'definition-path': 'Definition',
  rules: 'Rules',
  lore: 'Lore',
};

/** The one real `AnnotationRef`-shaped position a row is ordered by — a
 * `FactRow`'s own first real annotation (unchanged from before this
 * function went generic), or a `NonFactSpanRow`'s own `span` reinterpreted
 * as one (`line` defaults to 0 for a `target: 'typeLine'` span, which
 * `annotationPosition` below ignores anyway — same as a real
 * `AnnotationRef`). */
function rowAnnotation(row: DisplayRow): AnnotationRef | undefined {
  if (isFactRow(row)) return row.fact.annotations?.[0];
  const { span } = row;
  return span.target === 'typeLine'
    ? { target: 'typeLine', start: span.start, end: span.end }
    : { target: 'oracle', line: span.line ?? 0, start: span.start, end: span.end };
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

// Generic over the exact row type given (`FactRow[]` in -> `FactRow[]` out,
// unchanged from before this went generic; a mixed `DisplayRow[]`, once the
// Facts tab's own non-Fact-span toggle is on, in -> the same mix out) —
// preserves every existing caller's own narrower type without a cast.
export function orderByTextPosition<T extends DisplayRow>(rows: T[]): T[] {
  const positions = new Map<string, { line: number; start: number }>();
  for (const row of rows) {
    // Only the row's own FIRST annotation is used as its position — same
    // "one row -> one position" rule the pre-pointer segment-tree walk
    // effectively enforced too (a fact's first-encountered segment), and no
    // current fact/span needs more than one anchor for ordering purposes.
    const ann = rowAnnotation(row);
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
      // Sink-before-source tiebreak only makes sense between two real
      // facts (no non-Fact span has a `role` at all) — a tie involving a
      // non-Fact span (or two of them) falls straight through to plain
      // authored order instead.
      if (isFactRow(a.row) && isFactRow(b.row) && a.row.fact.role !== b.row.fact.role) return a.row.fact.role === 'sink' ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.row);
}
