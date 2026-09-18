<script setup lang="ts">
// FDN's own plain (un-annotated) counterpart to `FunctionalModelText.vue` —
// renders the same visual chrome that component builds per face (name
// heading, mana cost as real `<ManaSymbol>` icons, type line, oracle-text
// body with inline mana icons too, power/toughness line) but with ZERO of
// that component's Fact/annotation/highlighting machinery: no
// facts/nonFactSpans/highlightKeys props, no hover/tooltip, no underline-on-
// linked-phrase logic, no `AnnotatedCard`/multi-face-loop machinery. FDN has
// no synergy.json/Fact.annotations at all by design (see
// `.claude/contracts/card-schema.md`), so there is nothing to link or click
// here, ever, and this is NOT meant to grow into a second annotation system.
//
// FDN's pool is confirmed single-faced only (`layout: 'normal'`, no DFC/
// split/adventure) — this never loops over more than one face, unlike
// `FunctionalModelText.vue`.
//
// Props are the plain (non-annotated) `CardData` fields CardDetailTabs.vue
// already has as `data.card` — NOT `AnnotatedCard`/`AnnotatedFace`, which
// only exists for `fin`. `CardData` has no `colorIndicator` field at all
// (that's an `AnnotatedFace`-only field, real Scryfall "Color Indicator" is
// rare and FDN's pool has no case of it today) — the color-indicator swatch
// row `FunctionalModelText.vue` renders is genuinely omitted here rather
// than faked. `oracleText` is `data.functionalModel.oracleText` — one or
// more real, printed Scryfall `oracle_text` paragraphs already joined
// server-side with real `\n`s; `whitespace-pre-wrap` on the single `<p>`
// reproduces every line break with no client-side splitting needed, same as
// this component's previous bare-`<p>` version. Empty/falsy `oracleText`
// (a vanilla creature with no rules text) renders no `<p>` at all — the name/
// mana-cost/type-line/P-T header above it still renders regardless.
import { ref } from 'vue';
import { parseManaSegments } from '../lib/manaSegments';

defineProps<{
  name: string;
  manaCost: string | null;
  typeLine: string;
  power?: string;
  toughness?: string;
  oracleText: string | null;
}>();

// Collapse/expand toggle: "long" (default) is the full header chrome below
// (name/mana-cost/type-line/oracle-text/P-T) — "short" strips everything
// down to just the oracle-text paragraph, still with its own inline
// `parseManaSegments`/`ManaSymbol` rendering intact. Component-local only,
// deliberately not persisted (localStorage etc.) — resets to "long" on
// remount/navigating to a different card, per the task's own default-to-
// simple guidance. The toggle button's label is the OPPOSITE of the
// current state (what clicking it will DO), so "Shorter" while long and
// "Longer" while short.
const short = ref(false);
</script>

<template>
  <div class="group relative max-w-2xl pr-8">
    <UButton
      :icon="short ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
      color="neutral"
      variant="ghost"
      size="xs"
      class="absolute top-0 right-0 z-10 opacity-0 transition-opacity group-hover:opacity-100"
      :aria-label="short ? 'Show full card text' : 'Show short card text'"
      @click="short = !short"
    >
      {{ short ? 'Longer' : 'Shorter' }}
    </UButton>

    <template v-if="!short">
      <div class="mb-1 flex items-baseline gap-2 font-sans text-sm font-semibold text-text">
        <span>{{ name }}</span>
        <span v-if="manaCost" class="flex shrink-0 items-center gap-0.5 text-text/80">
          <template v-for="(ms, mi) in parseManaSegments(manaCost)" :key="mi">
            <ManaSymbol v-if="'mana' in ms" :code="ms.mana" />
            <template v-else>{{ ms.text }}</template>
          </template>
        </span>
      </div>
      <div class="mb-2 font-sans text-sm text-text/80">{{ typeLine }}</div>
    </template>

    <p v-if="oracleText" class="font-sans text-sm leading-relaxed whitespace-pre-wrap text-text/90">
      <template v-for="(ms, mi) in parseManaSegments(oracleText)" :key="mi">
        <span v-if="'mana' in ms" class="text-[1em]"><ManaSymbol :code="ms.mana" /></span>
        <template v-else>{{ ms.text }}</template>
      </template>
    </p>

    <div v-if="!short && power !== undefined && toughness !== undefined" class="mt-2 font-sans text-sm font-semibold text-text/90">{{ power }}/{{ toughness }}</div>
  </div>
</template>
