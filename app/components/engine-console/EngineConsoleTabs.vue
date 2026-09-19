<script setup lang="ts">
// Top-of-sidebar tab bar for the `/app/engine/*` console. Each primary tab
// is its own real route (not client-side-only tab state), so a direct
// link/reload lands on the right tab per this task's own requirement.
// Deliberately only 3 primary entries: `/app/recognizers` was in scope for
// one task iteration then explicitly pulled back OUT (per an explicit
// mid-task correction — leave that page completely untouched, not linked
// here) — don't re-add a "Recognizers" tab without a fresh explicit ask.
//
// 2026-09-18, later same day, two structural changes together:
//   - "Sets" renamed "Cards" (an earlier commit) AND its real route moved
//     `/app/engine/sets` -> `/app/engine/cards` (this same pass) — see
//     `app/pages/app/engine/cards/`.
//   - Keywords dropped from the primary row entirely (explicit user
//     ask — "doesn't want to see Keywords in the main row day-to-day but
//     still wants it reachable"), moved into a trailing "…" overflow
//     trigger instead. `/app/engine/keywords` (the route) is completely
//     unchanged — same page, same content, just no longer a primary tab
//     link here. `/app/keywords` (the older standalone route this tab's
//     content duplicates) is ALSO still left in place/linked from
//     AppHeader.vue, untouched by this reshuffle either.
// New primary order: Cards | Predicates | Features | Sinks.
//
// 2026-09-18, later same day: added "Sinks" (`/app/engine/sinks`, the
// shared sink-CATALOG review axis — genuinely different from Predicates'
// own sink-derivation-PREDICATE axis, see that page's own header),
// appended after Features per this task's own "your call, append after
// Features unless a stronger reason" instruction — still ahead of the
// Keywords overflow trigger.
//
// 2026-09-18, later still: added "Schema" (`/app/engine/schema`) to the
// "…" overflow, same convention as Keywords — a static read-only
// reference page (every card-authoring type, rooted at `CardDefinition`),
// not a review/status axis, so it belongs in the overflow rather than the
// primary tab row per that same "day-to-day primary row stays lean"
// rationale. Appended AFTER Keywords in the overflow list per this
// header's own convention of appending new overflow entries at the end.
//
// 2026-09-19: added "Schema (Forge)" (`/app/engine/schema-forge`) to the
// same overflow, appended after "Schema" — a sibling static reference page
// (real Forge-corpus field/param/keyword vocabulary, Markdown-rendered)
// rather than the TS-source one, labeled distinctly since both live in the
// same overflow group.
import { computed } from 'vue';

const route = useRoute();

const TABS = [
  { label: 'Cards', to: '/app/engine/cards', match: '/app/engine/cards' },
  { label: 'Predicates', to: '/app/engine/predicates', match: '/app/engine/predicates' },
  { label: 'Features', to: '/app/engine/features', match: '/app/engine/features' },
  { label: 'Matchers', to: '/app/engine/sinks', match: '/app/engine/sinks' },
];

const activeTo = computed(() => TABS.find((t) => route.path.startsWith(t.match))?.to);
const onKeywords = computed(() => route.path.startsWith('/app/engine/keywords'));
const onSchema = computed(() => route.path === '/app/engine/schema' || route.path.startsWith('/app/engine/schema/'));
const onSchemaForge = computed(() => route.path.startsWith('/app/engine/schema-forge'));
const overflowActive = computed(() => onKeywords.value || onSchema.value || onSchemaForge.value);
</script>

<template>
  <nav class="mb-2 flex gap-0.5 rounded-md bg-bg p-0.5" aria-label="Engine console tabs">
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      class="flex-1 rounded px-1.5 py-1 text-center text-[11px] font-medium"
      :class="activeTo === tab.to ? 'bg-surface text-text' : 'text-muted hover:text-text'"
    >
      {{ tab.label }}
    </NuxtLink>
    <UPopover :content="{ side: 'bottom', align: 'end' }">
      <button
        type="button"
        class="shrink-0 rounded px-2 py-1 text-center text-[11px] font-medium"
        :class="overflowActive ? 'bg-surface text-text' : 'text-muted hover:text-text'"
        aria-label="More engine console tabs"
      >
        …
      </button>
      <template #content>
        <div class="p-1">
          <NuxtLink
            to="/app/engine/keywords"
            class="block rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap"
            :class="onKeywords ? 'bg-surface text-text' : 'text-muted hover:bg-surface hover:text-text'"
          >
            Keywords
          </NuxtLink>
          <NuxtLink
            to="/app/engine/schema"
            class="block rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap"
            :class="onSchema ? 'bg-surface text-text' : 'text-muted hover:bg-surface hover:text-text'"
          >
            Schema
          </NuxtLink>
          <NuxtLink
            to="/app/engine/schema-forge"
            class="block rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap"
            :class="onSchemaForge ? 'bg-surface text-text' : 'text-muted hover:bg-surface hover:text-text'"
          >
            Schema (Forge)
          </NuxtLink>
        </div>
      </template>
    </UPopover>
  </nav>
</template>
