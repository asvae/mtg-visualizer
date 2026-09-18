<script setup lang="ts">
// Shared card-match thumbnail gallery — one tile per real matching card,
// linking through to `/app/card/<set>/<number>` when resolved (a real
// clickable route works for ANY card `server/api/card/[set]/[number].ts`
// can resolve, FDN included — not just FIN). Extracted (2026-09-18) from
// `CardDetailTabs.vue`'s own FDN "Sinks" section (per-category matches off
// `functional-model/card-interactions.ts`) so a second consumer
// (`app/pages/app/engine/sinks/[[slug]].vue`'s own "Matches" section) looks
// and behaves IDENTICALLY rather than inventing a second, worse-looking
// component — the direct fix for a real regression: the prior
// `EngineConsoleCardMatchChip.vue` (deleted) built a LIVE per-card Scryfall
// image URL client-side and fired one request per matched card (111
// simultaneous requests for a wide match list like `battlefield-presence`),
// exactly the kind of burst `server/utils/scryfallFetch.ts`'s own doc
// comment already had to solve once for this same route family. Every
// match here instead carries a server-RESOLVED `image`/`set`/
// `collectorNumber` (`server/utils/cardMeta.ts`'s
// `resolveFunctionalModelCardMeta`, cached forever per process) — this
// component does no fetching of its own at all.
export interface CardMatchGalleryEntry {
  card: string;
  image: string | null;
  set?: string;
  collectorNumber?: string;
  /** True only for a self-referential match (e.g. the card whose own page
   * this gallery renders on) — draws the same `ring-2 ring-primary`
   * self-outline both existing consumers of this shape already used before
   * extraction. */
  self?: boolean;
}

defineProps<{ matches: CardMatchGalleryEntry[] }>();
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <NuxtLink
      v-for="m in matches"
      :key="m.card"
      :to="m.set && m.collectorNumber ? `/app/card/${m.set}/${m.collectorNumber}` : undefined"
      class="block shrink-0 rounded-md"
      :class="[{ 'pointer-events-none': !(m.set && m.collectorNumber) }, m.self ? 'ring-2 ring-primary' : '']"
      :title="m.self ? 'This card' : undefined"
    >
      <img v-if="m.image" :src="m.image" :alt="m.card" class="block w-[220px] min-w-0 rounded-md" />
      <span v-else class="flex h-[307px] w-[220px] items-center justify-center rounded-md bg-bg text-center text-xs text-muted">{{
        m.card
      }}</span>
    </NuxtLink>
  </div>
</template>
