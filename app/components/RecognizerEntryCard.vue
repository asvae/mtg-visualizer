<script setup lang="ts">
// Content renderer for ONE recognizers/index.vue catalog entry — mirrors
// KeywordEntryCard.vue's own shape/responsibilities (same
// ReviewStatusBadge/confirm-button wiring, same "page owns the fetched
// array, this component just emits `reviewed` up" split) but for a
// recognizer (functional-model/recognizers/) instead of a keyword/mechanic
// registry entry. No collapse/open state of its own — recognizers/
// [[slug]].vue's sidebar drives which single entry ever renders (only one
// mounted at a time, remounted fresh via `:key="entry.id"` on every
// selection change).
//
// Two things this component owns that KeywordEntryCard.vue doesn't need:
// (1) fetching this recognizer's own real TypeScript source
// (`GET /api/recognizer-source/:rule`, the SAME route/component
// (FunctionalModelScript.vue) the per-card page's own provenance-popover
// modal already uses — reused directly here, inline rather than in a
// modal, since source code IS this page's main content, not an aside) —
// fetched fresh on every mount (component remounts per selection, so no
// separate watcher is needed); (2) the matched-cards list, this page's own
// actual point — every real card currently carrying a fact this recognizer
// produced, each linking to its real `/app/engine/cards/<set>/<number>` page
// when that route is resolvable (see server/api/recognizers/index.get.ts's
// own header comment on the ~20 non-FIN reference cards that aren't).
import { ref, computed, onMounted } from 'vue';
import type { RecognizerPageEntry } from '../../server/api/recognizers/index.get';
import type { ReviewStatus } from '../types';

const props = defineProps<{ entry: RecognizerPageEntry }>();
const emit = defineEmits<{ reviewed: [status: ReviewStatus] }>();

// Default UNCHECKED (type-derived matches hidden) — these are the "every
// Saga gets the same 3 CR-714 facts purely by being a Saga" busywork rows
// (see server/api/recognizers/index.get.ts's own `typeDerived` doc comment);
// reviewing each one individually is repetitive, so they start out of the
// way. `matchedCards` itself is unaffected — this only gates what
// `visibleMatchedCards` (below) renders; the header's own "Matched cards
// (N)" count stays the TOTAL, unfiltered count per this feature's own spec.
const showTypeDerived = ref(false);
const typeDerivedMatchedCards = computed(() => props.entry.matchedCards.filter((c) => c.typeDerived));
const visibleMatchedCards = computed(() =>
  showTypeDerived.value ? props.entry.matchedCards : props.entry.matchedCards.filter((c) => !c.typeDerived),
);

const sourceCode = ref('');
const sourceLoading = ref(true);
const sourceError = ref('');

onMounted(async () => {
  sourceLoading.value = true;
  sourceError.value = '';
  try {
    const res = await $fetch<{ rule: string; content: string }>(`/api/recognizer-source/${props.entry.id}`);
    sourceCode.value = res.content;
  } catch (err) {
    sourceError.value = `Could not load recognizer source: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    sourceLoading.value = false;
  }
});

const pendingReview = ref(false);
async function confirmReview() {
  if (pendingReview.value) return;
  // Same component drives both directions (see ReviewStatusBadge's own
  // "Mark as reviewed" / "Mark as draft" label swap) — request whichever
  // state ISN'T current.
  const reviewed = props.entry.status !== 'human_reviewed';
  pendingReview.value = true;
  try {
    const res = await fetch('/api/recognizers/review-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: props.entry.id, reviewed }),
    });
    if (res.ok) {
      const body = await res.json();
      emit('reviewed', body.reviewStatus);
    }
  } finally {
    pendingReview.value = false;
  }
}
</script>

<template>
  <div class="rounded-lg border border-border-subtle bg-panel">
    <div class="flex w-full items-center gap-2.5 px-4 py-3 text-left">
      <span class="text-sm font-medium text-text">{{ entry.title }}</span>
      <span class="font-mono text-[10px] text-muted/70">{{ entry.id }}</span>
      <span class="ml-auto rounded bg-bg px-1.5 py-0.5 text-[10px] font-medium text-muted">
        {{ entry.matchCount }} {{ entry.matchCount === 1 ? 'card' : 'cards' }}
      </span>
    </div>

    <div class="border-t border-border-subtle px-4 py-3">
      <ReviewStatusBadge
        class="mb-3"
        :status="entry.status"
        :badge="entry.status === 'ai_reviewed'"
        :pending="pendingReview"
        reviewed-note="Reviewed — this recognizer's rule has been checked against its matched cards."
        @confirm="confirmReview"
      />

      <p class="mb-4 text-xs leading-relaxed text-muted">{{ entry.description }}</p>

      <div class="mb-4">
        <div class="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Source</div>
        <div v-if="sourceLoading" class="text-xs text-muted italic">Loading source…</div>
        <div v-else-if="sourceError" class="text-xs text-error">{{ sourceError }}</div>
        <FunctionalModelScript v-else :code="sourceCode" />
      </div>

      <div>
        <div class="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
          Matched cards ({{ entry.matchCount }})
        </div>

        <!-- Only rendered when this recognizer actually has any type-derived
             matches (today, only saga-lore-and-sacrifice-structural — see
             index.get.ts's own TYPE_DERIVED_RECOGNIZER_IDS comment) — every
             other recognizer's page has nothing to hide, so no dead "(0)"
             checkbox clutters it. -->
        <UCheckbox
          v-if="typeDerivedMatchedCards.length"
          v-model="showTypeDerived"
          class="mb-2 w-full py-1"
          :ui="{ label: 'flex w-full items-center gap-1.5 text-xs' }"
        >
          <template #label>
            <span class="truncate">Show type-derived facts ({{ typeDerivedMatchedCards.length }})</span>
          </template>
        </UCheckbox>

        <p v-if="!entry.matchedCards.length" class="text-xs text-muted italic">No card currently carries a fact from this recognizer.</p>
        <p v-else-if="!visibleMatchedCards.length" class="text-xs text-muted italic">
          Every match here is type-derived — check "Show type-derived facts" above to see them.
        </p>
        <ul v-else class="flex flex-wrap gap-1.5">
          <li v-for="card in visibleMatchedCards" :key="card.slug">
            <NuxtLink
              v-if="card.set && card.collectorNumber"
              :to="`/app/engine/cards/${card.set}/${card.collectorNumber}`"
              class="rounded border border-border-subtle bg-bg px-2 py-1 text-xs text-text hover:border-border hover:bg-surface"
            >
              {{ card.name }}
            </NuxtLink>
            <span v-else class="rounded border border-border-subtle bg-bg px-2 py-1 text-xs text-muted italic" :title="'Not in the default FIN corpus — no card page to link to'">
              {{ card.name }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
