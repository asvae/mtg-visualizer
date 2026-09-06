<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { computePosition, offset, flip, shift, size } from '@floating-ui/dom';
import { parseManaSegments } from '../lib/manaSegments';
import { DFC_FACE_BREAK, COLOR_INDICATOR_MARKER } from '../lib/cardTextMarkers';
import { COLOR_MAP, COLORLESS, COLOR_LABEL } from '../lib/constants';
import type { AnnotatedFactRef } from '../../functional-model/synergy';

// `highlightKey` — set by the parent card page while a Functional model
// table row is hovered, to `factKey()` of that row's own fact (see the card
// page's own `factKey` — same shape, kept in sync by convention rather than
// a shared import since the table works off raw `Fact` objects and this
// component only ever sees the narrower `AnnotatedFactRef`). `null`/unset =
// nothing hovered, no segment highlighted.
const props = defineProps<{ text: string; facts: AnnotatedFactRef[][]; highlightKey?: string | null }>();
// Lets the parent (the card page) mirror this panel's own hover into the
// Facts table row / Interactions row sharing the same fact — the three-way
// sync `highlightKey` above drives is bidirectional: this component receives
// a highlight from elsewhere via the prop, and reports its own hover back up
// via this emit so the other two panels can highlight in turn.
const emit = defineEmits<{ hover: [key: string | null] }>();

interface RenderSegment {
  text: string;
  facts?: AnnotatedFactRef[];
  /** Real Scryfall "Color Indicator" — a real color-letter list (colorIndicatorMarker's own output, cardTextMarkers.ts), rendered as circular swatches instead of text. Empty array = a genuinely colorless indicator. */
  colorIndicator?: string[];
}

// Prefers the fact's own author-assigned `id` (stable, unambiguous) — falls
// back to role+sourceText+description for a fact that predates `id`.
function factKey(f: AnnotatedFactRef): string {
  return f.id ?? `${f.role}::${f.sourceText}::${f.description}`;
}
function isRowHighlighted(seg: RenderSegment): boolean {
  return !!props.highlightKey && !!seg.facts?.some((f) => factKey(f) === props.highlightKey);
}

// Decodes the `[phrase](N)` markers `annotateCardText` wrote into `text` —
// structural splitting only, same as `parseManaSegments`'s own `{X}` split
// below; WHICH phrase belongs to which fact was already decided server-side,
// this just reads the answer back out.
const MARKER = /\[([^[\]]*)\]\((\d+)\)/g;
function factSegmentsOf(text: string, result: RenderSegment[]): void {
  let cursor = 0;
  for (const m of text.matchAll(MARKER)) {
    if (m.index > cursor) result.push({ text: text.slice(cursor, m.index) });
    result.push({ text: m[1]!, facts: props.facts[Number(m[2])] });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor) });
}
// A color-indicator marker is structural (never carries a fact), so it's
// split out first — whatever's left between/around it still goes through
// the normal fact-marker pass above.
function segmentsOf(block: string): RenderSegment[] {
  const result: RenderSegment[] = [];
  let cursor = 0;
  for (const m of block.matchAll(COLOR_INDICATOR_MARKER)) {
    if (m.index > cursor) factSegmentsOf(block.slice(cursor, m.index), result);
    result.push({ text: '', colorIndicator: m[1] ? m[1].split(',') : [] });
    cursor = m.index + m[0].length;
  }
  if (cursor < block.length) factSegmentsOf(block.slice(cursor), result);
  return result;
}

// A DFC's `cardText` (server/api/card/[set]/[number].ts) carries one real
// divider between its two per-face blocks (see cardTextMarkers.ts's own
// doc comment) — split on it so each face renders in its own paragraph with
// a REAL divider element between them, rather than a literal "------" run
// of dashes sitting inline in the text. A single-faced card's `text` has no
// marker at all, so this is just one block, same as before.
const blocks = computed<RenderSegment[][]>(() => props.text.split(DFC_FACE_BREAK).map((block) => segmentsOf(block.replace(/^\n+|\n+$/g, ''))));

// Blue underline when the phrase is a source, green when it's a sink —
// a segment carrying both (rare: two facts sharing one anchor phrase) reads
// as source, since that's the rarer/stronger claim to flag. Low opacity —
// this is a hint that the phrase is clickable, not a highlight to compete
// with the text itself.
function segColor(seg: RenderSegment): string {
  return seg.facts?.some((f) => f.role === 'source') ? 'decoration-blue-400/65' : 'decoration-emerald-500/65';
}

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
const hovered = ref<RenderSegment | null>(null);
const tooltipEl = ref<HTMLElement | null>(null);
const tipX = ref(0);
const tipY = ref(0);
let positionRequestId = 0;

async function show(seg: RenderSegment, e: MouseEvent) {
  hovered.value = seg;
  // Only the first fact behind this phrase drives the cross-panel highlight
  // — a segment with more than one fact is rare (see the tooltip's own
  // multi-fact rendering below), and the table/interactions side has no
  // notion of "this row is one of several" to match against anyway.
  emit('hover', seg.facts?.[0] ? factKey(seg.facts[0]) : null);
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
</script>

<template>
  <template v-for="(block, bi) in blocks" :key="bi">
    <!-- A DFC's own real divider between faces (see cardTextMarkers.ts) — a
         genuine element, not a literal "------" run of dashes in the text. -->
    <hr v-if="bi > 0" class="my-3 max-w-2xl border-border-subtle" />
    <p class="max-w-2xl font-sans text-sm leading-relaxed whitespace-pre-wrap text-text/90">
      <template v-for="(seg, i) in block" :key="i">
        <span
          v-if="seg.colorIndicator"
          class="mr-1 inline-flex translate-y-0.5 gap-0.5 align-middle"
          :title="`Color Indicator: ${seg.colorIndicator.length ? seg.colorIndicator.map((c) => COLOR_LABEL[c] ?? c).join(', ') : 'Colorless'}`"
        >
          <span
            v-for="(c, ci) in seg.colorIndicator.length ? seg.colorIndicator : ['C']"
            :key="ci"
            class="inline-block cursor-help rounded-full border border-black/40"
            :style="{ width: '13px', height: '13px', background: c === 'C' ? COLORLESS : COLOR_MAP[c], boxShadow: '0 0 0 1.5px rgba(0,0,0,0.25)' }"
          />
        </span>
        <span
          v-else-if="seg.facts?.length"
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
  </template>
  <Teleport to="body">
    <div
      ref="tooltipEl"
      class="fixed z-20 max-w-sm overflow-y-auto rounded-lg border border-border bg-panel p-2 font-sans transition-opacity duration-75"
      :class="{ 'pointer-events-none opacity-0': !hovered }"
      :style="{ left: `${tipX}px`, top: `${tipY}px`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }"
    >
      <div v-if="hovered" class="flex flex-col gap-1.5">
        <div v-for="(f, fi) in hovered.facts" :key="fi" class="flex items-center gap-2 text-xs">
          <Icon
            :name="f.role === 'source' ? 'lucide:log-out' : 'lucide:log-in'"
            :class="f.role === 'source' ? 'text-blue-400' : 'text-emerald-500'"
            class="h-3.5 w-3.5 shrink-0"
            :title="f.role === 'source' ? 'Source — this card provides this' : 'Sink — this card wants this'"
          />
          <span class="text-text first-letter:uppercase">{{ f.description }}</span>
          <ValueBar class="ml-auto shrink-0" :value="f.value" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
