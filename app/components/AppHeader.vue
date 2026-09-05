<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import { StoreKey, DECK_TEXT_STORAGE_KEY, DECK_ACTIVE_KEY, QUERY_ACTIVE_KEY } from '../composables/useGraphStore';
import { parseDecklist } from '../lib/deckImport';

const store = inject(StoreKey)!;
const config = useRuntimeConfig();
const reviewEnabled = config.public.enableReview;
const appVersion = config.public.appVersion;
const buildCommit = config.public.buildCommit;

// Card-filter modal — two modes sharing one dialog, both a real navigation
// on submit (SET_CODE/scryfallQuery/deckImportActive in useGraphStore.ts are
// all fixed at module-load time), so `submitting` just covers the brief
// window between clicking Apply/Import and the browser actually unloading
// this page.
const filterOpen = ref(false);
const filterMode = ref<'scryfall' | 'deck'>('scryfall');
const filterModeTabs = [
  { label: 'Scryfall query', value: 'scryfall' as const },
  { label: 'Import deck', value: 'deck' as const },
];
const scryfallQuery = ref('');
const deckText = ref('');
// "Global filter by deck" — off by default. On: importing replaces the
// whole app's card set with just the deck (today's only prior behavior,
// same as a Scryfall query). Off: the deck is still "known" (see
// getKnownDeckCards in useGraphStore.ts) so matching cards still get their
// ×N badge everywhere — main graph nodes and the card detail page's own
// title badge — but nothing else is hidden or restricted; Previous/Next on
// the card page stays scoped to whatever WAS already active (a real
// Scryfall query, or nothing) rather than jumping to the deck.
const deckGlobalFilter = ref(false);
const submitting = ref(false);

// Live "N cards recognized" feedback as the user pastes/edits — parsing is
// cheap (a plain-text scan) so this re-runs on every keystroke rather than
// only at submit time, the same way a "characters remaining" counter would.
const parsedDeckCards = computed(() => parseDecklist(deckText.value));
const parsedDeckCount = computed(() => parsedDeckCards.value.reduce((n, c) => n + c.qty, 0));

function openFilterDialog() {
  scryfallQuery.value = new URLSearchParams(window.location.search).get('sf') ?? '';
  let deckActive = false;
  try {
    deckActive = localStorage.getItem(DECK_ACTIVE_KEY) === '1';
    deckText.value = localStorage.getItem(DECK_TEXT_STORAGE_KEY) ?? '';
  } catch {
    deckText.value = '';
  }
  deckGlobalFilter.value = deckActive;
  // Reopen on whichever mode is currently active/known, so editing an
  // existing deck import (global filter or not) or Scryfall query lands you
  // back on the same tab you set it from, rather than always defaulting to
  // "Scryfall query".
  filterMode.value = deckActive || deckText.value.trim() ? 'deck' : 'scryfall';
  submitting.value = false;
  filterOpen.value = true;
}

function submitScryfallQuery(clear = false) {
  if (submitting.value) return;
  submitting.value = true;
  // Applying (or clearing) a Scryfall query is a deliberate switch away from
  // deck mode either way — without this, a later plain `/app` visit would
  // resurrect the deck-active flag and land back in deck mode instead of the
  // base set, since that flag has no URL of its own to naturally expire.
  try {
    localStorage.removeItem(DECK_ACTIVE_KEY);
  } catch {
    // storage blocked — nothing to clean up either way
  }
  const q = clear ? '' : scryfallQuery.value.trim();
  // Sticky breadcrumb for the standalone card detail page (see
  // QUERY_ACTIVE_KEY's own comment in useGraphStore.ts) — kept in sync with
  // whatever this navigation is actually about to show, same as the URL
  // itself but readable from a tab with no query string of its own.
  try {
    if (q) localStorage.setItem(QUERY_ACTIVE_KEY, q);
    else localStorage.removeItem(QUERY_ACTIVE_KEY);
  } catch {
    // storage blocked — the card detail page just won't know a query's active
  }
  window.location.href = q ? `/app?sf=${encodeURIComponent(q)}` : '/app';
}

function submitDeckImport(clear = false) {
  if (submitting.value) return;
  submitting.value = true;
  if (clear) {
    try {
      localStorage.removeItem(DECK_TEXT_STORAGE_KEY);
      localStorage.removeItem(DECK_ACTIVE_KEY);
    } catch {
      // storage blocked — reload on its own still clears the known deck
    }
    // Reload wherever you already are rather than forcing `/app` — clearing
    // the deck is just forgetting it (no more ×N badges anywhere), not
    // necessarily also meaning "go back to the main graph." If it WAS the
    // active global filter, useGraphStore.ts's own SET_CODE logic (driven by
    // DECK_ACTIVE_KEY, now gone) falls back to plain FIN browsing on this
    // same reload, same end state the old forced `/app` reached.
    window.location.reload();
    return;
  }
  try {
    localStorage.setItem(DECK_TEXT_STORAGE_KEY, deckText.value);
    if (deckGlobalFilter.value) {
      localStorage.setItem(DECK_ACTIVE_KEY, '1');
      // Becoming the active global filter is a deliberate switch away from
      // query mode, same as the reverse in submitScryfallQuery — otherwise
      // the card detail page (whose getActiveFilterMode() checks deck
      // first, but shouldn't need to rely on that tiebreak) would still see
      // a stale query alongside the new deck. Left untouched when the
      // checkbox is OFF — a known-but-not-global deck shouldn't knock out
      // whatever query the user is actually browsing.
      localStorage.removeItem(QUERY_ACTIVE_KEY);
    } else {
      localStorage.removeItem(DECK_ACTIVE_KEY);
    }
  } catch {
    // storage full/blocked — the navigation below will just find nothing
    // saved and useGraphStore.ts's load() will surface "no cards recognized"
    // (global-filter case) or simply show no badges (known-only case)
  }
  // Global filter: same "go to the main graph" behavior a Scryfall query
  // apply already has — no `?deck=1` needed, SET_CODE picks DECK_ACTIVE_KEY
  // back up on its own (see useGraphStore.ts). Known-only: just reload
  // wherever you are so the newly-known deck's badges show up right away,
  // without discarding whatever set/query you were actually looking at.
  if (deckGlobalFilter.value) window.location.href = '/app';
  else window.location.reload();
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

    <div class="flex shrink-0 items-baseline gap-1.5">
      <h1 class="m-0 text-sm font-medium text-muted">MtG Synergy Map</h1>
      <span class="text-[10px] text-muted/70">v{{ appVersion }} · {{ buildCommit }}</span>
    </div>

    <div class="ml-auto flex shrink-0 items-center gap-1.5">
      <UButton
        icon="i-lucide-search-code"
        color="neutral"
        variant="subtle"
        square
        aria-label="Filter by Scryfall query or deck import"
        @click="openFilterDialog"
      />
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
            <div>Click a card to open its own page — hover for a Scryfall shortcut</div>
          </div>
        </template>
      </UPopover>
    </div>
  </header>

  <UModal v-model:open="filterOpen" title="Card filter">
    <template #body>
      <UTabs
        v-model="filterMode"
        :items="filterModeTabs"
        size="xs"
        class="mb-3"
        :ui="{ list: submitting ? 'pointer-events-none opacity-60' : '' }"
      />

      <!-- Fixed min-height, sized to the taller (deck-import) tab's content —
           without it, switching to the shorter Scryfall-query tab shrinks the
           modal and the footer buttons jump up. -->
      <div class="min-h-[290px]">
        <template v-if="filterMode === 'scryfall'">
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

      <template v-else>
        <div class="mb-3 flex items-center gap-1.5 text-xs leading-relaxed text-muted">
          <span>Paste a decklist from anywhere — matching cards get a ×N badge wherever they show up.</span>
          <UPopover :content="{ side: 'top' }" mode="hover">
            <UIcon name="i-lucide-info" class="shrink-0 text-muted" />
            <template #content>
              <div class="flex w-72 flex-col gap-1.5 p-3 text-xs text-muted">
                <div class="text-[10px] font-semibold tracking-wide text-muted uppercase">Accepted formats</div>
                <div>Any mix of these, one card per line:</div>
                <code class="rounded bg-bg px-1.5 py-1 text-[11px] text-text">4 Lightning Bolt</code>
                <code class="rounded bg-bg px-1.5 py-1 text-[11px] text-text">4x Lightning Bolt</code>
                <code class="rounded bg-bg px-1.5 py-1 text-[11px] text-text">1 Jeweled Lotus (CMR) 319</code>
                <code class="rounded bg-bg px-1.5 py-1 text-[11px] text-text">4 Island|TMP|1</code>
                <div class="mt-1">
                  Works with exports from MTGO, MTG Arena, Moxfield, Archidekt, TappedOut, MTGGoldfish, and Forge's own <code>.dck</code> files.
                </div>
                <div>
                  <code>Sideboard</code>/<code>Maybeboard</code> sections (or Forge's own <code>[sideboard]</code>) are recognized and left out —
                  only the main deck is used. <code>#</code>/<code>//</code> comment lines are ignored.
                </div>
              </div>
            </template>
          </UPopover>
        </div>
        <UTextarea
          v-model="deckText"
          class="w-full"
          placeholder="4 Lightning Bolt&#10;2x Counterspell&#10;1 Jeweled Lotus (CMR) 319&#10;…"
          :rows="10"
          autofocus
          :disabled="submitting"
        />
        <div class="mt-1.5 text-[11px] text-muted">
          <template v-if="deckText.trim()">{{ parsedDeckCount }} card{{ parsedDeckCount === 1 ? '' : 's' }} recognized</template>
          <template v-else>&nbsp;</template>
        </div>
        <UCheckbox
          v-model="deckGlobalFilter"
          class="mt-2.5"
          label="Global filter by deck"
          description="Hide everything else — the graph (and Previous/Next on a card page) only shows these cards, same as a Scryfall query."
          :disabled="submitting"
        />
      </template>
      </div>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="subtle" :disabled="submitting" @click="close">Cancel</UButton>
        <UButton
          v-if="filterMode === 'scryfall'"
          color="neutral"
          variant="subtle"
          :disabled="submitting"
          @click="submitScryfallQuery(true)"
        >
          Clear filter
        </UButton>
        <UButton v-else color="neutral" variant="subtle" :disabled="submitting" @click="submitDeckImport(true)">Clear filter</UButton>
        <UButton
          v-if="filterMode === 'scryfall'"
          color="primary"
          :loading="submitting"
          @click="submitScryfallQuery()"
        >
          {{ submitting ? 'Applying…' : 'Apply' }}
        </UButton>
        <UButton v-else color="primary" :loading="submitting" :disabled="parsedDeckCount === 0" @click="submitDeckImport()">
          {{ submitting ? 'Importing…' : 'Import' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
