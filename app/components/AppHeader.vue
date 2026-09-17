<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import { StoreKey, QUERY_ACTIVE_KEY, buildShareUrl } from '../composables/useGraphStore';
import { parseDecklist } from '../lib/deckImport';

const store = inject(StoreKey)!;
const config = useRuntimeConfig();
const appVersion = config.public.appVersion;
const buildCommit = config.public.buildCommit;
const toast = useToast();

// Copies a `?share=` link encoding the whole current visualizer state
// (Scope mode/query, Deck contents, colors/rarities/types, search — see
// buildShareUrl in useGraphStore.ts) so it can be pasted anywhere; the
// recipient's own load restores it and immediately cleans the URL back down
// (see that file's own restore block).
async function copyShareLink() {
  const url = buildShareUrl(store);
  try {
    await navigator.clipboard.writeText(url);
    toast.add({ title: 'Link copied', description: 'Paste it anywhere to share this exact view.', color: 'success', icon: 'i-lucide-check' });
  } catch {
    toast.add({ title: 'Could not copy link', description: url, color: 'error', icon: 'i-lucide-triangle-alert' });
  }
}

// Card-filter modal — two tabs sharing one dialog. Only the "Scryfall query"
// tab is still a real navigation (Scope's own bulk pool, SET_CODE/
// scryfallQuery in useGraphStore.ts, is fixed at module-load time, same as
// before PRD 01). "Import deck" no longer is — since PRD 01 made Deck an
// independent collection unioned with Scope rather than a Scope-replacing
// mode, pasting a decklist just resolves it and merges straight into the
// live, reactive `store.deck` (see submitDeckImport below) — no reload, the
// graph updates immediately. `submitting` covers the query tab's brief
// pre-navigation window, and the deck tab's own in-flight
// `/api/cards/by-names` resolve.
const filterOpen = ref(false);
const filterMode = ref<'scryfall' | 'deck'>('scryfall');
const filterModeTabs = [
  { label: 'Scryfall query', value: 'scryfall' as const },
  { label: 'Import deck', value: 'deck' as const },
];
const scryfallQuery = ref('');
const deckText = ref('');
const submitting = ref(false);

// Live "N cards recognized" feedback as the user pastes/edits — parsing is
// cheap (a plain-text scan) so this re-runs on every keystroke rather than
// only at submit time, the same way a "characters remaining" counter would.
const parsedDeckCards = computed(() => parseDecklist(deckText.value));
const parsedDeckCount = computed(() => parsedDeckCards.value.reduce((n, c) => n + c.qty, 0));

function openFilterDialog() {
  scryfallQuery.value = new URLSearchParams(window.location.search).get('sf') ?? '';
  // Always starts blank — pasting is now an additive "add these to my deck"
  // action each time (see submitDeckImport below), not editing a single
  // persisted blob the way the old Scope-replacing import used to be.
  deckText.value = '';
  // Land on whichever tab is more likely to be what's wanted right now: the
  // Deck tab if there's already a Deck to add more to, Scryfall query
  // otherwise.
  filterMode.value = store.deck.value.entries.length ? 'deck' : 'scryfall';
  submitting.value = false;
  filterOpen.value = true;
}

function submitScryfallQuery(clear = false) {
  if (submitting.value) return;
  submitting.value = true;
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

async function submitDeckImport(clear = false) {
  if (submitting.value) return;
  if (clear) {
    store.clearDeck();
    filterOpen.value = false;
    toast.add({ title: 'Deck cleared', color: 'neutral', icon: 'i-lucide-trash-2' });
    return;
  }
  submitting.value = true;
  try {
    const { importedCount, unmatched } = await store.importDeckFromText(deckText.value, 'merge');
    deckText.value = '';
    filterOpen.value = false;
    toast.add({
      title: `Added ${importedCount} card${importedCount === 1 ? '' : 's'} to your deck`,
      description: unmatched.length ? `${unmatched.length} not found: ${unmatched.join(', ')}` : undefined,
      color: unmatched.length ? 'warning' : 'success',
      icon: unmatched.length ? 'i-lucide-triangle-alert' : 'i-lucide-check',
    });
  } catch (err) {
    toast.add({
      title: 'Could not import deck',
      description: err instanceof Error ? err.message : String(err),
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    });
  } finally {
    submitting.value = false;
  }
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

    <!-- PRD 03 "Search: find & discover" — SearchBox.vue owns the input +
         results dropdown (find rows already in Scope∪Deck, discover rows
         from a live Scryfall lookup with their own add-to-Scope action);
         this header only ever mounted a plain UInput before. -->
    <SearchBox />

    <div class="flex shrink-0 items-baseline gap-1.5">
      <h1 class="m-0 text-sm font-medium text-muted">MtG Synergy Map</h1>
      <span class="text-[10px] text-muted/70">v{{ appVersion }} · {{ buildCommit }}</span>
    </div>

    <div class="ml-auto flex shrink-0 items-center gap-1.5">
      <!-- PRD 04 "List view" — the Graph/List renderer toggle itself now
           lives as a floating control over the view area
           (app/pages/app/index.vue), not here; it's a property of the
           graph/list view, not header chrome. -->
      <UButton
        icon="i-lucide-search-code"
        color="neutral"
        variant="subtle"
        square
        aria-label="Filter by Scryfall query or deck import"
        @click="openFilterDialog"
      />
      <UButton
        icon="i-lucide-link"
        color="neutral"
        variant="subtle"
        square
        aria-label="Copy a shareable link to this exact view"
        @click="copyShareLink"
      />
      <NuxtLink to="/app/keywords">
        <UButton icon="i-lucide-list-checks" color="neutral" variant="subtle" square aria-label="Keyword & mechanic coverage suite" />
      </NuxtLink>
      <NuxtLink to="/app/status">
        <UButton icon="i-lucide-grid-2x2" color="neutral" variant="subtle" square aria-label="Fact-authoring status dashboard" />
      </NuxtLink>
      <NuxtLink to="/app/engine-status">
        <UButton icon="i-lucide-cpu" color="neutral" variant="subtle" square aria-label="Engine capability status dashboard" />
      </NuxtLink>

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
          <span
            >Paste a decklist from anywhere — added cards join your Deck and stay visible in the graph (with a ×N badge) regardless of your current
            Scope.</span
          >
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
          <template v-else-if="store.deck.value.entries.length">
            Your deck currently has {{ store.deck.value.entries.reduce((n, e) => n + e.quantity, 0) }} card{{
              store.deck.value.entries.reduce((n, e) => n + e.quantity, 0) === 1 ? '' : 's'
            }}.
          </template>
          <template v-else>&nbsp;</template>
        </div>
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
        <UButton
          v-else
          color="neutral"
          variant="subtle"
          :disabled="submitting || !store.deck.value.entries.length"
          @click="submitDeckImport(true)"
        >
          Clear deck
        </UButton>
        <UButton
          v-if="filterMode === 'scryfall'"
          color="primary"
          :loading="submitting"
          @click="submitScryfallQuery()"
        >
          {{ submitting ? 'Applying…' : 'Apply' }}
        </UButton>
        <UButton v-else color="primary" :loading="submitting" :disabled="parsedDeckCount === 0" @click="submitDeckImport()">
          {{ submitting ? 'Adding…' : 'Add to deck' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
