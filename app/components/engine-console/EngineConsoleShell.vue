<script setup lang="ts">
// Shared two-pane (sidebar-nav + detail) outer shell for every
// `/app/engine/*` console tab — the structural pattern
// `/app/keywords/[[slug]].vue` established first (sidebar w/ search+filter+
// list on the left, one entry's detail on the right), extracted here so
// four tab pages share ONE copy of it instead of each re-declaring the
// nav / `mx-auto max-w-4xl` detail-pane markup independently (three of
// them already had, byte-for-byte, before this consolidation). Nav width
// used to be a fixed `w-[240px]`; see the drag-to-resize block below for
// why/how that became user-adjustable.
//
// Renders `EngineConsoleTabs` at the very top of the nav pane itself (not
// above the whole shell) per this task's own placement call — "tabs sit at
// the top of the left sidebar panel."
//
// Prev/next lives in the DETAIL pane's own header row (not the sidebar) —
// this task left the exact placement up to this agent; the detail pane
// reads better here since that's where the "which entry am I looking at"
// context already sits, and it's the one spot common to every tab
// regardless of how different their row/list markup is.
//
// Left/Right arrow-key navigation (added alongside the `hideNav` prop
// below, same task): lives HERE rather than in `useStatusFilterList.ts`
// itself, since the composable has no notion of "the page" (no DOM/focus
// access) — this shell is the one thing already common to all four tabs
// and already holds `canPrev`/`canNext`/the `prev`/`next` emits, so a single
// `window` keydown listener here covers every caller for free. Guarded
// against firing while the user is typing (any focused `<input>`/
// `<textarea>`/`<select>`/`contenteditable` element) and against OS/browser
// shortcut chords (any of ctrl/meta/alt held) — a plain arrow key is the
// only thing this claims. Bounds match whatever `canPrev`/`canNext` already
// say (no wraparound, same as the click handlers) since this only ever
// emits when the corresponding prop is already true.
import { onMounted, onUnmounted, ref, watch } from 'vue';

// Drag-to-resize nav pane — same `pointerdown`/`pointermove`/localStorage
// pattern `CardPeekPanel.vue` already established for its own resizable
// panel (see that component's header comment), just mirrored for a
// LEFT-anchored pane instead of a right-anchored one (handle sits on the
// nav's RIGHT edge here; dragging right widens it, so delta is
// `current - start`, NOT inverted like that panel's `start - current`).
// One shared width/storage key across all six `/app/engine/*` tabs
// (this shell is their one common mount point) rather than per-tab —
// "the console's sidebar width," not a per-tab preference. Kept local to
// this component (no `useGraphStore.ts`/composable extraction) since
// nothing outside this shell needs to read or react to it.
const NAV_WIDTH_MIN = 180;
const NAV_WIDTH_MAX = 480;
const NAV_WIDTH_DEFAULT = 240; // matches the pre-resize fixed `w-[240px]`
const NAV_WIDTH_STORAGE_KEY = 'mtg-visualizer-engine-console-nav-width';

function clampNavWidth(w: number): number {
  return Math.min(NAV_WIDTH_MAX, Math.max(NAV_WIDTH_MIN, w));
}

function loadNavWidth(): number {
  // Per-viewer convenience, not durable state — any localStorage failure
  // (disabled/private-mode/quota) just falls back to the default rather
  // than surfacing an error.
  try {
    if (typeof localStorage === 'undefined') return NAV_WIDTH_DEFAULT;
    const raw = Number(localStorage.getItem(NAV_WIDTH_STORAGE_KEY));
    if (Number.isFinite(raw) && raw > 0) return clampNavWidth(raw);
  } catch {
    // ignore — see comment above
  }
  return NAV_WIDTH_DEFAULT;
}

const navWidth = ref(loadNavWidth());
watch(navWidth, (w) => {
  try {
    localStorage.setItem(NAV_WIDTH_STORAGE_KEY, String(w));
  } catch {
    // ignore — see loadNavWidth() above
  }
});

let resizing = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

function startResize(e: PointerEvent) {
  // Primary button only — matches this app's other drag gestures
  // (CardPeekPanel.vue's own resize handle, graphRenderer.ts's node drags).
  if (e.button !== 0) return;
  e.preventDefault();
  resizing = true;
  resizeStartX = e.clientX;
  resizeStartWidth = navWidth.value;
  // Pointer capture so a fast drag that outpaces the thin handle still
  // keeps delivering move/up events to it.
  (e.target as Element).setPointerCapture?.(e.pointerId);
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', endResize);
}
function onResizeMove(e: PointerEvent) {
  if (!resizing) return;
  const delta = e.clientX - resizeStartX;
  navWidth.value = clampNavWidth(resizeStartWidth + delta);
}
function endResize() {
  resizing = false;
  document.body.style.userSelect = '';
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', endResize);
}

const props = withDefaults(
  defineProps<{
    pending?: boolean;
    error?: { message?: string } | null;
    canPrev: boolean;
    canNext: boolean;
    positionLabel?: string;
    /** Predicates' own 4-entry list has no real use for the visible
     * position-label + chevron-button row's screen real estate — this hides
     * ONLY that visible affordance; arrow-key navigation (below) still works
     * regardless, since it never reads this prop. */
    hideNav?: boolean;
  }>(),
  { hideNav: false },
);
const emit = defineEmits<{ prev: []; next: [] }>();

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

function onKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (isTypingTarget(e.target)) return;
  if (e.key === 'ArrowLeft') {
    if (!props.canPrev) return;
    e.preventDefault();
    emit('prev');
  } else if (e.key === 'ArrowRight') {
    if (!props.canNext) return;
    e.preventDefault();
    emit('next');
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  // Defensive — shell unmounting mid-drag isn't a normal path (navigating
  // away while holding the handle down), but cheap to guard regardless.
  if (resizing) endResize();
});
</script>

<template>
  <div class="relative flex min-h-0 flex-1">
    <div v-if="pending" class="p-6 text-xs text-muted italic">Loading…</div>
    <div v-else-if="error" class="p-6 text-xs text-error">Failed to load: {{ error.message }}</div>

    <template v-else>
      <nav
        class="flex shrink-0 flex-col overflow-y-auto bg-panel p-2.5"
        :style="{ width: `${navWidth}px` }"
      >
        <EngineConsoleTabs />
        <slot name="nav" />
      </nav>

      <!-- Drag-to-resize handle — sits at the nav/detail boundary as its
           own thin flex item (not an absolutely-positioned overlay like
           CardPeekPanel.vue's, since this pane isn't anchored to a fixed
           viewport edge) so it naturally tracks `navWidth` for free.
           Carries the visual divider border that used to live on `<nav>`
           itself, invisible until hover/active so it doesn't read as an
           extra seam at rest. -->
      <div
        class="relative w-1.5 shrink-0 cursor-col-resize touch-none bg-transparent hover:bg-produce/40 active:bg-produce/60"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        @pointerdown="startResize"
      >
        <div class="absolute inset-y-0 left-0.5 w-px bg-border-subtle"></div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-4xl">
          <div v-if="!hideNav && (positionLabel || canPrev || canNext)" class="mb-2 flex items-center justify-between">
            <span class="text-[11px] tabular-nums text-muted">{{ positionLabel }}</span>
            <div class="flex items-center gap-1">
              <UButton
                icon="i-lucide-chevron-left"
                size="xs"
                variant="subtle"
                color="neutral"
                :disabled="!canPrev"
                aria-label="Previous entry"
                @click="$emit('prev')"
              />
              <UButton
                icon="i-lucide-chevron-right"
                size="xs"
                variant="subtle"
                color="neutral"
                :disabled="!canNext"
                aria-label="Next entry"
                @click="$emit('next')"
              />
            </div>
          </div>
          <slot name="detail" />
        </div>
      </div>
    </template>
  </div>
</template>
