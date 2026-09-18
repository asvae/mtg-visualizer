<script setup lang="ts">
// One real, clickable card representation for a "Real FDN pool matches" row
// (`app/pages/app/engine/sinks/[[slug]].vue`'s `producerMatches`/
// `consumerMatches` — plain card-name strings, no set/number of their own).
// Was a bare mono-font text pill; this renders a small lazy-loaded thumbnail
// + the real name, linking through to that card's own detail page
// (`/app/engine/cards/fdn/<number>`) when the page-level name->number
// lookup resolves it.
//
// Thumbnail is Scryfall's own documented "drop this straight into an <img
// src>" redirect endpoint (`GET /cards/named?exact=...&format=image`) — no
// JSON round-trip, no server involvement, same direct-hotlink-to-Scryfall's-
// CDN posture `CardMedia.vue` already uses for the full card image
// elsewhere in this app. Each request is a plain browser-native image
// fetch, `loading="lazy"` so a chip sitting inside this page's collapsed
// `<details>` producer/consumer sections never fires until actually opened
// — cheap even when a match list runs into the dozens, no per-row JS/fetch
// work of our own either way.
import { computed, ref } from 'vue';

const props = defineProps<{
  name: string;
  /** This card's real FDN collector number, if the page's own
   * name->number lookup (`/api/card-status/fdn`) resolved it — `undefined`
   * renders a non-linking chip instead of guessing/omitting the card
   * entirely (still names + thumbnails it, just can't route to it). */
  number?: string;
}>();

const href = computed(() => (props.number ? `/app/engine/cards/fdn/${encodeURIComponent(props.number)}` : null));
const thumbSrc = computed(
  () => `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(props.name)}&format=image&version=small`,
);

// A handful of real match names won't resolve cleanly against Scryfall's
// own `exact` lookup (an in-progress FDN card whose name diverges slightly
// from what's live on Scryfall today, a DFC's `//`-joined full name, etc.)
// — degrade to a plain placeholder swatch rather than a broken-image icon.
const imgFailed = ref(false);
</script>

<template>
  <!-- Two real, separate branches (not a dynamic `:is="href ? 'NuxtLink' :
       'span'"`) — that dynamic form resolves `'NuxtLink'` as a literal,
       unregistered custom element (renders as an inert `<nuxtlink>` tag,
       verified live: no real `<a>`, no navigation) rather than the actual
       component; `RecognizerEntryCard.vue`'s own matched-card chip list
       already established this same v-if/v-else split for the exact same
       "not every match resolves to a real route" case, mirrored here. -->
  <NuxtLink
    v-if="href"
    :to="href"
    class="flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg py-1 pr-2 pl-1 text-[11px] text-text hover:border-border hover:bg-surface"
    :title="name"
  >
    <img
      v-if="!imgFailed"
      :src="thumbSrc"
      :alt="name"
      loading="lazy"
      decoding="async"
      class="h-8 w-6 shrink-0 rounded-[2px] bg-panel object-cover"
      @error="imgFailed = true"
    />
    <span
      v-else
      class="h-8 w-6 shrink-0 rounded-[2px]"
      style="background-image: repeating-linear-gradient(135deg, var(--color-border-subtle) 0px, var(--color-border-subtle) 4px, var(--color-panel) 4px, var(--color-panel) 8px)"
      aria-hidden="true"
    ></span>
    <span class="truncate">{{ name }}</span>
  </NuxtLink>
  <span
    v-else
    class="flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg py-1 pr-2 pl-1 text-[11px] text-muted italic"
    :title="`${name} — not found in the fdn card-status list, no card page to link to`"
  >
    <img
      v-if="!imgFailed"
      :src="thumbSrc"
      :alt="name"
      loading="lazy"
      decoding="async"
      class="h-8 w-6 shrink-0 rounded-[2px] bg-panel object-cover"
      @error="imgFailed = true"
    />
    <span
      v-else
      class="h-8 w-6 shrink-0 rounded-[2px]"
      style="background-image: repeating-linear-gradient(135deg, var(--color-border-subtle) 0px, var(--color-border-subtle) 4px, var(--color-panel) 4px, var(--color-panel) 8px)"
      aria-hidden="true"
    ></span>
    <span class="truncate not-italic">{{ name }}</span>
  </span>
</template>
