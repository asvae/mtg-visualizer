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
//
// 2026-09-18: URL-based deep-linking (route file renamed `index.vue` ->
// `[[slug]].vue`), same route-<->selection sync convention
// `app/pages/app/engine/keywords/[[slug]].vue` established first — see that
// file's own header for the full rationale (import direction only; the
// composable's own internal "current selection got filtered out" reset
// never navigates). This axis's `key` field (`gap-<N>-<slugified-title-
// prefix>`, per `functional-model/engine-status.ts`'s own
// `EngineStatusEntry.key` doc comment) is already a clean, URL-safe string
// recomputed fresh off `ENGINE_GAPS.md` on every request — reused directly
// as the slug, same "no second derivation" call Predicates makes for its
// own already-clean `slug` field.
import { computed, reactive, ref, watch } from 'vue';
import { useStatusFilterList } from '../../../../composables/useStatusFilterList';
import type { StatusFilterOption } from '../../../../composables/useStatusFilterList';
import type { EngineStatusPageEntry } from '../../../../../server/api/engine-status/index.get';
import type { SourceFileResult } from '../../../../../functional-model/source-files';
import { statusBadgeStyle } from '../../../../lib/badgeColor';
import { renderMarkdownInline } from '../../../../lib/markdown';

definePageMeta({ layout: 'graph' });

const { data, pending, error } = useFetch<EngineStatusPageEntry[]>('/api/engine-status');
const toast = useToast();
const isDev = import.meta.dev;

type StatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green' | 're-review';
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
  {
    value: 're-review',
    label: 'Needs re-review',
    color: '#7dd3fc',
    description: 'A human previously confirmed this gap, but ENGINE_GAPS.md’s own text or a cited test file has since changed — the old confirmation is stale and needs another look.',
  },
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

// Dynamic tab title (2026-09-18, later same day) — same `Engine | <Tab> |
// <selected entry>` format Cards/Predicates also adopted; falls back to a
// bare `Engine | Features` with nothing selected. A `computed()` (not a
// plain string) so it stays live as the user clicks/keyboard-navigates
// between entries, not just on initial load.
useHead({ title: computed(() => (selectedEntry.value ? `Engine | Features | ${selectedEntry.value.title}` : 'Engine | Features')) });

// --- URL deep-linking (route <-> selection sync) — see this file's own
// header for the convention/slug-source note.
const route = useRoute();
const routeSlug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined));
watch(
  [routeSlug, items],
  ([slug, entries]) => {
    if (!slug || !entries.length) return;
    const match = entries.find((e) => e.key === slug);
    if (match) list.selectedKey.value = match.key;
  },
  { immediate: true },
);

function pickEntry(entry: EngineStatusPageEntry) {
  navigateTo(`/app/engine/features/${entry.key}`);
}
function goPrev() {
  const idx = list.selectedIndex.value;
  if (idx > 0) pickEntry(list.visible.value[idx - 1]!);
}
function goNext() {
  const idx = list.selectedIndex.value;
  if (idx >= 0 && idx < list.visible.value.length - 1) pickEntry(list.visible.value[idx + 1]!);
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
    @prev="goPrev"
    @next="goNext"
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
          <EngineConsoleStatusHelp :status-options="STATUS_OPTIONS" />
        </template>
      </EngineConsoleStatusFilterControls>

      <EngineConsoleEntryListPanel
        :entries="list.visible.value"
        :key-of="(e: EngineStatusPageEntry) => e.key"
        :selected-key="list.selectedKey.value"
        empty-message="No gaps match the current search/filters."
        @select="pickEntry"
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
        <!-- Header: gap number + title + status. -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="text-[11px] tabular-nums text-muted">#{{ selectedEntry.gapNumber }}</span>
          <span class="text-sm font-semibold text-text">{{ selectedEntry.title }}</span>
          <UBadge :style="statusBadgeStyle(statusMeta(selectedEntry.color).color)" size="sm" variant="solid">
            {{ statusMeta(selectedEntry.color).label }}
          </UBadge>
          <span
            v-if="selectedEntry.review"
            class="rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase"
          >
            baseline: {{ selectedEntry.baseline }}
          </span>
        </div>

        <!-- Verification checklist: scannable icon+label status row instead
             of run-on chips; cited test filenames move to their own small
             chip list underneath (a list of names, not a pass/fail signal
             themselves — the pass/fail signal is "were any cited at all"). -->
        <div class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Verification checklist</div>
          <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
            <span
              class="flex items-center gap-1.5"
              :class="selectedEntry.evidence.hasClosedMarker ? 'text-produce' : 'text-consume'"
            >
              <UIcon
                :name="selectedEntry.evidence.hasClosedMarker ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                class="h-3.5 w-3.5 shrink-0"
              />
              {{ selectedEntry.evidence.hasClosedMarker ? 'CLOSED marker present' : 'No CLOSED marker — open gap' }}
            </span>
            <span v-if="selectedEntry.evidence.hasNamedRemainder" class="flex items-center gap-1.5 text-magnifier">
              <UIcon name="i-lucide-triangle-alert" class="h-3.5 w-3.5 shrink-0" />
              Text names a remainder not modeled
            </span>
            <span
              v-if="selectedEntry.evidence.hasClosedMarker && !selectedEntry.evidence.testFiles.length"
              class="flex items-center gap-1.5 text-magnifier"
            >
              <UIcon name="i-lucide-triangle-alert" class="h-3.5 w-3.5 shrink-0" />
              No *.test.ts cited
            </span>
            <span v-if="selectedEntry.evidence.testFiles.length" class="flex items-center gap-1.5 text-produce">
              <UIcon name="i-lucide-list-checks" class="h-3.5 w-3.5 shrink-0" />
              {{ selectedEntry.evidence.testFiles.length }} test file{{ selectedEntry.evidence.testFiles.length > 1 ? 's' : '' }} cited
            </span>
          </div>
          <div v-if="selectedEntry.evidence.testFiles.length" class="mt-1.5 flex flex-wrap gap-1">
            <span
              v-for="f in selectedEntry.evidence.testFiles"
              :key="f"
              class="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text"
            >
              {{ f }}
            </span>
          </div>
        </div>

        <div class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">From ENGINE_GAPS.md</div>
          <!-- Raw excerpt IS ENGINE_GAPS.md's own markdown prose (bold/
               strikethrough), not curated reviewer text — render it as
               real formatting instead of showing literal `~~`/`**`
               characters. `renderMarkdownInline` only ever emits
               strong/em/del/code/a tags over already-HTML-escaped text
               (app/lib/markdown.ts), so this is safe against the excerpt
               ever containing a literal `<`/`>`. -->
          <p class="mt-1 text-[11px] leading-relaxed text-muted" v-html="renderMarkdownInline(selectedEntry.evidence.excerpt)" />
        </div>

        <div v-if="selectedEntry.testFileRefs.length" class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Cited test files — real evidence</div>
          <div class="mt-1.5 flex flex-col gap-1">
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

        <div v-if="selectedEntry.review" class="mt-3 border-t border-border-subtle pt-3">
          <div class="rounded border border-border-subtle bg-surface/60 p-2 text-[11px]">
            <div class="font-semibold" :class="selectedEntry.review.verdict === 'confirm' ? 'text-produce' : 'text-warn'">
              Reviewed — {{ selectedEntry.review.verdict === 'confirm' ? 'confirmed' : 'rejected' }}
              <span v-if="selectedEntry.review.reviewedAt" class="font-normal text-muted">({{ selectedEntry.review.reviewedAt }})</span>
            </div>
            <p v-if="selectedEntry.review.note" class="mt-0.5 text-muted">{{ selectedEntry.review.note }}</p>
          </div>
        </div>

        <div
          v-if="isDev && (selectedEntry.baseline === 'blue' || selectedEntry.review)"
          class="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3"
        >
          <template v-if="selectedEntry.baseline === 'blue'">
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
          </template>
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
