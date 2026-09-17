<script setup lang="ts">
// Sink-derivation-predicate status dashboard — one row per hand-tracked
// mechanism whose real gameplay consequences are emergent from generic
// engine automation (Saga, Stun counters, Finality counters, Crew) rather
// than visible via `CardDefinition` effect-walking at all (see
// server/api/sink-derivations/index.get.ts +
// .claude/contracts/sink-derivation-status-schema.md, owner: `engine`
// agent). A DIFFERENT axis from /app/engine-status's mechanic/vocabulary
// gap list and /app/status's per-card fact heatmap — this one tracks
// progress on a small, specific set of predicate functions not yet built
// for any of today's 4 seeded mechanisms (all `gray`, for real, not a
// stub). Same visual language/STATUS_META color set as /app/engine-status
// (gray/purple/blue/yellow/green) — reused verbatim, not reinvented — but
// a standalone page, not merged into that page, since the two index
// genuinely different things (ENGINE_GAPS.md's numbered list vs. this
// axis's own small `SINK_DERIVATION_MECHANISMS` array) with different row
// shapes (no gapNumber/title/excerpt/testFiles here; instead
// motivation/expectedSinkShapes/predicate-module+corpus-manifest evidence).
//
// REWORKED (2026-09-17) from a flat list into the SAME sidebar-nav +
// single-selected-detail layout /app/keywords/[[slug]].vue (and
// /app/engine-status, reworked in this same pass) use — search box +
// filterable list on the left, one entry's full detail on the right —
// overriding the earlier "flat list, small count" call for the same reason
// /app/engine-status's own note documents: layout consistency with
// /app/keywords now matters regardless of list size. No per-entry URL
// routing here either, same call as /app/engine-status's own rework note.
//
// `baseline` (gray/purple/blue, computed fresh off real filesystem presence
// every request) and `color` (baseline, or yellow/green once a human review
// overlay exists) are BOTH rendered — dot uses `color` (contract's own
// "render/filter on this" field), `baseline` chip stays visible whenever a
// review has overridden it, same convention as /app/engine-status.
import { computed, ref, watch } from 'vue';
import type { SinkDerivationPageEntry } from '../../../../server/api/sink-derivations/index.get';

definePageMeta({ layout: 'graph' });
useHead({ title: 'Sink-derivation predicate status' });

const { data, pending, error } = useFetch<SinkDerivationPageEntry[]>('/api/sink-derivations');
const toast = useToast();

// Same `isDev` local-const workaround /app/engine-status/index.vue's own
// comment documents — `import.meta.dev` can't be used directly inside a
// template expression (Vue SFC compiler chokes on `import.meta` mid
// attribute-value JS expression).
const isDev = import.meta.dev;

type StatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green';
// Exact same color mapping as /app/engine-status/index.vue's own
// STATUS_META — per this task's own instruction, not reinvented — only the
// per-color DESCRIPTION text differs since this axis's own gray/purple/blue
// mean something different (predicate-module + corpus-manifest presence,
// not an ENGINE_GAPS.md CLOSED marker).
const STATUS_META: Record<StatusColor, { color: string; label: string; description: string }> = {
  gray: { color: '#6b7280', label: 'Gray', description: 'No predicate module built yet for this mechanism.' },
  purple: {
    color: '#a855f7',
    label: 'Purple',
    description: 'A predicate module exists, but not yet verified against a real scenario corpus (no manifest, or not every scenario in it agrees with real trace evidence yet).',
  },
  blue: {
    color: '#3b82f6',
    label: 'Blue',
    description: 'Verified: a predicate module exists AND its corpus-verification manifest shows every scenario agreeing with real trace evidence.',
  },
  yellow: { color: '#eab308', label: 'Yellow', description: 'Human-reviewed and REJECTED — a reviewer found a real disagreement with the computed baseline; see its own note.' },
  green: { color: '#22c55e', label: 'Green', description: 'Human-reviewed and CONFIRMED.' },
};
const STATUS_ORDER: StatusColor[] = ['gray', 'purple', 'blue', 'yellow', 'green'];

// Sorted alphabetically by label — unlike /app/engine-status's gapNumber,
// this axis's `key`/`slug` IS the stable identity itself (contract's own
// "unlike engine-status's gap-<N>-<slug> keys... this axis's slug values
// ARE the stable identity" note), so sorting on the label directly doesn't
// risk row-order churn from a future rewording the way sorting an
// unstable title would.
const sortedEntries = computed(() => [...(data.value ?? [])].sort((a, b) => a.label.localeCompare(b.label)));

// Sidebar search — matches label or slug, same substring convention as
// /app/keywords' own `matchesQuery`.
const searchQuery = ref('');
const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());
function matchesQuery(entry: SinkDerivationPageEntry): boolean {
  if (!normalizedQuery.value) return true;
  return (
    entry.label.toLowerCase().includes(normalizedQuery.value) ||
    entry.slug.toLowerCase().includes(normalizedQuery.value)
  );
}

// Show/hide-by-color filter, same convenience as /app/engine-status — all
// on by default, relocated into the sidebar.
const activeFilters = ref<Set<StatusColor>>(new Set(STATUS_ORDER));
function toggleFilter(c: StatusColor) {
  const next = new Set(activeFilters.value);
  if (next.has(c)) next.delete(c);
  else next.add(c);
  activeFilters.value = next;
}

const visibleEntries = computed(() =>
  sortedEntries.value.filter((e) => activeFilters.value.has(e.color) && matchesQuery(e)),
);

// Single-selection state, mirrors /app/keywords' own `selectedEntry`
// pattern (defaults to the first loaded/visible entry, never left
// unselected once data has arrived).
const selectedKey = ref<string | null>(null);
watch(
  visibleEntries,
  (entries) => {
    if (!entries.length) {
      selectedKey.value = null;
      return;
    }
    if (!selectedKey.value || !entries.some((e) => e.key === selectedKey.value)) {
      selectedKey.value = entries[0]!.key;
    }
  },
  { immediate: true },
);
const selectedEntry = computed(() => sortedEntries.value.find((e) => e.key === selectedKey.value) ?? null);

// Per-row in-flight guard — same convention as /app/engine-status/index.vue.
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
    // Optimistic in-place mutation (same convention as /app/engine-status's
    // own submitReview) rather than refetching the whole list.
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
  <div class="relative flex min-h-0 flex-1">
    <div v-if="pending" class="p-6 text-xs text-muted italic">Loading…</div>
    <div v-else-if="error" class="p-6 text-xs text-error">Failed to load: {{ error.message }}</div>

    <template v-else>
      <nav class="flex w-[240px] min-w-[240px] flex-col overflow-y-auto border-r border-border-subtle bg-panel p-2.5">
        <h1 class="mb-1 px-1.5 text-sm font-semibold text-text">Sink-derivation predicate status</h1>
        <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
          One row per hand-tracked mechanism whose gameplay consequences are emergent from generic engine automation
          rather than visible via effect-walking at all — a different axis from
          <NuxtLink to="/app/engine-status" class="text-text underline">Engine capability status</NuxtLink>.
        </p>
        <p v-if="!isDev" class="mb-3 px-1.5 text-[11px] text-muted italic">Review actions are dev-only here.</p>

        <UInput
          v-model="searchQuery"
          class="mb-3"
          placeholder="Search mechanisms…"
          icon="i-lucide-search"
          autocomplete="off"
          size="sm"
        >
          <template v-if="searchQuery" #trailing>
            <UButton icon="i-lucide-x" color="neutral" variant="link" size="xs" aria-label="Clear search" @click="searchQuery = ''" />
          </template>
        </UInput>

        <div class="mb-3 flex flex-col gap-0.5">
          <div class="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">Filter by status</div>
          <button
            v-for="c in STATUS_ORDER"
            :key="c"
            type="button"
            class="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left"
            :class="activeFilters.has(c) ? 'text-text' : 'text-muted opacity-40'"
            :title="STATUS_META[c].description"
            @click="toggleFilter(c)"
          >
            <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: STATUS_META[c].color }"></span>
            <span class="truncate text-[11px]">{{ STATUS_META[c].label }}</span>
          </button>
        </div>

        <div class="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
          {{ visibleEntries.length }} of {{ data?.length ?? 0 }}
        </div>
        <button
          v-for="entry in visibleEntries"
          :key="entry.key"
          type="button"
          class="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs"
          :class="selectedEntry?.key === entry.key ? 'bg-surface text-text' : 'text-muted hover:bg-surface/50 hover:text-text'"
          @click="selectedKey = entry.key"
        >
          <span
            class="h-1.5 w-1.5 shrink-0 rounded-full"
            :style="{ background: STATUS_META[entry.color].color }"
          />
          <span class="truncate">{{ entry.label }}</span>
        </button>

        <p v-if="!visibleEntries.length" class="px-1.5 text-[11px] text-muted italic">No mechanisms match the current search/filters.</p>
      </nav>

      <div class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-4xl">
          <div v-if="selectedEntry" class="rounded-md border border-border-subtle bg-panel p-3">
            <div class="flex items-start gap-2">
              <span
                class="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                :style="{ background: STATUS_META[selectedEntry.color].color }"
                :title="STATUS_META[selectedEntry.color].label"
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
        </div>
      </div>
    </template>

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
  </div>
</template>
