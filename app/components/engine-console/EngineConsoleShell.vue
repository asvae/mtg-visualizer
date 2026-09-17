<script setup lang="ts">
// Shared two-pane (sidebar-nav + detail) outer shell for every
// `/app/engine/*` console tab — the structural pattern
// `/app/keywords/[[slug]].vue` established first (sidebar w/ search+filter+
// list on the left, one entry's detail on the right), extracted here so
// four tab pages share ONE copy of it instead of each re-declaring the
// `w-[240px]` nav / `mx-auto max-w-4xl` detail-pane markup independently
// (three of them already had, byte-for-byte, before this consolidation).
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
defineProps<{
  pending?: boolean;
  error?: { message?: string } | null;
  canPrev: boolean;
  canNext: boolean;
  positionLabel?: string;
}>();
defineEmits<{ prev: []; next: [] }>();
</script>

<template>
  <div class="relative flex min-h-0 flex-1">
    <div v-if="pending" class="p-6 text-xs text-muted italic">Loading…</div>
    <div v-else-if="error" class="p-6 text-xs text-error">Failed to load: {{ error.message }}</div>

    <template v-else>
      <nav class="flex w-[240px] min-w-[240px] flex-col overflow-y-auto border-r border-border-subtle bg-panel p-2.5">
        <EngineConsoleTabs />
        <slot name="nav" />
      </nav>

      <div class="min-h-0 flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-4xl">
          <div v-if="positionLabel || canPrev || canNext" class="mb-2 flex items-center justify-between">
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
