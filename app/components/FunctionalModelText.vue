<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { computePosition, offset, flip, shift, size } from '@floating-ui/dom';
import { parseManaSegments } from '../lib/manaSegments';
import { COLOR_MAP, COLORLESS, COLOR_LABEL } from '../lib/constants';
import { describeFact } from '../../functional-model/synergy';
import type { Fact } from '../../functional-model/synergy';
import type { AnnotatedCard } from '../types';
import { NON_FACT_SPAN_KIND_LABEL } from '../lib/factOrder';
import type { AnnotatedNonFactSpan, NonFactSpanRow } from '../lib/factOrder';

// `highlightKeys` — set by the parent card page while a Functional model
// table row is hovered, to `factKey()` of that row's own fact (see the card
// page's own `factKey` — same formula as this component's own `factKey`
// below, kept in sync by convention rather than a shared import since the
// table works off raw `Fact` objects and this component builds its own
// per-line segments off the same raw `Fact` objects now too — see
// `.claude/contracts/card-schema.md`'s "Fact-to-oracle-text pointers"
// section). `null`/unset/empty = nothing hovered, no segment highlighted.
// An ARRAY (not a single key, 2026-09-16 follow-up) — two real Facts can
// share the exact identical annotation span (e.g. fin/4 Aerith
// Gainsborough's own `[sink]` "Dying" and `[source]` "Dies" facts, both
// anchored to the same `dies-trigger-structural` line/char range; six more
// real pool cards share this shape — dwarven-castle-guard, undercity-dire-
// rat, ancient-adamantoise, garland-knight-of-cornelia-chaos-the-endless,
// magic-pot, vincent-valentine-galian-beast), and hovering either the
// shared text span or either one of the two rows must highlight BOTH rows/
// the one shared span together, not just whichever fact happened to sort
// first. A single-fact span still just carries a one-element array — this
// is a pure widening, not a behavior change for the (overwhelmingly common)
// one-fact-per-span case.
//
// `selfFacts`/`headerHighlightIndex` carry the card page's own self-
// referencing-fact annotation onto THIS component's own per-face name
// heading — the heading directly above the mana cost/type line/oracle text,
// one entry per real face, keyed 0 front/only, 1 back. `headerHighlightIndex`
// is the reciprocal half: which face name (if any) to flash while the user
// hovers a header-linked fact row's own icon in the Facts tab.
//
// `facts` — every CURRENTLY VISIBLE fact (source + sink — already filtered
// by the caller's own Facts-tab provenance toggles as of the 2026-09-16
// follow-up; see CardDetailTabs.vue's own `visibleSynergyFacts` — this
// component has no opinion on which facts are "visible," it just renders
// whatever it's given) — this component builds its OWN per-line highlighted
// segments at render time from each fact's own baked `Fact.annotations`
// (`AnnotationRef[]`, line-relative offsets into its owning face's
// `oracleText`), instead of receiving a pre-built segment tree from the
// server (the old `annotateOracleText`/`AnnotatedSegment` design, now
// deprecated engine-side — see `functional-model/synergy.ts`).
//
// `nonFactSpans` (2026-09-16, `progress.json`'s own `annotatedNonFactSpans`
// — see `.claude/contracts/card-schema.md`) — same "already filtered by the
// caller" contract as `facts`, gated by the Facts tab's own separate
// "non-fact spans" toggle. These are NOT Facts (no `role`, never fed to
// synergy matching) but get the exact same inline underline/hover/highlight
// treatment as a real fact's own annotated span — `app/lib/factOrder.ts`'s
// `NonFactSpanRow` (a stable `key` plus the raw span) is reused here so the
// SAME key a Facts-tab row hover sets (`hoveredFactKeys`, CardDetailTabs.vue)
// resolves back to the right segment.
const props = defineProps<{
  card: AnnotatedCard;
  facts?: Fact[];
  nonFactSpans?: NonFactSpanRow[];
  highlightKeys?: string[] | null;
  selfFacts?: Map<number, Fact[]>;
  headerHighlightIndex?: number | null;
}>();
// Lets the parent (the card page) mirror this panel's own hover into the
// Facts table row / Interactions row sharing the same fact — the three-way
// sync `highlightKeys` above drives is bidirectional: this component receives
// a highlight from elsewhere via the prop, and reports its own hover back up
// via this emit so the other two panels can highlight in turn. The emitted
// array names EVERY fact/span key behind the hovered segment (2026-09-16 —
// see `highlightKeys`' own doc comment above), not just one.
const emit = defineEmits<{ hover: [keys: string[] | null] }>();

// One run of a face's own oracle-text LINE — either plain prose, or a
// phrase with one or more real facts behind it (rare: two facts sharing the
// same anchor span). Built client-side now (`lineSegments` below), replaces
// the old server-built `AnnotatedSegment`/`AnnotatedFactRef` shapes
// (`functional-model/synergy.ts`, both `@deprecated`) — this component
// carries the real `Fact` objects directly instead of a slimmer ref, since
// it already has them on hand via the `facts` prop.
interface Segment {
  text: string;
  facts?: Fact[];
  // Non-Fact spans covering this exact run (2026-09-16) — a segment can
  // carry BOTH `facts` and `spans` in principle (buildSegments' own
  // interval-partition logic doesn't assume exclusivity), though no real
  // pool card currently overlaps the two on the same exact text.
  spans?: NonFactSpanRow[];
}

// Mirrors engine's own `factIdentity()` (functional-model/synergy.ts) —
// `Fact.id` was removed 2026-09-11; identity is now role + rendered label +
// the fact's own first real `annotations` entry (stringified). `annotations`
// is required by the TYPE, but only summon-bahamut's on-disk synergy.json
// actually carries it so far (pool-wide migration is separate, later work)
// — every other card's real facts lack the field despite the type, so this
// must tolerate `undefined` at runtime (confirmed live 500s otherwise,
// 2026-09-11). Same formula as the card page's own `factKey` — keep in sync.
function factKey(f: Fact): string {
  return `${f.role}::${describeFact(f)}::${JSON.stringify(f.annotations?.[0])}`;
}
// Whether a segment carries ANY link at all — a real Fact or a non-Fact
// span (2026-09-16) — gating the underline/hover markup in the template
// below. Named rather than an inline `seg.facts?.length` check so the
// template can't silently forget the `spans` half again (the exact bug
// this comment is fixing: the template's own `v-if` used to check only
// `seg.facts?.length`, so a segment covered by ONLY a non-Fact span never
// rendered as clickable/highlightable at all, even though `buildSegments`
// itself already attached the right `spans` array to it).
function hasSegmentLink(seg: Segment): boolean {
  return !!(seg.facts?.length || seg.spans?.length);
}
// A row's own `highlightKeys` (CardDetailTabs.vue's `hoveredFactKeys`) can
// now name either a real Fact (`factKey()` format) or a non-Fact span row
// (`NonFactSpanRow.key`, 2026-09-16), and can carry MORE THAN ONE key at
// once (2026-09-16 follow-up — a shared-span row hover broadcasts every
// fact/span key behind that same row) — a segment highlights the moment ANY
// of its own facts/spans match ANY of the hovered keys.
function isRowHighlighted(seg: Segment): boolean {
  if (!props.highlightKeys?.length) return false;
  const keys = props.highlightKeys;
  if (seg.facts?.some((f) => keys.includes(factKey(f)))) return true;
  return !!seg.spans?.some((s) => keys.includes(s.key));
}

// Blue underline when the phrase is a source, green when it's a sink —
// a segment carrying both (rare: two facts sharing one anchor phrase) reads
// as source, since that's the rarer/stronger claim to flag. A segment with
// NO real Fact at all (only a non-Fact span, 2026-09-16) gets its own
// neutral slate underline — deliberately NOT blue/emerald, which both
// carry a real source/sink meaning a non-Fact span doesn't have. Low
// opacity either way — this is a hint that the phrase is clickable, not a
// highlight to compete with the text itself.
function segColor(seg: Segment): string {
  if (seg.facts?.some((f) => f.role === 'source')) return 'decoration-blue-400/65';
  if (seg.facts?.length) return 'decoration-emerald-500/65';
  return 'decoration-slate-400/65';
}

// Which face (0 front/only, 1 back) a fact belongs to — same convention the
// card page's own `factFaceIndex` uses (`Fact.face`, `'front'`/`'back'`/
// omitted-for-single-faced — see `.claude/contracts/card-schema.md`).
// A single-faced card (`faceCount <= 1`) always resolves to 0 regardless of
// `face`, since there's no second face for anything to belong to.
function factFaceIndexFor(fact: Fact, faceCount: number): number {
  if (faceCount <= 1) return 0;
  return fact.face === 'back' ? 1 : 0;
}
// Same convention, for a non-Fact span's own `face` field instead of a
// `Fact`'s (2026-09-16).
function spanFaceIndexFor(span: AnnotatedNonFactSpan, faceCount: number): number {
  if (faceCount <= 1) return 0;
  return span.face === 'back' ? 1 : 0;
}

interface Range {
  start: number;
  end: number;
  facts?: Fact[];
  spans?: NonFactSpanRow[];
}

/**
 * Target-agnostic overlap/merge/slice core, shared by both the oracle-line
 * and type-line segment builders below. Given some string `text` and the
 * list of `{start, end, facts}` ranges that apply to that exact string
 * (already filtered down to the right face/line/type-line by the caller),
 * builds the plain-text-and-fact-linked run list — a proper interval
 * partition: every distinct (start,end) boundary across all ranges becomes a
 * cut point, and each resulting minimal slice carries the union of every
 * range that fully covers it, so an EXACT-duplicate pair (two ranges with
 * the identical span, e.g. mega-flare-you/mega-flare-opp sharing one
 * damage-clause phrase) merges into one multi-fact segment same as before,
 * and a NESTED pair (one range wholly inside another — the real case that
 * motivated this rewrite: fin/1's own `self-cast`("Creature", 12-20) sits
 * entirely inside `self-enters`("Enchantment Creature", 0-20) on the type
 * line) now correctly renders as three segments (`Enchantment ` →
 * self-enters only, `Creature` → both, `` empty tail) instead of the
 * type-agnostic byte-for-byte port of `annotateOracleText`'s OLD
 * sort-and-first-wins tolerance this replaced, which silently dropped
 * whichever range sorted second entirely for any overlap that wasn't an
 * exact duplicate — fine for oracle text (no current fact data exercises a
 * true partial/nested overlap there), but wrong here since a `typeLine`
 * baseline fact commonly nests inside another. Adjacent minimal slices that
 * end up covered by the exact same facts (by reference) are re-joined so
 * two touching identical-coverage cuts still render as one visual run.
 */
function buildSegments(text: string, ranges: Range[]): Segment[] {
  if (text.length === 0) return [];
  if (ranges.length === 0) return [{ text }];

  const boundaries = [...new Set([0, text.length, ...ranges.flatMap((r) => [r.start, r.end])])]
    .filter((p) => p >= 0 && p <= text.length)
    .sort((a, b) => a - b);

  // Generic reference-array equality — used for both `facts` and `spans`
  // (2026-09-16); a segment only re-joins its predecessor when BOTH arrays
  // match, not just one.
  function sameRefs<T>(a: T[] | undefined, b: T[] | undefined): boolean {
    return (!a && !b) || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));
  }

  const segments: Segment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]!;
    const end = boundaries[i + 1]!;
    if (start === end) continue;
    const covering = ranges.filter((r) => r.start <= start && r.end >= end);
    const factsCovering = covering.flatMap((r) => r.facts ?? []);
    const spansCovering = covering.flatMap((r) => r.spans ?? []);
    const facts = factsCovering.length > 0 ? factsCovering : undefined;
    const spans = spansCovering.length > 0 ? spansCovering : undefined;
    const last = segments[segments.length - 1];
    if (last && sameRefs(last.facts, facts) && sameRefs(last.spans, spans)) {
      last.text += text.slice(start, end);
      continue;
    }
    segments.push({ text: text.slice(start, end), ...(facts ? { facts } : {}), ...(spans ? { spans } : {}) });
  }
  return segments;
}

/**
 * Splits one LINE of a face's own real oracle text into plain-text runs and
 * fact-linked/span-linked runs, from just the facts that belong to this
 * face and declare a real `target: 'oracle'` `Fact.annotations` entry
 * targeting this exact line, PLUS (2026-09-16) any non-Fact span row whose
 * own `target: 'oracle'` span names this same line.
 */
function buildLineSegments(lineText: string, lineIndex: number, facts: Fact[], spans: NonFactSpanRow[]): Segment[] {
  const ranges: Range[] = [];
  for (const f of facts) {
    for (const ann of f.annotations ?? []) {
      if (ann.target !== 'oracle' || ann.line !== lineIndex) continue;
      ranges.push({ start: ann.start, end: ann.end, facts: [f] });
    }
  }
  for (const row of spans) {
    if (row.span.target !== 'oracle' || (row.span.line ?? -1) !== lineIndex) continue;
    ranges.push({ start: row.span.start, end: row.span.end, spans: [row] });
  }
  return buildSegments(lineText, ranges);
}

/**
 * Splits a face's own real printed type line into plain-text runs and
 * fact-linked/span-linked runs, from just the facts that belong to this
 * face and declare a real `target: 'typeLine'` `Fact.annotations` entry —
 * e.g. fin/1 Summon: Bahamut's own `self-cast`/`self-enters` baseline
 * facts, whose real textual basis is the printed type line ("Creature"/
 * "Enchantment Creature"), not any oracle-text body span — PLUS
 * (2026-09-16) any non-Fact span row whose own `target: 'typeLine'` span
 * belongs to this face. A `typeLine` annotation/span has no `line` field (a
 * type line has no paragraph structure) — `start`/`end` are offsets
 * directly into the whole `typeLine` string, per `.claude/contracts/
 * card-schema.md`'s `AnnotationRef` doc.
 */
function buildTypeLineSegments(typeLine: string, facts: Fact[], spans: NonFactSpanRow[]): Segment[] {
  const ranges: Range[] = [];
  for (const f of facts) {
    for (const ann of f.annotations ?? []) {
      if (ann.target !== 'typeLine') continue;
      ranges.push({ start: ann.start, end: ann.end, facts: [f] });
    }
  }
  for (const row of spans) {
    if (row.span.target !== 'typeLine') continue;
    ranges.push({ start: row.span.start, end: row.span.end, spans: [row] });
  }
  return buildSegments(typeLine, ranges);
}

// One entry per face, one entry per line within that face — the client-side
// replacement for the server's old `AnnotatedFace.oracleLines`. Recomputed
// whenever the card, the visible fact list, or the visible non-Fact-span
// list changes (both `facts`/`nonFactSpans` are already filtered by the
// caller's own Facts-tab toggles as of 2026-09-16 — see this component's
// own `nonFactSpans` doc comment above).
const faceLines = computed<Segment[][][]>(() => {
  const faceCount = props.card.faces.length;
  const allFacts = props.facts ?? [];
  const allSpans = props.nonFactSpans ?? [];
  return props.card.faces.map((face, fi) => {
    const factsForFace = allFacts.filter((f) => factFaceIndexFor(f, faceCount) === fi);
    const spansForFace = allSpans.filter((row) => spanFaceIndexFor(row.span, faceCount) === fi);
    return face.oracleText.split('\n').map((lineText, li) => buildLineSegments(lineText, li, factsForFace, spansForFace));
  });
});

// One entry per face — its own type line's segments, same shape/treatment as
// an oracle-text line (see `buildTypeLineSegments`). Most cards have zero
// `target: 'typeLine'` facts/spans today (only summon-bahamut is backfilled
// so far), so this resolves to a single untouched plain-text segment for
// them — renders identically to the old bare `{{ face.typeLine }}` span.
const faceTypeLine = computed<Segment[][]>(() => {
  const faceCount = props.card.faces.length;
  const allFacts = props.facts ?? [];
  const allSpans = props.nonFactSpans ?? [];
  return props.card.faces.map((face, fi) => {
    const factsForFace = allFacts.filter((f) => factFaceIndexFor(f, faceCount) === fi);
    const spansForFace = allSpans.filter((row) => spanFaceIndexFor(row.span, faceCount) === fi);
    return buildTypeLineSegments(face.typeLine, factsForFace, spansForFace);
  });
});

// A real floating tooltip — same computePosition/offset/flip/shift/size
// recipe TooltipView.vue uses for the graph's own card hover, just anchored
// to the hovered <span> itself rather than the cursor. Nuxt UI's own
// `UTooltip` was tried here first but its content box didn't reliably
// resize/reposition for a TWO-fact tooltip (a phrase with more than one fact
// behind it, e.g. Elrond's "Return those cards to the battlefield" carrying
// both its zone and entersBattlefield produces) — this recipe's own `size()`
// middleware explicitly caps the tooltip to whatever room is actually
// available on whichever side `flip()` picked, so a taller (multi-fact) box
// still repositions correctly instead of overlapping the text below it.
const hovered = ref<Segment | null>(null);
const tooltipEl = ref<HTMLElement | null>(null);
const tipX = ref(0);
const tipY = ref(0);
let positionRequestId = 0;

async function show(seg: Segment, e: MouseEvent) {
  hovered.value = seg;
  // Broadcasts EVERY fact/span key behind this phrase (2026-09-16 follow-up
  // — a segment can carry more than one Fact when two facts share the exact
  // identical annotation span, e.g. fin/4 Aerith Gainsborough's own "Dying"/
  // "Dies" pair; see the tooltip's own multi-entry rendering below, and
  // `highlightKeys`' own doc comment above for the full real-card list).
  // Facts first, then any non-Fact spans on the same run — never mixed
  // priority, just every key that's actually here.
  const keys = [...(seg.facts?.map((f) => factKey(f)) ?? []), ...(seg.spans?.map((s) => s.key) ?? [])];
  emit('hover', keys.length ? keys : null);
  const anchor = e.currentTarget as HTMLElement;
  const requestId = ++positionRequestId;
  await nextTick();
  if (!tooltipEl.value) return;
  const { x, y } = await computePosition(anchor, tooltipEl.value, {
    strategy: 'fixed',
    placement: 'top-start',
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight }) {
          tooltipEl.value!.style.maxHeight = `${availableHeight}px`;
        },
      }),
    ],
  });
  if (requestId !== positionRequestId) return; // superseded by a newer hover — discard
  tipX.value = x;
  tipY.value = y;
}
function hide() {
  hovered.value = null;
  emit('hover', null);
}

// Per-face name span refs — lets `scrollToFace` (exposed below, called by
// the card page's own `scrollToHeaderName`, see the Facts table's header-
// link row icon) find the right DOM element to scroll to/pop a tooltip on.
const faceNameEls = ref<(HTMLElement | null)[]>([]);
function setFaceNameEl(i: number, el: Element | ComponentPublicInstance | null) {
  faceNameEls.value[i] = (el as HTMLElement) ?? null;
}
// Bonus half of the reciprocal header<->row link: clicking a header-linked
// fact row's own icon scrolls the face name it annotates back into view and
// pops the exact same tooltip its own hover shows (auto-hidden shortly
// after) — same behavior the removed page-level `<h1>` used to provide
// directly, now delegated here since the heading itself lives in this
// component.
defineExpose({
  scrollToFace(index: number) {
    const el = faceNameEls.value[index];
    const facts = props.selfFacts?.get(index);
    if (!el || !facts?.length) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    show({ text: props.card.faces[index]?.name ?? '', facts }, { currentTarget: el } as unknown as MouseEvent);
    window.setTimeout(() => hide(), 1600);
  },
});
</script>

<template>
  <template v-for="(face, fi) in card.faces" :key="fi">
    <!-- A DFC's own real divider between faces (scryfall.com/card/<set>/<number>'s
         own two-part layout) — a genuine element, not a literal "------" run
         of dashes in the text. A single-faced card has just one face, no
         divider at all. -->
    <hr v-if="fi > 0" class="my-3 max-w-2xl border-border-subtle" />
    <div class="mb-1 flex max-w-2xl items-baseline gap-2 font-sans text-sm font-semibold text-text">
      <!-- This face's own name — the heading directly above its mana cost/
           type line/oracle text. A self-referencing fact (`isSelfReferencing`,
           app/lib/factConditions.ts — e.g. fin/1's own "cast a spell"/"dies"
           baseline facts) has no real oracle-text span to link, so it
           annotates THIS heading instead of a body phrase (see the card
           page's own `headerFaceFacts` doc comment) — same underline+hover
           tooltip treatment as any annotated body phrase, just always blue
           (not source/sink-colored via `segColor`) since a self fact can be
           either role. -->
      <span
        v-if="selfFacts?.get(fi)?.length"
        :ref="(el) => setFaceNameEl(fi, el)"
        class="cursor-help rounded underline decoration-blue-400/65 decoration-dashed decoration-1 underline-offset-4"
        :class="{ 'bg-blue-400/20': headerHighlightIndex === fi }"
        @mouseenter="show({ text: face.name, facts: selfFacts!.get(fi)! }, $event)"
        @mouseleave="hide"
        >{{ face.name }}</span
      >
      <span v-else>{{ face.name }}</span>
      <span v-if="face.manaCost" class="flex shrink-0 items-center gap-0.5 text-text/80">
        <template v-for="(ms, mi) in parseManaSegments(face.manaCost)" :key="mi">
          <ManaSymbol v-if="'mana' in ms" :code="ms.mana" />
          <template v-else>{{ ms.text }}</template>
        </template>
      </span>
    </div>
    <div class="mb-2 flex max-w-2xl items-center font-sans text-sm text-text/80">
      <!-- Real Scryfall "Color Indicator" — rendered as circular swatches
           (Scryfall's own `.color-indicator` styling) instead of a text
           label. Empty array = a genuinely colorless indicator. -->
      <span
        v-if="face.colorIndicator"
        class="mr-1 inline-flex translate-y-0.5 gap-0.5 align-middle"
        :title="`Color Indicator: ${face.colorIndicator.length ? face.colorIndicator.map((c) => COLOR_LABEL[c] ?? c).join(', ') : 'Colorless'}`"
      >
        <span
          v-for="(c, ci) in face.colorIndicator.length ? face.colorIndicator : ['C']"
          :key="ci"
          class="inline-block cursor-help rounded-full border border-black/40"
          :style="{ width: '13px', height: '13px', background: c === 'C' ? COLORLESS : COLOR_MAP[c], boxShadow: '0 0 0 1.5px rgba(0,0,0,0.25)' }"
        />
      </span>
      <span>
        <template v-for="(seg, ti) in faceTypeLine[fi]" :key="ti">
          <span
            v-if="hasSegmentLink(seg)"
            class="cursor-help rounded underline decoration-dashed decoration-1 underline-offset-4 transition-colors"
            :class="[segColor(seg), isRowHighlighted(seg) ? 'bg-surface/60' : '']"
            @mouseenter="show(seg, $event)"
            @mouseleave="hide"
            >{{ seg.text }}</span
          >
          <template v-else>{{ seg.text }}</template>
        </template>
      </span>
    </div>
    <p
      v-for="(line, li) in faceLines[fi]"
      :key="li"
      class="max-w-2xl font-sans text-sm leading-relaxed whitespace-pre-wrap text-text/90"
      :class="li > 0 ? 'mt-2' : ''"
    >
      <template v-for="(seg, i) in line" :key="i">
        <span
          v-if="hasSegmentLink(seg)"
          class="cursor-help rounded underline decoration-dashed decoration-1 underline-offset-4 transition-colors"
          :class="[segColor(seg), isRowHighlighted(seg) ? 'bg-surface/60' : '']"
          @mouseenter="show(seg, $event)"
          @mouseleave="hide"
          ><template v-for="(ms, mi) in parseManaSegments(seg.text)" :key="mi"
            ><span v-if="'mana' in ms" class="text-[1em]"><ManaSymbol :code="ms.mana" /></span><template v-else>{{ ms.text }}</template></template
          ></span
        >
        <template v-else
          ><template v-for="(ms, mi) in parseManaSegments(seg.text)" :key="mi"
            ><span v-if="'mana' in ms" class="text-[1em]"><ManaSymbol :code="ms.mana" /></span><template v-else>{{ ms.text }}</template></template
          ></template
        >
      </template>
    </p>
    <div v-if="face.power !== undefined && face.toughness !== undefined" class="mt-2 font-sans text-sm font-semibold text-text/90">
      {{ face.power }}/{{ face.toughness }}
    </div>
  </template>
  <Teleport to="body">
    <div
      ref="tooltipEl"
      class="fixed z-20 max-w-sm overflow-y-auto rounded-lg border border-border bg-panel p-2 font-sans transition-opacity duration-75"
      :class="{ 'pointer-events-none opacity-0': !hovered }"
      :style="{ left: `${tipX}px`, top: `${tipY}px`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }"
    >
      <div v-if="hovered" class="flex flex-col gap-1.5">
        <div v-for="(f, fi) in hovered.facts" :key="`f${fi}`" class="flex items-center gap-2 text-xs">
          <Icon
            :name="f.role === 'source' ? 'lucide:log-out' : 'lucide:log-in'"
            :class="f.role === 'source' ? 'text-blue-400' : 'text-emerald-500'"
            class="h-3.5 w-3.5 shrink-0"
            :title="f.role === 'source' ? 'Source — this card provides this' : 'Sink — this card wants this'"
          />
          <span class="text-text first-letter:uppercase">{{ describeFact(f) }}</span>
        </div>
        <!-- Non-Fact span entries (2026-09-16) — same row shape, a distinct
             (non-role) icon + the same short kind label the Facts tab's own
             row shows, never `describeFact`/the span's own `note` text. -->
        <div v-for="(row, si) in hovered.spans" :key="`s${si}`" class="flex items-center gap-2 text-xs">
          <Icon
            name="lucide:file-text"
            class="h-3.5 w-3.5 shrink-0 text-slate-400"
            title="Not a Fact — a real oracle-text span with no synergy Fact of its own"
          />
          <span class="text-text">{{ NON_FACT_SPAN_KIND_LABEL[row.span.kind] }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
