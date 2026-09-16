<script setup lang="ts">
import { inject } from 'vue';
import { StoreKey } from '../../composables/useGraphStore';

definePageMeta({ layout: 'graph' });
useHead({ title: 'MtG Synergy Map' });

const store = inject(StoreKey)!;
</script>

<template>
  <!-- 2026-09-16: outer row split into two real flex siblings — the content
       area (FilterPanel + GraphCanvas/ListView + this view's own floating
       controls, all still positioned relative to EACH OTHER exactly as
       before) and CardPeekPanel. Previously CardPeekPanel was `absolute
       inset-y-0 right-0` INSIDE the single wrapper below, overlaying (and
       blocking clicks into) whatever sat at the right edge of the content
       area — now it's a normal flex item that takes real width from this
       row, so the content area's own `flex-1` shrinks to make room instead
       of anything being covered. See CardPeekPanel.vue's own header comment
       for the fuller before/after.

       Both `min-w-0`s below matter, not just cosmetic: this page's root is
       itself a flex item of layouts/graph.vue's own outer row, and the
       content wrapper is in turn a flex item of THIS row (alongside
       CardPeekPanel) — without an explicit override, a flex item's default
       `min-width: auto` is its content's own min-content width, which can
       stop it shrinking to make room for a sibling taking real space (see
       app/pages/app/status/index.vue's own near-identical comment for the
       concrete before/after numbers this exact issue produced there).
       GraphCanvas's own SVG (a replaced element, not a wide plain div) is
       confirmed NOT to trigger this in practice (live-verified: panel open
       shrinks the SVG by exactly the panel's own width, no overshoot even
       without these), but keeping both explicit is cheap and matches the
       status page's own now-required fix, rather than leaving this page's
       correctness resting on an SVG-specific sizing quirk that a future
       change to what's inside `.relative.flex` here could quietly break. -->
  <div class="flex min-h-0 min-w-0 flex-1">
    <div class="relative flex min-h-0 min-w-0 flex-1">
      <FilterPanel />
      <!-- PRD 04 "List view" — a second, functionally-parallel renderer over
           the exact same store.graph the graph view reads; only which
           component is mounted changes, no separate data path. -->
      <template v-if="store.graph.value">
        <GraphCanvas v-if="store.viewMode.value === 'graph'" :graph="store.graph.value" />
        <ListView v-else :graph="store.graph.value" />
      </template>
      <div v-else-if="store.loading.value" class="flex flex-1 items-center justify-center">
        <div
          class="size-8 animate-spin rounded-full border-[3px] border-border border-t-produce"
          aria-hidden="true"
        ></div>
      </div>

      <!-- PRD 04 "List view" — Graph/List renderer toggle. Moved here from
           AppHeader.vue (was header chrome; this is a property of the
           graph/list view itself), floating bottom-center over the view area —
           same "absolute ... bottom-3 z-10" floating-control convention the
           gravity-mode/PhysicsControls pair already uses in layouts/graph.vue
           (which floats bottom-RIGHT over this same relative area), just
           centered instead so the two floating groups don't collide.
           Positioned relative to THIS wrapper (content area only, excluding
           CardPeekPanel — see the outer div's own comment above) so it stays
           centered over the graph/list view itself once the peek panel takes
           real width on the right, rather than drifting off-center toward it.
           UFieldGroup (Nuxt UI v4's real button-joining component) replaces
           the old UButtonGroup, which doesn't exist in this UI version and was
           silently rendering unjoined buttons. -->
      <div v-if="store.graph.value" class="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
        <UFieldGroup size="sm">
          <UButton
            icon="i-lucide-network"
            :color="store.viewMode.value === 'graph' ? 'primary' : 'neutral'"
            :variant="store.viewMode.value === 'graph' ? 'solid' : 'subtle'"
            aria-label="Graph view"
            @click="store.viewMode.value = 'graph'"
          >
            Graph
          </UButton>
          <UButton
            icon="i-lucide-table"
            :color="store.viewMode.value === 'list' ? 'primary' : 'neutral'"
            :variant="store.viewMode.value === 'list' ? 'solid' : 'subtle'"
            aria-label="List view"
            @click="store.viewMode.value = 'list'"
          >
            List
          </UButton>
        </UFieldGroup>
      </div>
    </div>

    <!-- PRD 02 "Navigation" — mounted ONLY here (the graph page) and
         app/pages/app/status/index.vue, never from the card detail page's
         own route: that's what actually guarantees a direct visit to
         /app/card/[set]/[number] never shows this, whatever `?card=`
         happens to be in the URL at the time. -->
    <CardPeekPanel />
  </div>
</template>
