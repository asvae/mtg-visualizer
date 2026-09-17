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
//
// 2026-09-18: URL-based deep-linking (route file renamed `index.vue` ->
// `[[slug]].vue`), same route-<->selection sync convention
// `app/pages/app/engine/keywords/[[slug]].vue` established first — see that
// file's own header for the full rationale (import direction only; the
// composable's own internal "current selection got filtered out" reset
// never navigates). Unlike keywords (which derives a slug from its own
// title text on the fly, no stored field for it), this axis's `slug` field
// already IS the stable, clean, URL-safe identity end to end (`e.key ===
// e.slug`, straight off `sink-derivation-status.ts`'s own
// `SinkDerivationMechanism.slug` doc comment: "Stable identity key — also
// the served `key` and the review-overlay key") — reused directly, no
// second derivation needed.
import { computed, ref, watch } from 'vue';
import { useStatusFilterList } from '../../../../composables/useStatusFilterList';
import type { StatusFilterOption } from '../../../../composables/useStatusFilterList';
import type { SinkDerivationPageEntry } from '../../../../../server/api/sink-derivations/index.get';
import { statusBadgeStyle } from '../../../../lib/badgeColor';

definePageMeta({ layout: 'graph' });
useHead({ title: 'Sink-derivation predicate status' });

const { data, pending, error } = useFetch<SinkDerivationPageEntry[]>('/api/sink-derivations');
const toast = useToast();

// `import.meta.dev` can't be used directly inside a template expression
// (the Vue SFC compiler chokes parsing it mid attribute-value JS
// expression) — same local-const workaround the original page used.
const isDev = import.meta.dev;

type StatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green' | 're-review';
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
  {
    value: 're-review',
    label: 'Needs re-review',
    color: '#7dd3fc',
    description: 'A human previously confirmed this mechanism, but its predicate source or corpus manifest has since changed — the old confirmation is stale and needs another look.',
  },
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

// --- URL deep-linking (route <-> selection sync), same convention
// `app/pages/app/engine/keywords/[[slug]].vue` established first — see that
// file's own header for the full rationale (import direction only; the
// composable's own internal "current selection got filtered out" reset
// never navigates). This axis's `slug` field IS already the stable, clean,
// URL-safe identity (`e.key === e.slug`, see the schema contract/
// `sink-derivation-status.ts`'s own doc comment) — reused directly rather
// than deriving a second slug from the label the way keywords derives one
// from its own title text.
const route = useRoute();
const routeSlug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined));
watch(
  [routeSlug, items],
  ([slug, entries]) => {
    if (!slug || !entries.length) return;
    const match = entries.find((e) => e.slug === slug);
    if (match) list.selectedKey.value = match.key;
  },
  { immediate: true },
);

function pickEntry(entry: SinkDerivationPageEntry) {
  navigateTo(`/app/engine/predicates/${entry.slug}`);
}
function goPrev() {
  const idx = list.selectedIndex.value;
  if (idx > 0) pickEntry(list.visible.value[idx - 1]!);
}
function goNext() {
  const idx = list.selectedIndex.value;
  if (idx >= 0 && idx < list.visible.value.length - 1) pickEntry(list.visible.value[idx + 1]!);
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
    @prev="goPrev"
    @next="goNext"
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
          <EngineConsoleStatusHelp :status-options="STATUS_OPTIONS" />
        </template>
      </EngineConsoleStatusFilterControls>

      <EngineConsoleEntryListPanel
        :entries="list.visible.value"
        :key-of="(e: SinkDerivationPageEntry) => e.key"
        :selected-key="list.selectedKey.value"
        empty-message="No mechanisms match the current search/filters."
        @select="pickEntry"
      >
        <template #row="{ entry }">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: statusMeta(entry.color).color }" />
          <span class="truncate">{{ entry.label }}</span>
        </template>
      </EngineConsoleEntryListPanel>
    </template>

    <template #detail>
      <div v-if="selectedEntry" class="rounded-md border border-border-subtle bg-panel p-3">
        <!-- Header: name + status. The slug used to be echoed right next to
             the label ("Crew cost activation path (crew)") — pure noise
             since it's almost always the same words, just abbreviated; it's
             already searchable (see `matchesQuery` above) so dropping it
             here loses nothing a reviewer needs. -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="text-sm font-semibold text-text">{{ selectedEntry.label }}</span>
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

        <!-- Verification checklist: a scannable icon+label status row
             instead of run-on chips, with the file path demoted to a small
             mono caption underneath (it's a location detail, not a
             pass/fail signal). -->
        <div class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Verification checklist</div>
          <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
            <span
              class="flex items-center gap-1.5"
              :class="selectedEntry.evidence.predicateModuleExists ? 'text-produce' : 'text-consume'"
            >
              <UIcon
                :name="selectedEntry.evidence.predicateModuleExists ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                class="h-3.5 w-3.5 shrink-0"
              />
              {{ selectedEntry.evidence.predicateModuleExists ? 'Predicate module exists' : 'No predicate module yet' }}
            </span>
            <span
              v-if="selectedEntry.evidence.predicateModuleExists"
              class="flex items-center gap-1.5"
              :class="selectedEntry.evidence.corpusManifestExists ? 'text-produce' : 'text-magnifier'"
            >
              <UIcon
                :name="selectedEntry.evidence.corpusManifestExists ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'"
                class="h-3.5 w-3.5 shrink-0"
              />
              {{ selectedEntry.evidence.corpusManifestExists ? 'Corpus manifest exists' : 'No corpus manifest yet' }}
            </span>
            <span v-if="selectedEntry.evidence.corpusManifestExists" class="flex items-center gap-1.5 font-mono text-text">
              <UIcon name="i-lucide-list-checks" class="h-3.5 w-3.5 shrink-0 text-muted" />
              {{ selectedEntry.evidence.corpusPassing }} / {{ selectedEntry.evidence.corpusTotal }} corpus scenarios passing
            </span>
          </div>
          <div
            class="mt-1.5 truncate font-mono text-[10px] text-muted/70"
            :title="selectedEntry.evidence.predicateModulePath"
          >
            {{ selectedEntry.evidence.predicateModulePath }}
          </div>
        </div>

        <div class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">What this is</div>
          <p class="mt-1 text-[11px] leading-relaxed text-muted">{{ selectedEntry.motivation }}</p>
        </div>

        <div v-if="selectedEntry.expectedSinkShapes.length" class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Expected sink-query shapes</div>
          <ul class="mt-1.5 flex flex-col gap-1">
            <li v-for="(shape, i) in selectedEntry.expectedSinkShapes" :key="i" class="text-[11px] leading-relaxed text-muted">
              <code class="rounded bg-surface px-1 py-0.5 font-mono text-text">{{ shape.event }}</code>
              — {{ shape.note }}
            </li>
          </ul>
        </div>

        <div class="mt-3 border-t border-border-subtle pt-3">
          <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Source — real evidence</div>
          <div class="mt-1.5 flex flex-col gap-1">
            <EngineConsoleCodeSection
              title="Predicate source"
              language="ts"
              :result="selectedEntry.sourceFiles.predicate"
              not-found-label="No predicate module built yet."
            />
            <EngineConsoleCodeSection
              title="Corpus manifest"
              language="json"
              :result="selectedEntry.sourceFiles.corpusManifest"
              not-found-label="No corpus manifest yet."
            />
            <EngineConsoleCodeSection
              title="Corpus test"
              language="ts"
              :result="selectedEntry.sourceFiles.corpusTest"
              not-found-label="No corpus test yet."
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
