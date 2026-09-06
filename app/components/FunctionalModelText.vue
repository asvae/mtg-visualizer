<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { computePosition, offset, flip, shift, size } from '@floating-ui/dom';
import { parseManaSegments } from '../lib/manaSegments';
import { COLOR_MAP, COLORLESS, COLOR_LABEL } from '../lib/constants';
import type { AnnotatedSegment, AnnotatedFactRef } from '../../functional-model/synergy';
import type { AnnotatedCard } from '../types';

// `highlightKey` — set by the parent card page while a Functional model
// table row is hovered, to `factKey()` of that row's own fact (see the card
// page's own `factKey` — same shape, kept in sync by convention rather than
// a shared import since the table works off raw `Fact` objects and this
// component only ever sees the narrower `AnnotatedFactRef`). `null`/unset =
// nothing hovered, no segment highlighted.
const props = defineProps<{ card: AnnotatedCard; highlightKey?: string | null }>();
// Lets the parent (the card page) mirror this panel's own hover into the
// Facts table row / Interactions row sharing the same fact — the three-way
// sync `highlightKey` above drives is bidirectional: this component receives
// a highlight from elsewhere via the prop, and reports its own hover back up
// via this emit so the other two panels can highlight in turn.
const emit = defineEmits<{ hover: [key: string | null] }>();

// Prefers the fact's own author-assigned `id` (stable, unambiguous) — falls
// back to role+sourceText+description for a fact that predates `id`.
function factKey(f: AnnotatedFactRef): string {
  return f.id ?? `${f.role}::${f.sourceText}::${f.description}`;
}
function isRowHighlighted(seg: AnnotatedSegment): boolean {
  return !!props.highlightKey && !!seg.facts?.some((f) => factKey(f) === props.highlightKey);
}

// Blue underline when the phrase is a source, green when it's a sink —
// a segment carrying both (rare: two facts sharing one anchor phrase) reads
// as source, since that's the rarer/stronger claim to flag. Low opacity —
// this is a hint that the phrase is clickable, not a highlight to compete
// with the text itself.
function segColor(seg: AnnotatedSegment): string {
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
const hovered = ref<AnnotatedSegment | null>(null);
const tooltipEl = ref<HTMLElement | null>(null);
const tipX = ref(0);
const tipY = ref(0);
let positionRequestId = 0;

async function show(seg: AnnotatedSegment, e: MouseEvent) {
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
  <template v-for="(face, fi) in card.faces" :key="fi">
    <!-- A DFC's own real divider between faces (scryfall.com/card/<set>/<number>'s
         own two-part layout) — a genuine element, not a literal "------" run
         of dashes in the text. A single-faced card has just one face, no
         divider at all. -->
    <hr v-if="fi > 0" class="my-3 max-w-2xl border-border-subtle" />
    <div class="mb-1 flex max-w-2xl items-baseline justify-between gap-3 font-sans text-sm font-semibold text-text">
      <span>{{ face.name }}</span>
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
      <span>{{ face.typeLine }}</span>
    </div>
    <p
      v-for="(line, li) in face.oracleLines"
      :key="li"
      class="max-w-2xl font-sans text-sm leading-relaxed whitespace-pre-wrap text-text/90"
      :class="li > 0 ? 'mt-2' : ''"
    >
      <template v-for="(seg, i) in line" :key="i">
        <span
          v-if="seg.facts?.length"
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
    <div v-if="face.power !== undefined && face.toughness !== undefined" class="mt-2 max-w-2xl text-right font-sans text-sm font-semibold text-text/90">
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
