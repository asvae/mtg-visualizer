<script setup lang="ts">
// Sink-derivation-predicate status — one of the four `/app/engine/*`
// console tabs (see EngineConsoleTabs.vue's own header for the tab list
// and what got left out). Was the standalone `/app/sink-derivations` page;
// this route replaces it (that old route is removed as part of this same
// consolidation — see AppHeader.vue's updated nav link). Same underlying
// data/endpoint (`GET /api/sink-derivations` + its own `./review` sibling)
// and the exact same review/reject-with-note/clear-review capability that
// page had — only the shell (search/filter/list/detail chrome) moved onto
// the shared `useStatusFilterList`/`EngineConsoleShell`/
// `StatusFilterControls`/`EntryListPanel` pieces, per this task's own
// "collapse the duplicated shell" ask.
//
// 2026-09-17 addendum: this axis only ever has a handful of entries (4 as
// of this writing) — the shell's visible position-label + chevron-button
// row isn't useful real estate here, so this page alone passes `hide-nav`
// to hide JUST that visible affordance (Features/Sets/Keywords keep it).
// Arrow-key prev/next (`EngineConsoleShell.vue`'s own keydown listener)
// still works here regardless — `hide-nav` only suppresses the buttons.
import { computed, ref } from 'vue';
import { useStatusFilterList } from '../../../../composables/useStatusFilterList';
import type { StatusFilterOption } from '../../../../composables/useStatusFilterList';
import type { SinkDerivationPageEntry } from '../../../../../server/api/sink-derivations/index.get';

definePageMeta({ layout: 'graph' });
useHead({ title: 'Sink-derivation predicate status' });

const { data, pending, error } = useFetch<SinkDerivationPageEntry[]>('/api/sink-derivations');
const toast = useToast();

// `import.meta.dev` can't be used directly inside a template expression
// (the Vue SFC compiler chokes parsing it mid attribute-value JS
// expression) — same local-const workaround the original page used.
const isDev = import.meta.dev;

type StatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green';
const STATUS_OPTIONS: StatusFilterOption<StatusColor>[] = [
  { value: 'gray', label: 'No predicate yet', color: '#6b7280', description: 'No predicate module built yet for this mechanism.' },
  {
    value: 'purple',
    label: 'Unverified',
    color: '#a855f7',
    description: 'A predicate module exists, but not yet verified against a real scenario corpus (no manifest, or not every scenario in it agrees with real trace evidence yet).',
  },
  {
    value: 'blue',
    label: 'Verified',
    color: '#3b82f6',
    description: 'Verified: a predicate module exists AND its corpus-verification manifest shows every scenario agreeing with real trace evidence.',
  },
  { value: 'yellow', label: 'Rejected', color: '#eab308', description: 'Human-reviewed and REJECTED — a reviewer found a real disagreement with the computed baseline; see its own note.' },
  { value: 'green', label: 'Confirmed', color: '#22c55e', description: 'Human-reviewed and CONFIRMED.' },
];

const items = computed(() => data.value ?? []);
const list = useStatusFilterList<SinkDerivationPageEntry, StatusColor>({
  items,
  keyOf: (e) => e.key,
  statusOf: (e) => e.color,
  statusOptions: STATUS_OPTIONS,
  matchesQuery: (e, q) => e.label.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q),
  // Alphabetical by label — this axis's `key`/`slug` IS the stable
  // identity itself (unlike engine-status' gap-<N>-<slug> keys), so sorting
  // on the label directly doesn't risk row-order churn from a future
  // rewording.
  sortBy: (a, b) => a.label.localeCompare(b.label),
  storageKey: 'engine-console-filters-predicates',
});

// Top-level alias so the template can write plain `selectedEntry` (Vue
// auto-unwraps a TOP-LEVEL ref/computed reference in a template, but NOT a
// nested property access like `list.selected.value` — this avoids needing
// a `!` non-null assertion sprinkled through the template, which isn't
// safe to assume works inside a template expression the way it does in
// `<script>`).
const selectedEntry = computed(() => list.selected.value);
function statusMeta(color: StatusColor) {
  return STATUS_OPTIONS.find((o) => o.value === color)!;
}

// Per-row in-flight guard, same convention the original page used.
const pendingKey = ref<string | null>(null);

const rejectOpen = ref(false);
const rejectTarget = ref<SinkDerivationPageEntry | null>(null);
const rejectNote = ref('');
function openReject(entry: SinkDerivationPageEntry) {
  rejectTarget.value = entry;
  rejectNote.value = entry.review?.verdict === 'reject' ? (entry.review.note ?? '') : '';
  rejectOpen.value = true;
}

async function submitReview(entry: SinkDerivationPageEntry, verdict: 'confirm' | 'reject' | null, note?: string) {
  pendingKey.value = entry.key;
  try {
    const res = await $fetch<{ key: string; color: 'yellow' | 'green' | null }>('/api/sink-derivations/review', {
      method: 'POST',
      body: { key: entry.key, verdict, note },
    });
    if (verdict === null) {
      entry.review = undefined;
      entry.color = entry.baseline;
    } else {
      entry.review = { verdict, note: note?.trim() || undefined, reviewedAt: new Date().toISOString().slice(0, 10) };
      entry.color = res.color ?? entry.color;
    }
  } catch (e: any) {
    toast.add({
      title: 'Review not saved',
      description: e?.data?.error ?? e?.message ?? 'Request failed.',
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    });
  } finally {
    pendingKey.value = null;
  }
}

function confirmEntry(entry: SinkDerivationPageEntry) {
  submitReview(entry, 'confirm');
}
function clearReview(entry: SinkDerivationPageEntry) {
  submitReview(entry, null);
}
async function submitReject() {
  if (!rejectTarget.value || !rejectNote.value.trim()) return;
  await submitReview(rejectTarget.value, 'reject', rejectNote.value);
  rejectOpen.value = false;
}
</script>

<template>
  <EngineConsoleShell
    :pending="pending"
    :error="error"
    :can-prev="list.canPrev.value"
    :can-next="list.canNext.value"
    :position-label="list.positionLabel.value"
    hide-nav
    @prev="list.selectPrev"
    @next="list.selectNext"
  >
    <template #nav>
      <h1 class="mb-1 px-1.5 text-sm font-semibold text-text">Sink-derivation predicate status</h1>
      <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
        One row per hand-tracked mechanism whose gameplay consequences are emergent from generic engine automation
        rather than visible via effect-walking at all — a different axis from
        <NuxtLink to="/app/engine/features" class="text-text underline">Feature status</NuxtLink>.
      </p>
      <p v-if="!isDev" class="mb-3 px-1.5 text-[11px] text-muted italic">Review actions are dev-only here.</p>

      <EngineConsoleStatusFilterControls
        :search-query="list.searchQuery.value"
        search-placeholder="Search mechanisms…"
        :status-options="STATUS_OPTIONS"
        :active-filters="list.activeFilters.value"
        :counts="list.countsByStatus.value"
        :visible-count="list.visible.value.length"
        :total-count="items.length"
        @update:search-query="(v: string) => (list.searchQuery.value = v)"
        @toggle="list.toggleFilter"
      >
        <template #help>
          <EngineConsoleStatusHelp :status-options="STATUS_OPTIONS">
            <p>
              Computed baseline (automatic, off what's on disk): <b class="text-text">No predicate yet</b> →
              <b class="text-text">Unverified</b> once a predicate module is written, but there's no scenario-corpus
              manifest yet (or the manifest doesn't yet show every scenario passing) → <b class="text-text">Verified</b>
              once the manifest shows every corpus scenario agreeing with real trace evidence.
            </p>
            <p>
              <b class="text-text">Rejected</b>/<b class="text-text">Confirmed</b> are a separate human-review layer on
              top of whichever of those three is current — a reviewer can confirm (green) or reject with a required note
              (yellow) at any point, independent of the underlying computed color.
            </p>
          </EngineConsoleStatusHelp>
        </template>
      </EngineConsoleStatusFilterControls>

      <EngineConsoleEntryListPanel
        :entries="list.visible.value"
        :key-of="(e: SinkDerivationPageEntry) => e.key"
        :selected-key="list.selectedKey.value"
        empty-message="No mechanisms match the current search/filters."
        @select="list.select"
      >
        <template #row="{ entry }">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: statusMeta(entry.color).color }" />
          <span class="truncate">{{ entry.label }}</span>
        </template>
      </EngineConsoleEntryListPanel>
    </template>

    <template #detail>
      <div v-if="selectedEntry" class="rounded-md border border-border-subtle bg-panel p-3">
        <div class="flex items-start gap-2">
          <span
            class="mt-0.5 h-3 w-3 shrink-0 rounded-full"
            :style="{ background: statusMeta(selectedEntry.color).color }"
            :title="statusMeta(selectedEntry.color).label"
          ></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline gap-x-2">
              <span class="text-sm font-semibold text-text">{{ selectedEntry.label }}</span>
              <span class="text-[11px] text-muted">({{ selectedEntry.slug }})</span>
              <span
                v-if="selectedEntry.review"
                class="rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase"
              >
                baseline: {{ selectedEntry.baseline }}
              </span>
            </div>

            <div class="mt-1 flex flex-wrap gap-1.5 text-[10px]">
              <span
                class="rounded px-1.5 py-0.5"
                :class="selectedEntry.evidence.predicateModuleExists ? 'bg-produce/15 text-produce' : 'bg-consume/15 text-consume'"
              >
                {{ selectedEntry.evidence.predicateModuleExists ? 'Predicate module exists' : 'No predicate module yet' }}
              </span>
              <span
                v-if="selectedEntry.evidence.predicateModuleExists"
                class="rounded px-1.5 py-0.5"
                :class="selectedEntry.evidence.corpusManifestExists ? 'bg-produce/15 text-produce' : 'bg-magnifier/15 text-magnifier'"
              >
                {{ selectedEntry.evidence.corpusManifestExists ? 'Corpus manifest exists' : 'No corpus manifest yet' }}
              </span>
              <span v-if="selectedEntry.evidence.corpusManifestExists" class="rounded bg-surface px-1.5 py-0.5 font-mono text-text">
                {{ selectedEntry.evidence.corpusPassing }} / {{ selectedEntry.evidence.corpusTotal }} corpus scenarios passing
              </span>
              <span class="rounded bg-surface px-1.5 py-0.5 font-mono text-text">{{ selectedEntry.evidence.predicateModulePath }}</span>
            </div>

            <p class="mt-1.5 text-[11px] leading-relaxed text-muted italic">{{ selectedEntry.motivation }}</p>

            <div v-if="selectedEntry.expectedSinkShapes.length" class="mt-2">
              <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Expected sink-query shapes</div>
              <ul class="mt-1 flex flex-col gap-1">
                <li v-for="(shape, i) in selectedEntry.expectedSinkShapes" :key="i" class="text-[11px] leading-relaxed text-muted">
                  <code class="rounded bg-surface px-1 py-0.5 font-mono text-text">{{ shape.event }}</code>
                  — {{ shape.note }}
                </li>
              </ul>
            </div>

            <div v-if="selectedEntry.review" class="mt-2 rounded border border-border-subtle bg-surface/60 p-2 text-[11px]">
              <div class="font-semibold" :class="selectedEntry.review.verdict === 'confirm' ? 'text-produce' : 'text-warn'">
                Reviewed — {{ selectedEntry.review.verdict === 'confirm' ? 'confirmed' : 'rejected' }}
                <span v-if="selectedEntry.review.reviewedAt" class="font-normal text-muted">({{ selectedEntry.review.reviewedAt }})</span>
              </div>
              <p v-if="selectedEntry.review.note" class="mt-0.5 text-muted">{{ selectedEntry.review.note }}</p>
            </div>

            <div v-if="isDev" class="mt-2 flex items-center gap-2">
              <UButton
                size="xs"
                color="success"
                variant="subtle"
                :disabled="pendingKey === selectedEntry.key"
                :loading="pendingKey === selectedEntry.key"
                @click="confirmEntry(selectedEntry)"
              >
                Confirm
              </UButton>
              <UButton
                size="xs"
                color="warning"
                variant="subtle"
                :disabled="pendingKey === selectedEntry.key"
                @click="openReject(selectedEntry)"
              >
                Reject…
              </UButton>
              <UButton
                v-if="selectedEntry.review"
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="pendingKey === selectedEntry.key"
                @click="clearReview(selectedEntry)"
              >
                Clear review
              </UButton>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="text-xs text-muted italic">Pick a mechanism from the sidebar.</p>
    </template>
  </EngineConsoleShell>

  <UModal v-model:open="rejectOpen" title="Reject baseline">
    <template #body>
      <p class="mb-2 text-xs text-muted">
        <span class="font-semibold text-text">{{ rejectTarget?.label }}</span> — explain why the computed baseline
        is wrong. A note is required (that's the whole point of yellow).
      </p>
      <UTextarea v-model="rejectNote" class="w-full" :rows="4" placeholder="e.g. spot-checked against real Forge source, the predicate mishandles..." autofocus />
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="subtle" @click="close">Cancel</UButton>
        <UButton color="warning" :disabled="!rejectNote.trim() || pendingKey === rejectTarget?.key" :loading="pendingKey === rejectTarget?.key" @click="submitReject">
          Reject
        </UButton>
      </div>
    </template>
  </UModal>
</template>
