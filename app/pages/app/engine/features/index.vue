<script setup lang="ts">
// Engine-capability (feature) status — one of the four `/app/engine/*`
// console tabs (see EngineConsoleTabs.vue's own header). Was the
// standalone `/app/engine-status` page; this route replaces it (old route
// removed as part of this same consolidation — see AppHeader.vue). Same
// underlying data/endpoint (`GET /api/engine-status` + its own `./review`
// sibling) and the exact same confirm/reject-with-note/clear-review
// capability that page had — only the shell moved onto the shared
// `useStatusFilterList`/`EngineConsoleShell`/`StatusFilterControls`/
// `EntryListPanel` pieces.
import { computed, reactive, ref } from 'vue';
import { useStatusFilterList } from '../../../../composables/useStatusFilterList';
import type { StatusFilterOption } from '../../../../composables/useStatusFilterList';
import type { EngineStatusPageEntry } from '../../../../../server/api/engine-status/index.get';
import type { SourceFileResult } from '../../../../../functional-model/source-files';

definePageMeta({ layout: 'graph' });
useHead({ title: 'Engine capability status' });

const { data, pending, error } = useFetch<EngineStatusPageEntry[]>('/api/engine-status');
const toast = useToast();
const isDev = import.meta.dev;

type StatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green';
const STATUS_OPTIONS: StatusFilterOption<StatusColor>[] = [
  { value: 'gray', label: 'Open gap', color: '#6b7280', description: 'No support at all — the tracked gap has no CLOSED marker in ENGINE_GAPS.md.' },
  {
    value: 'purple',
    label: 'Closed, unverified',
    color: '#a855f7',
    description: 'Closed, but only schema-level / partially modeled — either the item’s own text names a real remainder still not modeled, or no *.test.ts is cited (closed by claim, not independently checkable).',
  },
  { value: 'blue', label: 'Closed, verified', color: '#3b82f6', description: 'Closed AND verified — cites at least one real *.test.ts and names no remainder.' },
  { value: 'yellow', label: 'Rejected', color: '#eab308', description: 'Human-reviewed and REJECTED — a reviewer judged the computed baseline wrong; see its own note.' },
  { value: 'green', label: 'Confirmed', color: '#22c55e', description: 'Human-reviewed and CONFIRMED.' },
];

const items = computed(() => data.value ?? []);
const list = useStatusFilterList<EngineStatusPageEntry, StatusColor>({
  items,
  keyOf: (e) => e.key,
  statusOf: (e) => e.color,
  statusOptions: STATUS_OPTIONS,
  matchesQuery: (e, q) => e.title.toLowerCase().includes(q) || `#${e.gapNumber}`.includes(q),
  // Sort by the stable gap number, never by title — see the contract's own
  // "don't assume `key` is stable across a title rewording" note.
  sortBy: (a, b) => a.gapNumber - b.gapNumber,
  storageKey: 'engine-console-filters-features',
});

const selectedEntry = computed(() => list.selected.value);
function statusMeta(color: StatusColor) {
  return STATUS_OPTIONS.find((o) => o.value === color)!;
}

const pendingKey = ref<string | null>(null);

// Fetch-on-demand cache for `GET /api/engine-status/source`, keyed by the
// real repo-root-relative path (one of a `testFileRefs[].matches[]` entry) —
// NOT keyed per selected gap, since the same large file (`engine.test.ts`,
// ~115KB) is cited by several entries; a path fetched once while looking at
// gap #8 stays cached when the reviewer later opens gap #10's own citation
// of the same file. `reactive(new Map())` (not `ref`) so `.set()` inside
// `loadSource` below is tracked without needing `.value` on every access.
const sourceCache = reactive(new Map<string, { loading: boolean; result: SourceFileResult | null }>());

function sourceEntry(path: string) {
  return sourceCache.get(path);
}

async function loadSource(path: string) {
  if (sourceCache.has(path)) return; // already fetched or in flight — never refetch
  sourceCache.set(path, { loading: true, result: null });
  try {
    const res = await $fetch<SourceFileResult>('/api/engine-status/source', { query: { path } });
    sourceCache.set(path, { loading: false, result: res });
  } catch (e: any) {
    sourceCache.set(path, {
      loading: false,
      result: { path, exists: false, content: null, truncated: false },
    });
    toast.add({
      title: 'Could not load source',
      description: e?.data?.error ?? e?.message ?? 'Request failed.',
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    });
  }
}

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
  <EngineConsoleShell
    :pending="pending"
    :error="error"
    :can-prev="list.canPrev.value"
    :can-next="list.canNext.value"
    :position-label="list.positionLabel.value"
    @prev="list.selectPrev"
    @next="list.selectNext"
  >
    <template #nav>
      <h1 class="mb-1 px-1.5 text-sm font-semibold text-text">Engine capability status</h1>
      <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
        One row per gap tracked in <code class="rounded bg-bg px-1 py-0.5">ENGINE_GAPS.md</code> — does the engine
        support this at all, independent of any one card's own facts. See
        <NuxtLink to="/app/engine/predicates" class="text-text underline">Predicate status</NuxtLink> for that
        different question instead.
      </p>
      <p v-if="!isDev" class="mb-3 px-1.5 text-[11px] text-muted italic">Review actions are dev-only here.</p>

      <EngineConsoleStatusFilterControls
        :search-query="list.searchQuery.value"
        search-placeholder="Search gaps…"
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
              Computed baseline (automatic, off <code>ENGINE_GAPS.md</code>): <b class="text-text">Open gap</b> → once
              the doc marks the gap <code>CLOSED</code>, either <b class="text-text">Closed, unverified</b> (no
              <code>*.test.ts</code> cited, or the entry names a real remainder still not modeled) or, once a real test
              is cited AND no remainder is named, <b class="text-text">Closed, verified</b>.
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
        :key-of="(e: EngineStatusPageEntry) => e.key"
        :selected-key="list.selectedKey.value"
        empty-message="No gaps match the current search/filters."
        @select="list.select"
      >
        <template #row="{ entry }">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: statusMeta(entry.color).color }" />
          <span class="shrink-0 text-[10px] tabular-nums text-muted/70">#{{ entry.gapNumber }}</span>
          <span class="truncate">{{ entry.title }}</span>
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

            <div v-if="selectedEntry.testFileRefs.length" class="mt-2">
              <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Cited test files — real evidence</div>
              <div class="mt-1 flex flex-col gap-1">
                <template v-for="ref in selectedEntry.testFileRefs" :key="ref.file">
                  <EngineConsoleCodeSection
                    v-for="path in ref.matches"
                    :key="path"
                    :title="path"
                    language="ts"
                    :loading="sourceEntry(path)?.loading ?? false"
                    :result="sourceEntry(path)?.result ?? null"
                    not-found-label="Failed to load."
                    @expand="loadSource(path)"
                  />
                  <EngineConsoleCodeSection
                    v-if="!ref.matches.length"
                    :title="ref.file"
                    language="ts"
                    :result="{ path: ref.file, exists: false, content: null, truncated: false }"
                    not-found-label="Citation not found on disk — this filename doesn't exist anywhere in functional-model/."
                  />
                </template>
              </div>
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
      <p v-else class="text-xs text-muted italic">Pick a tracked gap from the sidebar.</p>
    </template>
  </EngineConsoleShell>

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
</template>
