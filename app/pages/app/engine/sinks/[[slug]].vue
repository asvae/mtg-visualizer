<script setup lang="ts">
// Matcher CATALOG entry status — one of the `/app/engine/*` console tabs (see
// EngineConsoleTabs.vue's own header for the tab list). Genuinely different
// axis from Predicates (`/app/engine/predicates`, sink-derivation
// PREDICATE mechanisms — engine-automation gameplay consequences like
// Saga/Crew) — this tracks the shared, reviewed sink CATALOG itself
// (`functional-model/matcher-model/catalog/<slug>.ts`), the QUESTION side of
// the sink-only synergy experiment. Same underlying data/endpoint shape as
// Predicates (`GET /api/sink-catalog` + its own `./review` sibling) and the
// exact same review/reject-with-note/clear-review capability that page
// has — built byte-for-byte off that page's own structure per this task's
// own "mirror both the page structure and the API-route pattern faithfully"
// instruction, including its URL-based deep-linking convention
// (`[[slug]].vue`, `e.slug` reused directly as the stable identity — a
// catalog entry has no separate `key`/`slug` split the way sink-derivation
// mechanisms do).
import { computed, ref, watch } from 'vue';
import { useStatusFilterList } from '../../../../composables/useStatusFilterList';
import type { StatusFilterOption } from '../../../../composables/useStatusFilterList';
import type { MatcherCatalogPageEntry } from '../../../../../server/api/sink-catalog/index.get';
import { statusBadgeStyle } from '../../../../lib/badgeColor';

definePageMeta({ layout: 'graph' });

const { data, pending, error } = useFetch<MatcherCatalogPageEntry[]>('/api/sink-catalog');
const toast = useToast();

// `import.meta.dev` can't be used directly inside a template expression —
// same local-const workaround Predicates/Features use.
const isDev = import.meta.dev;

type StatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green' | 're-review';
const STATUS_OPTIONS: StatusFilterOption<StatusColor>[] = [
  { value: 'gray', label: 'Not gated yet', color: '#6b7280', description: 'Catalog entry exists, but its own mocked-fixture corpus manifest is missing or empty — drafted, gate not run yet.' },
  {
    value: 'purple',
    label: 'Unverified',
    color: '#a855f7',
    description: 'A corpus manifest exists, but not every mocked fixture case in it agrees yet (passing < total).',
  },
  {
    value: 'blue',
    label: 'Verified',
    color: '#3b82f6',
    description: 'Verified: the corpus manifest shows every mocked fixture case agreeing (passing === total) — the structural gate passed for real.',
  },
  { value: 'yellow', label: 'Rejected', color: '#eab308', description: 'Human-reviewed and REJECTED — a reviewer found a real disagreement with the computed baseline; see its own note.' },
  { value: 'green', label: 'Confirmed', color: '#22c55e', description: 'Human-reviewed and CONFIRMED.' },
  {
    value: 're-review',
    label: 'Needs re-review',
    color: '#7dd3fc',
    description: 'A human previously confirmed this entry, but its own query/corpus content has since changed — the old confirmation is stale and needs another look.',
  },
];

const items = computed(() => data.value ?? []);
const list = useStatusFilterList<MatcherCatalogPageEntry, StatusColor>({
  items,
  keyOf: (e) => e.slug,
  statusOf: (e) => e.color,
  statusOptions: STATUS_OPTIONS,
  matchesQuery: (e, q) => e.category.toLowerCase().includes(q) || e.slug.toLowerCase().includes(q),
  // Alphabetical by category — this axis's `slug` IS the stable identity
  // itself, same rationale Predicates' own `sortBy` comment gives.
  sortBy: (a, b) => a.category.localeCompare(b.category),
  storageKey: 'engine-console-filters-sinks',
});

// Top-level alias so the template can write plain `selectedEntry` (Vue
// auto-unwraps a TOP-LEVEL ref/computed reference in a template, but not a
// nested property access).
const selectedEntry = computed(() => list.selected.value);
function statusMeta(color: StatusColor) {
  return STATUS_OPTIONS.find((o) => o.value === color)!;
}

// Real, pretty-printed query JSON for the code-section viewer below — same
// `EngineConsoleCodeSection`/`JsonHighlight` pairing Predicates' own corpus-
// manifest panel already uses, reused here for a value that was never a
// file on disk (the query is a plain in-memory object, not read off
// `sourceFiles`) via a synthetic `SourceFileResult`-shaped object.
//
// **`null` for an entry with no real `query` at all** (2026-09-18,
// `CountersMatcher`'s own no-`query` entries — `MatcherCatalogPageEntry.query`'s
// own doc comment, `server/api/sink-catalog/index.get.ts`) — the template
// below renders the whole "Curated MatcherQuery" panel conditionally on this,
// rather than showing an empty/`undefined` block. Per the user's own
// explicit correction: no synthesized display-only query object either —
// "just put these mock definitions somewhere within test" — the real
// answer for "what does this sink look for" lives in the family's own
// unit test (`counters.test.ts`, rewritten 2026-09-19 to run real compiled
// Forge cards rather than mocked corpus.json fixtures), shown below via
// "Unit test" for this query-less case, not a fabricated query.
const queryResult = computed(() =>
  selectedEntry.value?.query
    ? { path: 'query', exists: true, content: JSON.stringify(selectedEntry.value.query, null, 2), truncated: false }
    : null,
);

// Dynamic tab title, same `Engine | <Tab> | <selected entry>` format
// Predicates/Features/Cards also use.
useHead({ title: computed(() => (selectedEntry.value ? `Engine | Matchers | ${selectedEntry.value.category}` : 'Engine | Matchers')) });

// --- URL deep-linking (route <-> selection sync), same convention
// Predicates/Features/Cards/Keywords already established.
const route = useRoute();
const routeSlug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined));
watch(
  [routeSlug, items],
  ([slug, entries]) => {
    if (!slug || !entries.length) return;
    const match = entries.find((e) => e.slug === slug);
    if (match) list.selectedKey.value = match.slug;
  },
  { immediate: true },
);

function pickEntry(entry: MatcherCatalogPageEntry) {
  navigateTo(`/app/engine/sinks/${entry.slug}`);
}
function goPrev() {
  const idx = list.selectedIndex.value;
  if (idx > 0) pickEntry(list.visible.value[idx - 1]!);
}
function goNext() {
  const idx = list.selectedIndex.value;
  if (idx >= 0 && idx < list.visible.value.length - 1) pickEntry(list.visible.value[idx + 1]!);
}

// Per-row in-flight guard, same convention Predicates uses.
const pendingKey = ref<string | null>(null);

const rejectOpen = ref(false);
const rejectTarget = ref<MatcherCatalogPageEntry | null>(null);
const rejectNote = ref('');
function openReject(entry: MatcherCatalogPageEntry) {
  rejectTarget.value = entry;
  rejectNote.value = entry.review?.verdict === 'reject' ? (entry.review.note ?? '') : '';
  rejectOpen.value = true;
}

async function submitReview(entry: MatcherCatalogPageEntry, verdict: 'confirm' | 'reject' | null, note?: string) {
  pendingKey.value = entry.slug;
  try {
    const res = await $fetch<{ slug: string; color: 'yellow' | 'green' | null }>('/api/sink-catalog/review', {
      method: 'POST',
      body: { slug: entry.slug, verdict, note },
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

function confirmEntry(entry: MatcherCatalogPageEntry) {
  submitReview(entry, 'confirm');
}
function clearReview(entry: MatcherCatalogPageEntry) {
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
      <h1 class="mb-1 px-1.5 text-sm font-semibold text-text">Matcher catalog status</h1>
      <p class="mb-3 px-1.5 text-[11px] leading-relaxed text-muted">
        One row per shared, reviewed matcher catalog entry — the QUESTION side of the sink-only synergy experiment, a
        different axis from
        <NuxtLink to="/app/engine/predicates" class="text-text underline">Predicate status</NuxtLink>.
      </p>
      <p v-if="!isDev" class="mb-3 px-1.5 text-[11px] text-muted italic">Review actions are dev-only here.</p>

      <EngineConsoleStatusFilterControls
        :search-query="list.searchQuery.value"
        search-placeholder="Search catalog entries…"
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
        :key-of="(e: MatcherCatalogPageEntry) => e.slug"
        :selected-key="list.selectedKey.value"
        empty-message="No catalog entries match the current search/filters."
        @select="pickEntry"
      >
        <template #row="{ entry }">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: statusMeta(entry.color).color }" />
          <span class="truncate">{{ entry.category }}</span>
        </template>
      </EngineConsoleEntryListPanel>
    </template>

    <template #detail>
      <div v-if="selectedEntry" class="rounded-md border border-border-subtle bg-panel p-3">
        <!-- Header: category + status. -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="text-sm font-semibold text-text">{{ selectedEntry.category }}</span>
          <UBadge :style="statusBadgeStyle(statusMeta(selectedEntry.color).color)" size="sm" variant="solid">
            {{ statusMeta(selectedEntry.color).label }}
          </UBadge>
          <span
            v-if="selectedEntry.review"
            class="rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase"
          >
            baseline: {{ selectedEntry.baseline }}
          </span>
          <span class="font-mono text-[10px] text-muted/70">{{ selectedEntry.slug }}</span>
        </div>

        <!-- Verification checklist: structural gate presence + mocked
             corpus pass rate — same scannable icon+label row Predicates'
             own checklist uses. -->
        <div class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Verification checklist</div>
          <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
            <span
              class="flex items-center gap-1.5"
              :class="selectedEntry.evidence.corpusManifestExists ? 'text-produce' : 'text-consume'"
            >
              <UIcon
                :name="selectedEntry.evidence.corpusManifestExists ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                class="h-3.5 w-3.5 shrink-0"
              />
              {{ selectedEntry.evidence.corpusManifestExists ? 'Corpus manifest exists' : 'No corpus manifest yet' }}
            </span>
            <span v-if="selectedEntry.evidence.corpusManifestExists" class="flex items-center gap-1.5 font-mono text-text">
              <UIcon name="i-lucide-list-checks" class="h-3.5 w-3.5 shrink-0 text-muted" />
              {{ selectedEntry.evidence.corpusPassing }} / {{ selectedEntry.evidence.corpusTotal }} mocked fixture cases passing
            </span>
          </div>
          <div
            class="mt-1.5 truncate font-mono text-[10px] text-muted/70"
            :title="selectedEntry.evidence.corpusManifestPath"
          >
            {{ selectedEntry.evidence.corpusManifestPath }}
          </div>
        </div>

        <div v-if="queryResult" class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Query</div>
          <div class="mt-1.5">
            <EngineConsoleCodeSection title="Curated MatcherQuery" language="json" :result="queryResult" default-open />
          </div>
        </div>

        <!-- Matches (2026-09-18) — genuinely different question from the
             mocked-fixture corpus manifest above (does the entry BEHAVE
             correctly against a hand-picked fixture set) vs. this (who in
             the ACTUAL dev pool matches it today). SINK CANDIDATE matches
             only — who genuinely owns/reacts to this category, per
             `functional-model/matcher-model/MATCHER_MODEL_DESIGN.md`'s own
             thesis that sink-candidate curation is the one place real
             judgment concentrates in this pipeline. The source-candidate
             side is deliberately NOT shown here: for a broad family like
             Battlefield presence it's essentially "every creature" (111
             real FDN pool cards for Cats alone) — real, but not
             review-worthy content on a SINK's own page. Real thumbnails via
             the shared `CardMatchGallery.vue` (same component
             `CardDetailTabs.vue`'s own card-page "Sinks" section uses) —
             every match already carries server-RESOLVED
             `image`/`set`/`collectorNumber` (`server/utils/cardMeta.ts`),
             never a live per-card client-side Scryfall fetch. `undefined`
             (not `[]`) `realMatches` means the dev-only FDN pool wasn't
             computed at all (production, or the loader failed) — rendered
             as a plain note, not hidden silently, so a reviewer doesn't
             mistake "not computed" for "zero real matches." -->
        <div class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Matches</div>
          <p v-if="!selectedEntry.realMatches" class="mt-1.5 text-[11px] text-muted italic">
            Not computed — dev-only FDN pool unavailable (production build, or the pool failed to load).
          </p>
          <p v-else-if="!selectedEntry.realMatches.sinkCandidateMatches" class="mt-1.5 text-[11px] text-muted italic">
            This entry declares no sink-candidate signal to match against.
          </p>
          <details v-else class="mt-1.5 rounded-md border border-border-subtle bg-surface/40 px-2.5 py-1.5 text-[11px] text-text">
            <summary class="flex cursor-pointer items-center gap-1.5">
              <UIcon name="i-lucide-log-in" class="h-3.5 w-3.5 shrink-0 text-consume" />
              Matches
              <span class="ml-auto shrink-0 rounded-full bg-bg px-2 py-px text-[10px] font-bold text-muted">
                {{ selectedEntry.realMatches.sinkCandidateMatches.length }} card{{ selectedEntry.realMatches.sinkCandidateMatches.length === 1 ? '' : 's' }}
              </span>
            </summary>
            <div v-if="selectedEntry.realMatches.sinkCandidateMatches.length" class="mt-1.5">
              <CardMatchGallery :matches="selectedEntry.realMatches.sinkCandidateMatches" />
            </div>
            <p v-else class="mt-1.5 text-muted italic">No real FDN pool card carries this entry's sink-candidate signal today.</p>
          </details>
        </div>

        <!-- Source — real evidence (2026-09-18, narrowed to exactly 2 real,
             read-worthy files — no raw corpus.json JSON dump, no thin
             per-instance config file): "Sink source" is the file the
             entry's own real matching LOGIC lives in (the shared
             `families/<slug>.ts` factory for a real multi-instance family
             like Counters, or the singleton's own `<slug>.ts` otherwise —
             `MatcherCatalogSourceFiles.entry`'s own doc comment,
             `server/api/sink-catalog/index.get.ts`); "Corpus test" is the
             real `.test.ts` file itself, per the user's own "I'll read
             tests directly" — the tests already read the corpus.json cases
             for you. `CountersMatcher`'s own `counters.test.ts` is the one
             exception (2026-09-19 rewrite — real compiled Forge cards, no
             mocked corpus.json fixtures), so it's labeled "Unit test"
             below instead, reusing the same query-less check
             (`!queryResult`) `CountersMatcher` entries already use above. -->
        <div class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Source — real evidence</div>
          <div class="mt-1.5 flex flex-col gap-1">
            <EngineConsoleCodeSection
              title="Matcher source"
              language="ts"
              :result="selectedEntry.sourceFiles.entry"
              not-found-label="No matcher source module yet."
            />
            <EngineConsoleCodeSection
              :title="queryResult ? 'Corpus test' : 'Unit test'"
              language="ts"
              :result="selectedEntry.sourceFiles.corpusTest"
              :not-found-label="queryResult ? 'No corpus test yet.' : 'No unit test yet.'"
            />
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
              :disabled="pendingKey === selectedEntry.slug"
              :loading="pendingKey === selectedEntry.slug"
              @click="confirmEntry(selectedEntry)"
            >
              Confirm
            </UButton>
            <UButton
              size="xs"
              color="warning"
              variant="subtle"
              :disabled="pendingKey === selectedEntry.slug"
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
            :disabled="pendingKey === selectedEntry.slug"
            @click="clearReview(selectedEntry)"
          >
            Clear review
          </UButton>
        </div>
      </div>
      <p v-else class="text-xs text-muted italic">Pick a catalog entry from the sidebar.</p>
    </template>
  </EngineConsoleShell>

  <UModal v-model:open="rejectOpen" title="Reject baseline">
    <template #body>
      <p class="mb-2 text-xs text-muted">
        <span class="font-semibold text-text">{{ rejectTarget?.category }}</span> — explain why the computed baseline
        is wrong. A note is required (that's the whole point of yellow).
      </p>
      <UTextarea v-model="rejectNote" class="w-full" :rows="4" placeholder="e.g. spot-checked against real Forge source, the query mishandles..." autofocus />
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="subtle" @click="close">Cancel</UButton>
        <UButton color="warning" :disabled="!rejectNote.trim() || pendingKey === rejectTarget?.slug" :loading="pendingKey === rejectTarget?.slug" @click="submitReject">
          Reject
        </UButton>
      </div>
    </template>
  </UModal>
</template>
