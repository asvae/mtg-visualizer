<script setup lang="ts">
// PRD 02 "Navigation" — Notion-style peek panel. Mounted from
// `app/pages/app/index.vue` (the graph page) and, since the fact-authoring
// status dashboard (2026-09-16), `app/pages/app/status/index.vue` too —
// NOT from the card detail page's own route — which is what actually
// guarantees a direct visit to `/app/card/[set]/[number]` never
// shows this, regardless of whatever `?card=` happens to be in the URL. Open/closed state and which card is
// shown both live entirely on `store.panelCardKey` (useGraphStore.ts's own
// `?card=`-URL-backed computed) — no separate local "is open" ref to drift
// out of sync with it.
//
// 2026-09-16: REWORKED from an `absolute inset-y-0 right-0` overlay (which
// covered whatever was underneath — on the graph page that meant the right
// edge of the graph AND anything docked/floating there, e.g. the gravity-
// mode/PhysicsControls corner controls, became genuinely unclickable while
// a card was peeked, not just visually obscured) into a REAL flex layout
// sibling — both mount points now wrap this component and their own main
// content area in a `flex` row, so opening the panel shrinks the content
// area's width instead of covering it. `position: relative` (was `absolute`)
// exists only so the drag handle below (itself `absolute left-0`) has a
// local anchor — this element no longer positions itself against the
// viewport/page at all. See `app/pages/app/index.vue` and
// `app/pages/app/status/index.vue` for the two call sites' own matching
// `relative flex-1` "content wrapper, panel-as-sibling" restructuring, and
// `layouts/graph.vue` for how the graph page's own floating PhysicsControls
// corner now shifts left to clear the panel's real width rather than
// sitting underneath it.
//
// 2026-09-15: renders `CardDetailTabs.vue` — the SAME shared component the
// full card page (`app/pages/app/card/[set]/[number].vue`) mounts for its
// own content — instead of this panel's own older, separate
// `CardMedia.vue`/`CardRelations.vue` pairing. That old pairing was what let
// this panel drift stale in the first place: the full page moved on to a
// Facts/Scenarios/Facts Json/Card Json/Card Definition tab strip a while
// back and dropped `CardRelations` entirely, but this panel kept rendering
// the old widget since nothing forced the two to stay in sync. Sharing one
// component is the actual fix, not just a content update — a future change
// to the tab set updates both places at once. `CardRelations.vue` itself is
// now unused app-wide (confirmed via grep) but left in place rather than
// deleted outright — that's a separate cleanup call, not part of this task.
// Also means this panel now shows the SAME width-agnostic content the full
// page does (Facts table, Scenarios replay, Interactions, review-status
// toggles, debug modals, all of it) rather than a cut-down subset — the
// panel is user-resizable (see the drag-handle below, up to 90vw) and
// everything in `CardDetailTabs.vue` already wraps/scrolls at narrow widths
// (the Facts table has its own horizontal scroll, Interactions' card images
// wrap), so full parity was chosen over trimming tabs for a "peek" surface;
// flagging this as a width/content-density tradeoff worth revisiting if a
// narrow default panel width reads as cramped in practice.
//
// Deliberately does NOT reuse app/lib/cardCache.ts (that cache is scoped to
// the bare `CardData` field only, for Scope/Deck — see its own header
// comment) — this panel keeps its own small in-memory-only cache of the
// FULL `CardResponse` (same shape `useFetch<CardResponse>` on the full card
// page already fetches — see app/lib/cardResponse.ts, the one shared type
// both now import) instead, scoped to exactly what `CardDetailTabs.vue`
// reads.
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue';
import { clampPanelWidth, StoreKey } from '../composables/useGraphStore';
import type { CardResponse } from '../lib/cardResponse';

const store = inject(StoreKey)!;

// Module-scope (not a ref inside this component) so it survives this
// component instance across opens/closes — re-peeking a card already seen
// this session (a very likely thing to do while exploring the graph) is
// served from here instead of re-hitting the network. Not persisted to
// localStorage (unlike app/lib/cardCache.ts) — a plain in-memory,
// session-only cache is enough for this; no PRD asked for more.
const responseCache = new Map<string, CardResponse>();

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

const data = ref<CardResponse | null>(null);
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
      const body = (await res.json()) as CardResponse;
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

function close() {
  store.closeCardPanel();
}
function expand() {
  if (!parsedKey.value) return;
  navigateTo(`/app/card/${parsedKey.value.set}/${parsedKey.value.number}`);
}

// Header title's own set/number chrome (see the template below) doubles as
// a copy-to-clipboard target — same purpose/format/feedback convention as
// `CardDetailTabs.vue`'s own Facts-tab row copy button
// (`copyFactContext`/`copiedFactKey`: brief icon swap to a checkmark, reset
// after ~1s), just for the card as a whole ("<name> (<set>/<number>)")
// rather than one fact row. A separate small ref (not shared with that
// other file's own `copiedFactKey`) since this component never has a
// `FactRow` to key off of.
const copiedHeaderRef = ref(false);
async function copyHeaderRef() {
  if (!data.value || !parsedKey.value) return;
  await navigator.clipboard.writeText(`${data.value.card.name} (${parsedKey.value.set}/${parsedKey.value.number})`);
  copiedHeaderRef.value = true;
  setTimeout(() => {
    copiedHeaderRef.value = false;
  }, 1000);
}

const panelEl = ref<HTMLElement | null>(null);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) close();
}
// Drag-to-resize — a thin handle on the panel's LEFT edge (the side facing
// the graph/list beside this panel — no longer "behind" it now that it's a
// real flex-layout sibling, not an overlay; still pinned to the right edge
// of its own flex row either way). Width lives on `store.panelWidth` (useGraphStore.ts, same
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
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  // Defensive — in case this component unmounts mid-drag (closing the panel
  // while resizing isn't a normal path today, but cheap to guard regardless).
  if (resizing) endResize();
});
</script>

<template>
  <Transition name="peek-width">
    <aside
      v-if="isOpen"
      ref="panelEl"
      class="relative z-10 flex min-h-0 shrink-0 flex-col border-l border-border bg-panel"
      :style="{ width: `${store.panelWidth.value}px`, maxWidth: '90vw' }"
      role="dialog"
      aria-label="Card preview"
    >
      <!-- Drag-to-resize handle — left edge (facing the graph/list beside
           this panel). A few px wide for an easy grab target, itself
           invisible until hover/active so it doesn't read as a stray UI
           seam at rest. Direct child of the `<aside>` itself (NOT the
           scrollable content div below) so it stays pinned to the panel's
           own layout box — `position: absolute` positions against the
           nearest positioned ancestor's PADDING box, and if that ancestor
           is also the scroll container, an absolute child scrolls along
           with its content (moves as the panel scrolls) instead of staying
           fixed to the panel edge. Splitting scroll onto an inner wrapper
           keeps the `<aside>` itself static so this handle doesn't drift. -->
      <div
        class="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize touch-none bg-transparent hover:bg-produce/40 active:bg-produce/60"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize card preview panel"
        @pointerdown="startResize"
      ></div>
      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-baseline gap-2">
          <h2 class="truncate text-sm font-semibold text-text">
            {{ data?.card.name ?? (parsedKey ? `${parsedKey.set}/${parsedKey.number}` : '') }}
          </h2>
          <!-- Set/collector-number chrome, panel-level only (not
               `FunctionalModelText.vue`'s own printed-card-content name
               row, which the "never add icons/text to card content" rule
               keeps off limits) — same `${set}/${number}` formatting
               `CardDetailTabs.vue`'s own `factContextText()` already uses
               for its copy-to-clipboard card reference. Only shown once
               `data` has actually resolved — the `h2` above already falls
               back to this exact string itself while `data` is still
               loading, so showing it twice during that window would be a
               visible duplicate. Doubles as a copy-to-clipboard trigger
               (`copyHeaderRef`) — clicking the text itself copies
               "<name> (<set>/<number>)", no separate button element; same
               brief checkmark-swap feedback convention as the Facts tab's
               own row copy icon (`copiedFactKey` there, `copiedHeaderRef`
               here). -->
          <span
            v-if="data && parsedKey"
            class="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted hover:text-text"
            :title="copiedHeaderRef ? 'Copied!' : 'Copy card reference (name + set/number)'"
            @click="copyHeaderRef"
          >
            {{ parsedKey.set }}/{{ parsedKey.number }}
            <Icon :name="copiedHeaderRef ? 'lucide:check' : 'lucide:copy'" class="h-3 w-3" />
          </span>
        </div>
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

      <!-- Stands in for the card IMAGE itself only (CardImageSkeleton.vue),
           not a full-panel loading state — no centering wrapper, same
           top-left position CardDetailTabs.vue's own `items-start`
           image+table row places CardMedia once loaded. -->
      <CardImageSkeleton v-if="loading && !data" />
      <div v-else-if="notFound" class="text-sm text-muted">Card not found.</div>
      <template v-else-if="data && parsedKey">
        <CardDetailTabs :data="data" :set="parsedKey.set" :number="parsedKey.number" />
      </template>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
/* 2026-09-16: was a `translateX(100%)` slide — the right animation primitive
   for an overlay sliding in OVER content, but this panel is now a real flex
   sibling that SQUEEZES its neighbor's width instead of covering it, so the
   thing that needs to animate is its own `width` (the element's real layout
   box), not a transform. `overflow: hidden` during the transition keeps the
   panel's own content from visibly reflowing/spilling at the intermediate,
   narrower-than-final widths mid-animation. The `!important` on `width: 0`
   is required to win over this element's own inline `:style="{ width: ...
   }"` binding (higher specificity than a plain class rule) for exactly the
   enter-from/leave-to frame — the moment Vue swaps to `-active` and drops
   `-from`, the browser transitions FROM that last-applied 0 value TOWARD
   the now-unopposed inline width, which is the real "squeeze open" effect.
   The GraphCanvas SVG (`flex: 1; width: 100%`, see that component's own
   <style>) and the status-page grid's own `flex-1` wrapper absorb the
   freed/reclaimed space automatically via normal flexbox reflow each
   animation frame — no JS-driven resize logic needed on either side, and
   critically: nothing recomputes the graph's own coordinate system or
   camera/zoom transform in response (graphRenderer.ts's `width`/`height`
   are captured ONCE at renderer-creation time and never re-read on resize —
   confirmed no ResizeObserver/window-resize listener exists anywhere in
   this app), so the visible viewport clips/reveals more of the SAME fixed
   node layout as it resizes instead of the simulation recentering under it. */
.peek-width-enter-active,
.peek-width-leave-active {
  transition: width 150ms ease;
  overflow: hidden;
}
.peek-width-enter-from,
.peek-width-leave-to {
  width: 0 !important;
}
</style>
