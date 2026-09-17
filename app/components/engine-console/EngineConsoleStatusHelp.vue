<script setup lang="ts" generic="C extends string">
// Content for `EngineConsoleStatusFilterControls.vue`'s own `#help` slot —
// renders each `STATUS_OPTIONS` entry's color dot + label + its already-
// authored `description` (same source the status-filter buttons' own
// `title` attribute uses, just surfaced in full here rather than only on
// hover), plus a per-tab default slot underneath for the "how you get from
// one status to another" flow explanation, which is genuinely different
// per tab and so left to the caller rather than authored here.
import type { StatusFilterOption } from '../../composables/useStatusFilterList';

defineProps<{ statusOptions: StatusFilterOption<C>[] }>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="opt in statusOptions" :key="opt.value" class="flex items-start gap-1.5">
      <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: opt.color }"></span>
      <div><span class="font-medium text-text">{{ opt.label }}</span> — {{ opt.description }}</div>
    </div>
    <div class="my-1 border-t border-border"></div>
    <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">How statuses change</div>
    <div class="flex flex-col gap-1.5 leading-relaxed">
      <slot />
    </div>
  </div>
</template>
