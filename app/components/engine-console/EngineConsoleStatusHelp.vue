<script setup lang="ts" generic="C extends string">
// Content for `EngineConsoleStatusFilterControls.vue`'s own `#help` slot —
// renders each `STATUS_OPTIONS` entry's color dot + label + its already-
// authored `description` (same source the status-filter buttons' own
// `title` attribute uses, just surfaced in full here rather than only on
// hover).
//
// 2026-09-18 redesign: the "how you get from one status to another"
// explanation below the legend used to be caller-authored prose (a
// per-page default slot). Per an explicit ask to make this a real VISUAL
// diagram (colored badges + arrows, not paragraphs), that's now built
// directly into this component and driven off the same `statusOptions`
// prop every caller already passes — no new prop plumbing, and the shape
// is byte-for-byte identical across every page that shares the real
// gray/purple/blue/yellow/green/re-review axis (Predicates/Features/Sets),
// since that's genuinely the same flow on all three (see each page's own
// `STATUS_OPTIONS` for how the per-status wording still differs).
//
// The diagram only renders when all 6 of those values are actually present
// in `statusOptions` (looked up by value, not by array position/count) —
// `keywords/[[slug]].vue`'s own 2-value covered/gap axis doesn't have any
// of them, so it falls through to the ORIGINAL default-slot prose
// mechanism below unchanged (still the only caller using it).
import { computed } from 'vue';
import type { StatusFilterOption } from '../../composables/useStatusFilterList';
import { statusBadgeStyle } from '../../lib/badgeColor';

const props = defineProps<{ statusOptions: StatusFilterOption<C>[] }>();

function find(value: string): StatusFilterOption<C> | undefined {
  return props.statusOptions.find((o) => o.value === value);
}

const flow = computed(() => {
  const gray = find('gray');
  const purple = find('purple');
  const blue = find('blue');
  const yellow = find('yellow');
  const green = find('green');
  const reReview = find('re-review');
  if (!gray || !purple || !blue || !yellow || !green || !reReview) return null;
  return { gray, purple, blue, yellow, green, reReview };
});

function badgeStyle(opt: StatusFilterOption<C>) {
  return statusBadgeStyle(opt.color);
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="opt in statusOptions" :key="opt.value" class="flex items-start gap-1.5">
      <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: opt.color }"></span>
      <div><span class="font-medium text-text">{{ opt.label }}</span> — {{ opt.description }}</div>
    </div>
    <div class="my-1 border-t border-border"></div>
    <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">How statuses change</div>

    <div v-if="flow" class="flex flex-col gap-3 py-1">
      <div>
        <div class="mb-1 text-[10px] text-muted">Computed automatically, off real evidence:</div>
        <div class="flex flex-wrap items-center gap-1">
          <UBadge :style="badgeStyle(flow.gray)" size="sm" variant="solid">{{ flow.gray.label }}</UBadge>
          <span class="text-muted">→</span>
          <UBadge :style="badgeStyle(flow.purple)" size="sm" variant="solid">{{ flow.purple.label }}</UBadge>
          <span class="text-muted">→</span>
          <UBadge :style="badgeStyle(flow.blue)" size="sm" variant="solid">{{ flow.blue.label }}</UBadge>
        </div>
      </div>

      <div>
        <div class="mb-1 text-[10px] text-muted">A human reviews the current baseline:</div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-1">
            <UBadge :style="badgeStyle(flow.blue)" size="sm" variant="solid">{{ flow.blue.label }}</UBadge>
            <span class="text-muted">→</span>
            <UBadge :style="badgeStyle(flow.yellow)" size="sm" variant="solid">{{ flow.yellow.label }}</UBadge>
            <span class="text-[10px] text-muted">(rejected, required note)</span>
          </div>
          <div class="flex items-center gap-1">
            <UBadge :style="badgeStyle(flow.blue)" size="sm" variant="solid">{{ flow.blue.label }}</UBadge>
            <span class="text-muted">→</span>
            <UBadge :style="badgeStyle(flow.green)" size="sm" variant="solid">{{ flow.green.label }}</UBadge>
            <span class="text-[10px] text-muted">(confirmed)</span>
          </div>
        </div>
      </div>

      <div>
        <div class="mb-1 text-[10px] text-muted">A confirmed entry's real inputs can later drift:</div>
        <div class="flex flex-wrap items-center gap-1">
          <UBadge :style="badgeStyle(flow.green)" size="sm" variant="solid">{{ flow.green.label }}</UBadge>
          <span class="text-muted">→</span>
          <UBadge :style="badgeStyle(flow.reReview)" size="sm" variant="solid">{{ flow.reReview.label }}</UBadge>
          <span class="text-muted">→</span>
          <UBadge :style="badgeStyle(flow.green)" size="sm" variant="solid">{{ flow.green.label }}</UBadge>
          <span class="text-[10px] text-muted">(once re-confirmed)</span>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col gap-1.5 leading-relaxed">
      <slot />
    </div>
  </div>
</template>
