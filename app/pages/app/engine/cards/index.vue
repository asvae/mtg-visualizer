<script setup lang="ts">
// `/app/engine/cards` (bare, no set/number segment) — real two-segment
// dynamic route lives at `app/pages/app/engine/cards/[set]/[[number]].vue`
// (2026-09-18, later same day: `[set]` is now a REQUIRED first URL
// segment, not optional — a bare collector number is ambiguous once more
// than one set is selectable, since FIN and FDN each have their own
// independent collector-numbering; card identity on this tab is genuinely
// `(set, number)`, not `number` alone). This bare index just redirects to
// whatever set was last viewed (same `localStorage` key that page's own
// dropdown already persists to — read directly here too, SPA-only route,
// no SSR guard needed, same precedent `useGraphStore.ts`'s own
// module-scope restore already relies on), falling back to `'fin'` when
// nothing's stored yet. Never itself a real content page.
definePageMeta({ layout: 'graph' });

const ENGINE_SETS_LAST_SET_KEY = 'engine-sets-last-set';
const lastSet = (typeof localStorage !== 'undefined' && localStorage.getItem(ENGINE_SETS_LAST_SET_KEY)) || 'fin';
await navigateTo(`/app/engine/cards/${lastSet}`, { replace: true });
</script>

<template />
