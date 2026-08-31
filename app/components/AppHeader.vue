<script setup lang="ts">
import { ref, inject } from 'vue';
import { StoreKey } from '../composables/useGraphStore';

const store = inject(StoreKey)!;
const config = useRuntimeConfig();
const reviewEnabled = config.public.enableReview;

// Scryfall query modal — a real navigation on submit (SET_CODE/scryfallQuery
// in useGraphStore.ts are fixed at module-load time), so `submitting` just
// covers the brief window between clicking Apply and the browser actually
// unloading this page.
const scryfallOpen = ref(false);
const scryfallQuery = ref('');
const submitting = ref(false);

function openScryfallDialog() {
  scryfallQuery.value = new URLSearchParams(window.location.search).get('sf') ?? '';
  submitting.value = false;
  scryfallOpen.value = true;
}

function submitScryfallQuery(clear = false) {
  if (submitting.value) return;
  submitting.value = true;
  const q = clear ? '' : scryfallQuery.value.trim();
  window.location.href = q ? `/app?sf=${encodeURIComponent(q)}` : '/app';
}
</script>

<template>
  <header class="flex items-center gap-3.5 border-b border-border-subtle bg-panel px-4 py-2.5">
    <UButton
      icon="i-lucide-menu"
      color="neutral"
      variant="subtle"
      square
      aria-label="Toggle themes panel"
      @click="store.panelOpen.value = !store.panelOpen.value"
    />

    <NuxtLink to="/" class="flex shrink-0 items-center text-text no-underline" aria-label="Back to landing page">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" class="shrink-0 text-muted">
        <circle cx="12" cy="5" r="2.4" fill="var(--color-produce)" />
        <circle cx="5" cy="17" r="2.4" fill="var(--color-consume)" />
        <circle cx="19" cy="17" r="2.4" fill="var(--color-magnifier)" />
        <line x1="12" y1="5" x2="5" y2="17" stroke="currentColor" stroke-width="1.4" />
        <line x1="12" y1="5" x2="19" y2="17" stroke="currentColor" stroke-width="1.4" />
        <line x1="5" y1="17" x2="19" y2="17" stroke="currentColor" stroke-width="1.4" />
      </svg>
    </NuxtLink>

    <UInput
      v-model="store.searchQuery.value"
      class="w-56"
      placeholder="Search cards or themes…"
      icon="i-lucide-search"
      autocomplete="off"
      size="sm"
    >
      <template v-if="store.searchQuery.value" #trailing>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          aria-label="Clear search"
          @click="store.searchQuery.value = ''"
        />
      </template>
    </UInput>

    <h1 class="m-0 shrink-0 text-sm font-medium text-muted">MtG Synergy Map</h1>

    <div class="ml-auto flex shrink-0 items-center gap-1.5">
      <UButton
        icon="i-lucide-search-code"
        color="neutral"
        variant="subtle"
        square
        aria-label="Scryfall query filter"
        @click="openScryfallDialog"
      />
      <PhysicsControls />
      <UButton
        v-if="reviewEnabled"
        icon="i-lucide-clipboard-list"
        color="neutral"
        variant="subtle"
        square
        aria-label="Card review session"
        @click="store.reviewSessionOpen.value = !store.reviewSessionOpen.value"
      />

      <UPopover :content="{ side: 'bottom', align: 'end' }">
        <UButton icon="i-lucide-circle-help" color="neutral" variant="subtle" square aria-label="Show legend" />
        <template #content>
          <div class="flex w-56 flex-col gap-2 p-3 text-xs text-muted">
            <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Relations</div>
            <div class="flex items-center gap-1.5" title="Generates or creates more of this theme's resource.">
              <span class="h-[3px] w-3.5 rounded-sm bg-produce"></span>Produces
              <span class="text-[10px] text-muted">?</span>
            </div>
            <div class="flex items-center gap-1.5" title="Reads or reacts to this theme's resource that's already present.">
              <span class="h-[3px] w-3.5 rounded-sm bg-consume"></span>Consumes
              <span class="text-[10px] text-muted">?</span>
            </div>
            <div class="flex items-center gap-1.5" title="Relates to the theme but doesn't cleanly produce, consume, grant, or magnify it.">
              <span
                class="h-[3px] w-3.5 rounded-sm"
                style="background: repeating-linear-gradient(90deg, var(--color-atypical) 0 4px, transparent 4px 7px)"
              ></span>
              Atypical
              <span class="text-[10px] text-muted">?</span>
            </div>
            <div class="flex items-center gap-1.5" title="Extends an ability to another permanent rather than using it itself.">
              <span
                class="h-[3px] w-3.5 rounded-sm"
                style="background: repeating-linear-gradient(90deg, var(--color-grant) 0 4px, transparent 4px 7px)"
              ></span>
              Grant
              <span class="text-[10px] text-muted">?</span>
            </div>
            <div class="flex items-center gap-1.5" title="Doubles or amplifies an effect that's already happening.">
              <span
                class="h-[3px] w-3.5 rounded-sm"
                style="background: repeating-linear-gradient(90deg, var(--color-magnifier) 0 4px, transparent 4px 7px)"
              ></span>
              Magnifier
              <span class="text-[10px] text-muted">?</span>
            </div>

            <div class="my-0.5 border-t border-border"></div>
            <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Graph</div>
            <div>Thicker edge = stronger theme tie</div>
            <div>Dashed edge = also atypical, grant, or magnifier — or the card ties to that theme via more than one relation</div>
            <div class="flex items-center gap-1.5">
              <span class="size-3 shrink-0 rounded-full border border-dashed border-[#4a4d5c] bg-[#2c2e38] opacity-75"></span>
              Weak theme (no real synergy — pushed to the edges)
            </div>
            <div>Letter = rarity (U/R/M, commons unmarked)</div>
            <div>Click a card to highlight its themes, Ctrl/Cmd-click to open it on Scryfall</div>
          </div>
        </template>
      </UPopover>
    </div>
  </header>

  <UModal v-model:open="scryfallOpen" title="Scryfall query filter">
    <template #body>
      <p class="mb-3 text-xs leading-relaxed text-muted">
        Any <a class="text-text underline" href="https://scryfall.com/docs/syntax" target="_blank" rel="noopener">Scryfall search syntax</a> — the
        graph rebuilds from just the matching cards (capped at 500) instead of the bundled set.
      </p>
      <UInput
        v-model="scryfallQuery"
        class="w-full"
        placeholder="e.g. t:legendary c:red"
        autocomplete="off"
        autofocus
        :disabled="submitting"
        @keydown.enter="submitScryfallQuery()"
      />
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="subtle" :disabled="submitting" @click="close">Cancel</UButton>
        <UButton color="neutral" variant="subtle" :disabled="submitting" @click="submitScryfallQuery(true)">Clear filter</UButton>
        <UButton color="primary" :loading="submitting" @click="submitScryfallQuery()">
          {{ submitting ? 'Applying…' : 'Apply' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
