<script setup lang="ts">
// PRD 02 "Navigation" — Notion-style peek panel. Only ever mounted from
// `app/pages/app/index.vue` (the graph page) — NOT from the card detail
// page's own route — which is what actually guarantees a direct visit to
// `/app/card/[set]/[number]` never shows this, regardless of whatever
// `?card=` happens to be in the URL. Open/closed state and which card is
// shown both live entirely on `store.panelCardKey` (useGraphStore.ts's own
// `?card=`-URL-backed computed) — no separate local "is open" ref to drift
// out of sync with it.
//
// Reuses CardMedia.vue/CardRelations.vue (both `card`-owned) exactly as they
// already render on the full card page / hover tooltip — same
// describeRelation/groupChipsByVerb pipeline TooltipView.vue and the card
// detail page both already use for the identical CardRelations input shape,
// not reimplemented here. Deliberately does NOT reuse app/lib/cardCache.ts
// (that cache is scoped to the bare `CardData` field only, for Scope/Deck —
// see its own header comment) since this panel additionally needs
// `edges`/`themes` for CardRelations; it keeps its own small in-memory-only
// cache of that fuller response instead, scoped to exactly what THIS
// component reads.
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue';
import { clampPanelWidth, StoreKey } from '../composables/useGraphStore';
import { describeRelation, groupChipsByVerb, type RelationColumn } from '../lib/relations';
import type { CardData, EdgeData, ThemeData } from '../types';

const store = inject(StoreKey)!;

interface PanelResponse {
  card: CardData;
  edges: EdgeData[];
  themes: ThemeData[];
}

// Module-scope (not a ref inside this component) so it survives this
// component instance across opens/closes — re-peeking a card already seen
// this session (a very likely thing to do while exploring the graph) is
// served from here instead of re-hitting the network. Not persisted to
// localStorage (unlike app/lib/cardCache.ts) — a plain in-memory,
// session-only cache is enough for this; no PRD asked for more.
const responseCache = new Map<string, PanelResponse>();

const panelKey = computed(() => store.panelCardKey.value);
const isOpen = computed(() => panelKey.value !== null);
// Parsed straight off the URL key, independent of whether the fetch below
// has resolved yet — lets Expand (and the header title's set/number
// fallback) work immediately on open, not just once `data` lands.
const parsedKey = computed<{ set: string; number: string } | null>(() => {
  const key = panelKey.value;
  if (!key) return null;
  const [set, number] = key.split('/');
  return set && number ? { set, number } : null;
});

const data = ref<PanelResponse | null>(null);
const loading = ref(false);
const notFound = ref(false);

watch(
  panelKey,
  async (key, prevKey) => {
    notFound.value = false;
    // Closing (key -> null): deliberately leave `data` as-is rather than
    // clearing it — the panel's own leave-transition still has the content
    // to animate away with instead of collapsing to blank first.
    if (!key) return;
    const cached = responseCache.get(key);
    if (cached) {
      data.value = cached;
      return;
    }
    // A genuinely different, not-yet-cached card — clear stale content
    // first so the loading state doesn't briefly show the PREVIOUS card
    // while the new one is in flight.
    if (key !== prevKey) data.value = null;
    loading.value = true;
    try {
      const [set, number] = key.split('/');
      const res = await fetch(`/api/card/${encodeURIComponent(set!)}/${encodeURIComponent(number!)}`);
      if (!res.ok) {
        notFound.value = true;
        return;
      }
      const body = (await res.json()) as PanelResponse;
      responseCache.set(key, body);
      data.value = body;
    } catch {
      notFound.value = true;
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);

const themeLabelById = computed(() => {
  const map = new Map<string, string>();
  data.value?.themes.forEach((t) => map.set(t.id, t.label));
  return map;
});
// Same chip/column pipeline TooltipView.vue and the full card page's own
// `relationChips`/`chipColumns` already use for this exact CardRelations
// input shape.
const chipColumns = computed<RelationColumn[]>(() => {
  if (!data.value) return [];
  const chips = data.value.edges.flatMap((e) => {
    const label = themeLabelById.value.get(e.theme) ?? e.theme;
    return describeRelation(label, e.role, e.weight).map((chip, i) => ({ ...chip, key: `${e.theme}-${i}` }));
  });
  return groupChipsByVerb(chips);
});

function close() {
  store.closeCardPanel();
}
function expand() {
  if (!parsedKey.value) return;
  navigateTo(`/app/card/${parsedKey.value.set}/${parsedKey.value.number}`);
}

const panelEl = ref<HTMLElement | null>(null);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) close();
}
// Click-outside — ignores clicks inside the panel itself AND inside the
// graph canvas (`#graph`, GraphCanvas.vue's own id). The graph SVG has its
// own click semantics already (a node click switches the peeked card via
// store.openCardPanel; a background click closes it via
// store.closeCardPanel) — letting this generic document-level listener ALSO
// react to a click landing inside the graph would race those: a click on a
// DIFFERENT node should switch the panel to it, not close-then-instantly-
// reopen (event order would make it close AFTER the switch already
// happened, undoing it).
function onPointerDown(e: PointerEvent) {
  if (!isOpen.value) return;
  const target = e.target as Node | null;
  if (!target) return;
  if (panelEl.value?.contains(target)) return;
  if (document.getElementById('graph')?.contains(target)) return;
  close();
}
// Drag-to-resize — a thin handle on the panel's LEFT edge (the side facing
// the graph/list, since the panel itself is pinned to the right edge of the
// viewport). Width lives on `store.panelWidth` (useGraphStore.ts, same
// persisted-UI-state pattern as `viewMode`/`gravityMode` — a plain ref
// restored from/watched into localStorage there, not a separate mechanism
// invented here) so dragging, persisting across reload, AND clamping all
// share the exact same source of truth instead of three separate copies.
let resizing = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

function startResize(e: PointerEvent) {
  // Primary button only — matches this app's other drag gestures
  // (graphRenderer.ts's own card/keyword/relation-hub drags).
  if (e.button !== 0) return;
  e.preventDefault();
  resizing = true;
  resizeStartX = e.clientX;
  resizeStartWidth = store.panelWidth.value;
  // Pointer capture keeps delivering move/up events to this element even once
  // the cursor leaves it mid-drag (a fast, wide drag easily overshoots a
  // 6px-wide handle) — without it, a move that outpaces the handle's own
  // bounds would silently stop updating until the cursor happened to re-enter.
  (e.target as Element).setPointerCapture?.(e.pointerId);
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', endResize);
}
function onResizeMove(e: PointerEvent) {
  if (!resizing) return;
  // The panel is anchored to the right edge, so dragging the LEFT-edge handle
  // further left (cursor moving to a SMALLER clientX) is what widens it —
  // delta is deliberately (start - current), not (current - start).
  const delta = resizeStartX - e.clientX;
  store.panelWidth.value = clampPanelWidth(resizeStartWidth + delta);
}
function endResize() {
  resizing = false;
  document.body.style.userSelect = '';
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', endResize);
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  document.addEventListener('pointerdown', onPointerDown);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  document.removeEventListener('pointerdown', onPointerDown);
  // Defensive — in case this component unmounts mid-drag (closing the panel
  // while resizing isn't a normal path today, but cheap to guard regardless).
  if (resizing) endResize();
});
</script>

<template>
  <Transition name="peek-slide">
    <aside
      v-if="isOpen"
      ref="panelEl"
      class="absolute inset-y-0 right-0 z-20 flex max-w-[90vw] flex-col gap-3 overflow-y-auto border-l border-border bg-panel p-4 shadow-2xl"
      :style="{ width: `${store.panelWidth.value}px` }"
      role="dialog"
      aria-label="Card preview"
    >
      <!-- Drag-to-resize handle — left edge (facing the graph/list behind
           this panel). A few px wide for an easy grab target, itself
           invisible until hover/active so it doesn't read as a stray UI
           seam at rest. -->
      <div
        class="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize touch-none bg-transparent hover:bg-produce/40 active:bg-produce/60"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize card preview panel"
        @pointerdown="startResize"
      ></div>
      <div class="flex items-center justify-between gap-2">
        <h2 class="truncate text-sm font-semibold text-text">
          {{ data?.card.name ?? (parsedKey ? `${parsedKey.set}/${parsedKey.number}` : '') }}
        </h2>
        <div class="flex shrink-0 items-center gap-1">
          <button
            type="button"
            class="rounded p-1 text-muted hover:bg-bg hover:text-text"
            title="Open full card page"
            aria-label="Open full card page"
            @click="expand"
          >
            <Icon name="lucide:maximize-2" class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded p-1 text-muted hover:bg-bg hover:text-text"
            title="Close"
            aria-label="Close card preview"
            @click="close"
          >
            <Icon name="lucide:x" class="h-4 w-4" />
          </button>
        </div>
      </div>

      <div v-if="loading && !data" class="flex flex-1 items-center justify-center">
        <div class="size-6 animate-spin rounded-full border-[3px] border-border border-t-produce" aria-hidden="true"></div>
      </div>
      <div v-else-if="notFound" class="text-sm text-muted">Card not found.</div>
      <template v-else-if="data">
        <CardMedia :images="data.card.images" :tokens="data.card.tokens" />
        <CardRelations :columns="chipColumns" />
      </template>
    </aside>
  </Transition>
</template>

<style scoped>
.peek-slide-enter-active,
.peek-slide-leave-active {
  transition: transform 150ms ease;
}
.peek-slide-enter-from,
.peek-slide-leave-to {
  transform: translateX(100%);
}
</style>
