<script setup lang="ts">
// Engine-capability status dashboard — one row per real gap/capability
// tracked in functional-model/ENGINE_GAPS.md's own "Real gaps —
// prioritized" numbered list (see server/api/engine-status/index.get.ts +
// .claude/contracts/engine-status-schema.md, owner: `engine` agent). A
// DIFFERENT axis from /app/status's per-card fact-authoring heatmap and
// /app/keywords' per-mechanic replay coverage — this one answers "does the
// engine actually support this at all," independent of any one card's own
// facts. Deliberately its own small standalone page, not merged into either
// of those (per this task's own instruction — /app/keywords answers a
// different question, and keywords/registry.ts is intentionally NOT the
// index this page reads).
//
// REWORKED (2026-09-17) from a flat list into the SAME sidebar-nav +
// single-selected-detail layout /app/keywords/[[slug]].vue uses (search box
// + grouped/filterable list on the left, one entry's full detail on the
// right) — the earlier flat-list choice ("list is small, no need for a
// nav+detail split") was an explicit, deliberate call at the time but is
// overridden now: the user wants layout consistency with /app/keywords
// regardless of list size. Structure below intentionally mirrors that page
// class-for-class (`w-[240px]` nav, `UInput` search, `mx-auto max-w-4xl`
// detail pane) rather than inventing a new sidebar pattern. Unlike
// /app/keywords' `[[slug]].vue`, this page does NOT get its own per-entry
// URL routing (`selectedKey` is a plain local ref, not a route param) — the
// task asked for the sidebar+detail STRUCTURE, not deep-linking, and this
// axis has no existing slug-routing precedent to extend.
//
// `baseline` (gray/purple/blue, computed fresh off ENGINE_GAPS.md every
// request) and `color` (baseline, or yellow/green once a human review
// overlay exists) are BOTH rendered — the dot uses `color` (the contract's
// own "render/filter on this" field), but a `baseline` note stays visible
// whenever a review has overridden it, so what got overridden and from what
// is never lost (same as the schema contract itself asks for).
import { computed, ref, watch } from 'vue';
import type { EngineStatusPageEntry } from '../../../../server/api/engine-status/index.get';

definePageMeta({ layout: 'graph' });
useHead({ title: 'Engine capability status' });

const { data, pending, error } = useFetch<EngineStatusPageEntry[]>('/api/engine-status');
const toast = useToast();

// Same `isDev` local-const convention CardDetailTabs.vue's own dev-only
// review controls use — `import.meta.dev` can't be used directly inside a
// template expression (the Vue SFC compiler chokes parsing `import.meta`
// as part of an attribute-value JS expression), so it's read once here in
// script instead.
const isDev = import.meta.dev;

type StatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green';
const STATUS_META: Record<StatusColor, { color: string; label: string; description: string }> = {
  gray: { color: '#6b7280', label: 'Gray', description: 'No support at all — the tracked gap has no CLOSED marker in ENGINE_GAPS.md.' },
  purple: {
    color: '#a855f7',
    label: 'Purple',
    description: 'Closed, but only schema-level / partially modeled — either the item’s own text names a real remainder still not modeled, or no *.test.ts is cited (closed by claim, not independently checkable).',
  },
  blue: { color: '#3b82f6', label: 'Blue', description: 'Closed AND verified — cites at least one real *.test.ts and names no remainder.' },
  yellow: { color: '#eab308', label: 'Yellow', description: 'Human-reviewed and REJECTED — a reviewer judged the computed baseline wrong; see its own note.' },
  green: { color: '#22c55e', label: 'Green', description: 'Human-reviewed and CONFIRMED.' },
};
const STATUS_ORDER: StatusColor[] = ['gray', 'purple', 'blue', 'yellow', 'green'];

// Sorted by the stable gap number (never by title — see the contract's own
// "don't assume `key` is stable across a title rewording" note; gapNumber
// is the durable identity, sorting on it too keeps row order stable across
// a wording tweak).
const sortedEntries = computed(() => [...(data.value ?? [])].sort((a, b) => a.gapNumber - b.gapNumber));

// Sidebar search — same plain case-insensitive substring convention as
// /app/keywords' own `matchesQuery`, matched against title + gap number.
const searchQuery = ref('');
const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());
function matchesQuery(entry: EngineStatusPageEntry): boolean {
  if (!normalizedQuery.value) return true;
  return (
    entry.title.toLowerCase().includes(normalizedQuery.value) ||
    `#${entry.gapNumber}`.includes(normalizedQuery.value)
  );
}

// Show/hide-by-color filter — all on by default, same as before this
// rework, just relocated into the sidebar.
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

// Per-row in-flight guard — same "disable while a request for THIS row is
// out" convention ReviewStatusBadge's own `pending` prop documents, just
// tracked locally here since this page's review shape (verdict + required
// reject note) doesn't fit that shared component's own 3-way vocabulary
// (app/types.ts's `ReviewStatus`) or endpoint payload.
const pendingKey = ref<string | null>(null);

const rejectOpen = ref(false);
const rejectTarget = ref<EngineStatusPageEntry | null>(null);
const rejectNote = ref('');
function openReject(entry: EngineStatusPageEntry) {
  rejectTarget.value = entry;
  rejectNote.value = entry.review?.verdict === 'reject' ? (entry.review.note ?? '') : '';
  rejectOpen.value = true;
}

async function submitReview(entry: EngineStatusPageEntry, verdict: 'confirm' | 'reject' | null, note?: string) {
  pendingKey.value = entry.key;
  try {
    const res = await $fetch<{ key: string; color: 'yellow' | 'green' | null }>('/api/engine-status/review', {
      method: 'POST',
      body: { key: entry.key, verdict, note },
    });
    // Optimistic in-place mutation (same convention app/pages/app/keywords/
    // [[slug]].vue's own handleReviewed uses) — mirrors exactly what
    // server/api/engine-status/review.post.ts itself just wrote, so no
    // refetch of the whole list is needed for this one row to reflect it.
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

function confirmEntry(entry: EngineStatusPageEntry) {
  submitReview(entry, 'confirm');
}
function clearReview(entry: EngineStatusPageEntry) {
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
        <h1 class="mb-1 px-1.5 text-sm font-semibold text-text">Engine capability status</h1>
        <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
          One row per gap tracked in <code class="rounded bg-bg px-1 py-0.5">ENGINE_GAPS.md</code> — does the engine
          support this at all, independent of any one card's own facts. See
          <NuxtLink to="/app/keywords" class="text-text underline">Keyword &amp; mechanic coverage</NuxtLink>
          for that different question instead.
        </p>
        <p v-if="!isDev" class="mb-3 px-1.5 text-[11px] text-muted italic">Review actions are dev-only here.</p>

        <UInput
          v-model="searchQuery"
          class="mb-3"
          placeholder="Search gaps…"
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
          <span class="shrink-0 text-[10px] tabular-nums text-muted/70">#{{ entry.gapNumber }}</span>
          <span class="truncate">{{ entry.title }}</span>
        </button>

        <p v-if="!visibleEntries.length" class="px-1.5 text-[11px] text-muted italic">No gaps match the current search/filters.</p>
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
                  <span class="text-[11px] tabular-nums text-muted">#{{ selectedEntry.gapNumber }}</span>
                  <span class="text-sm font-semibold text-text">{{ selectedEntry.title }}</span>
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
                    :class="selectedEntry.evidence.hasClosedMarker ? 'bg-produce/15 text-produce' : 'bg-consume/15 text-consume'"
                  >
                    {{ selectedEntry.evidence.hasClosedMarker ? 'CLOSED marker present' : 'No CLOSED marker — open gap' }}
                  </span>
                  <span v-if="selectedEntry.evidence.hasNamedRemainder" class="rounded bg-magnifier/15 px-1.5 py-0.5 text-magnifier">
                    Text names a remainder not modeled
                  </span>
                  <span
                    v-if="selectedEntry.evidence.hasClosedMarker && !selectedEntry.evidence.testFiles.length"
                    class="rounded bg-magnifier/15 px-1.5 py-0.5 text-magnifier"
                  >
                    No *.test.ts cited
                  </span>
                  <span v-for="f in selectedEntry.evidence.testFiles" :key="f" class="rounded bg-surface px-1.5 py-0.5 font-mono text-text">
                    {{ f }}
                  </span>
                </div>

                <p class="mt-1.5 text-[11px] leading-relaxed text-muted italic">{{ selectedEntry.evidence.excerpt }}</p>

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
          <p v-else class="text-xs text-muted italic">Pick a tracked gap from the sidebar.</p>
        </div>
      </div>
    </template>

    <UModal v-model:open="rejectOpen" title="Reject baseline">
      <template #body>
        <p class="mb-2 text-xs text-muted">
          <span class="font-semibold text-text">#{{ rejectTarget?.gapNumber }} {{ rejectTarget?.title }}</span> — explain
          why the computed baseline is wrong. A note is required (that's the whole point of yellow).
        </p>
        <UTextarea v-model="rejectNote" class="w-full" :rows="4" placeholder="e.g. spot-checked against real Forge source, the remainder this names is actually already handled by..." autofocus />
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
