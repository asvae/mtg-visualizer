<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { describeRelation, groupChipsByVerb } from '../../../../lib/relations';
import { describeFact } from '../../../../../functional-model/synergy';
import type { Fact, AnnotatedText } from '../../../../../functional-model/synergy';
import type { EnrichedInteractionGroup } from '../../../../../server/api/card/[set]/[number]';
import type { CardData, EdgeData, ThemeData } from '../../../../types';
import { getKnownDeckCards, getActiveFilterMode } from '../../../../composables/useGraphStore';

definePageMeta({ layout: 'graph' });

const route = useRoute();

interface CardResponse {
  card: CardData;
  edges: EdgeData[];
  themes: ThemeData[];
  functionalModel: {
    source: string;
    synergy: { source: Fact[]; sink: Fact[] } | null;
    traces: { scenario: { setup: string; action: string; result: string }; log: Record<string, unknown>[] }[];
    annotatedText: AnnotatedText | null;
    review: 'ai' | 'human' | null;
  } | null;
  interactions: EnrichedInteractionGroup[];
}

// Plain client-side ±1 on the URL's :number when no global filter (deck
// import / Scryfall query) is active — no server round-trip to validate a
// neighbor exists, so clicking Next/Previous (or pressing the arrow keys)
// doesn't wait on anything. A number past either edge of the set just 404s
// into this page's own "Card not found" state.
const currentNumber = computed(() => parseInt(String(route.params.number), 10));

interface FilterCardEntry {
  name: string;
  set: string;
  collectorNumber: string;
}
// Whichever global filter (deck import / Scryfall query) is active right
// now, resolved to a real, ordered {set, collectorNumber} list — fetched
// once on mount, same "standalone route" reasoning as the main useFetch
// above (this page doesn't share the main graph store's already-loaded
// card list, see this file's own header comment). `null` while unresolved
// OR when no filter is active at all — either way Previous/Next below fall
// back to plain ±1 in the SAME real set the current card is in.
const filterOrder = ref<FilterCardEntry[] | null>(null);

async function loadFilterOrder() {
  const filter = getActiveFilterMode();
  if (!filter) return;
  try {
    let raw: { name: string; set?: string; collector_number?: string; card_faces?: { name?: string }[] }[];
    if (filter.mode === 'deck') {
      const res = await fetch('/api/cards/by-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: [...new Set(filter.cards.map((c) => c.name))] }),
      });
      const body = await res.json();
      if (!res.ok) return;
      raw = body.cards;
    } else {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: filter.query }),
      });
      const body = await res.json();
      if (!res.ok) return;
      raw = body.cards;
    }
    // Keyed by every name a decklist/query might reference a card by — its
    // own top-level name (a DFC's is both faces joined by " // ") AND each
    // individual face's name, same front-face fallback deckQty above uses.
    const byName = new Map<string, FilterCardEntry>();
    for (const c of raw) {
      if (!c.set || !c.collector_number) continue;
      const entry: FilterCardEntry = { name: c.name, set: c.set, collectorNumber: c.collector_number };
      byName.set(c.name, entry);
      for (const f of c.card_faces ?? []) if (f.name) byName.set(f.name, entry);
    }
    const seen = new Set<string>();
    const dedupe = (e: FilterCardEntry) => {
      const key = `${e.set}/${e.collectorNumber}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    };
    if (filter.mode === 'deck') {
      // Preserve the deck's own paste order — the whole point of scoping to
      // a deck is browsing it as a deck, not by incidental collector number.
      filterOrder.value = filter.cards.map((c) => byName.get(c.name)).filter((e): e is FilterCardEntry => !!e && dedupe(e));
    } else {
      // No "paste order" to preserve here — collector number within each
      // real set is the closest thing to a stable, sensible reading order.
      filterOrder.value = [...byName.values()]
        .filter(dedupe)
        .sort((a, b) => (a.set === b.set ? Number(a.collectorNumber) - Number(b.collectorNumber) : a.set.localeCompare(b.set)));
    }
  } catch {
    // network hiccup — Previous/Next just fall back to plain ±1 below
  }
}

// Current card's position in the active filter's own ordered list, if any —
// -1 (not just "no filter") also covers the current card genuinely not
// being IN that list (e.g. a stale filter flag, or a direct visit to some
// other card while a deck/query filter happens to be active elsewhere);
// either way that's exactly when falling back to plain ±1 is right, same as
// no filter at all.
const filterIndex = computed(() => {
  if (!filterOrder.value || !card.value) return -1;
  return filterOrder.value.findIndex((e) => e.set === card.value!.set && e.collectorNumber === card.value!.collectorNumber);
});

interface NeighborTarget {
  set: string;
  collectorNumber: string;
}
const prevTarget = computed<NeighborTarget | null>(() => {
  if (filterIndex.value >= 0) return filterIndex.value > 0 ? filterOrder.value![filterIndex.value - 1]! : null;
  return Number.isFinite(currentNumber.value) && currentNumber.value > 1
    ? { set: String(route.params.set), collectorNumber: String(currentNumber.value - 1) }
    : null;
});
const nextTarget = computed<NeighborTarget | null>(() => {
  if (filterIndex.value >= 0) return filterIndex.value < filterOrder.value!.length - 1 ? filterOrder.value![filterIndex.value + 1]! : null;
  return Number.isFinite(currentNumber.value) ? { set: String(route.params.set), collectorNumber: String(currentNumber.value + 1) } : null;
});

// Same names filterOrder above already resolved (deck paste order or query
// match — either way `filterOrder` entries carry their own `name`), reused
// here as the main fetch's own POST body so the Interactions panel
// (server/api/card/[set]/[number].ts's `filterNames` scoping) respects the
// same active global filter Previous/Next does — `null` until filterOrder
// itself settles (or forever, if no filter is active), same "unscoped
// until proven otherwise" fallback.
const filterNames = computed<string[] | null>(() => (filterOrder.value ? filterOrder.value.map((e) => e.name) : null));

// Standalone request — this page owns its data, independent of the big
// client-side graph store (app/composables/useGraphStore.ts). A direct visit
// (bookmark, shared link) renders without needing the whole graph loaded first.
// URL as a getter (not a plain string) so clicking Previous/Next — which
// changes the route params on the same route instance — re-fetches instead of
// only fetching once at first mount. Routed by set/collector-number (same URL
// shape as scryfall.com/card/<set>/<number>) rather than the Scryfall id, so
// prev/next is a plain ±1 on the number segment.
// Not awaited: this route is ssr:false (client-only) anyway, and awaiting
// would suspend this component's own render until the fetch resolves —
// meaning `pending` is already false by the time anything renders, so the
// spinner below never shows on a fresh visit (only on a later Previous/Next
// reactive refetch, once the component's already mounted).
// POST (not GET) so `filterNames` can ride along in the body — a reactive
// getter, same as the URL above, so this automatically refetches once
// filterOrder (and therefore filterNames) settles after mount, picking up
// the Interactions panel's filter scoping without a second request.
const { data, pending, error } = useFetch<CardResponse>(() => `/api/card/${route.params.set}/${route.params.number}`, {
  method: 'POST',
  body: computed(() => (filterNames.value ? { filterNames: filterNames.value } : undefined)),
});

const card = computed(() => data.value?.card ?? null);

// Known-deck qty for the card currently on screen — shows regardless of
// whether that deck is also the active global filter (see
// getKnownDeckCards's own comment in useGraphStore.ts and the "Global
// filter by deck" checkbox in AppHeader.vue), same as the main graph's own
// node badge. Reads straight from localStorage (not the server response —
// the card route doesn't carry qty, the client already has the parsed deck
// in hand), so this stays in sync with whatever deck the user last pasted
// without a round-trip.
const deckQty = computed(() => {
  if (!card.value) return null;
  const deck = getKnownDeckCards();
  if (!deck) return null;
  // Scryfall's own top-level `name` on a DFC is both faces joined by " // "
  // (that's exactly what card.value.name is here — this route hands back
  // the raw Scryfall field, no card_faces breakdown) but a decklist almost
  // always names just the front face. Same fallback useGraphStore.ts's own
  // deck-mode merge uses against card_faces[].name, just matched the other
  // direction here since this route has no faces array to check — a front
  // face name is a real prefix of the combined name, followed by " // ".
  const exact = deck.find((c) => c.name === card.value!.name);
  if (exact) return exact.qty;
  const frontFace = deck.find((c) => card.value!.name.startsWith(`${c.name} // `));
  return frontFace?.qty ?? null;
});

// functional-model's own outline data — the card's v2 (SYNERGY_DESIGN.md)
// AI-authored, execution-verified attribute-bag facts
// (functional-model/cards/<slug>/synergy.json). `null` for a card not yet
// migrated to v2 (see synergy.value).
const synergy = computed(() => data.value?.functionalModel?.synergy ?? null);
// Flattened for display — the underlying synergy.json/Fact[] split into
// `source`/`sink` arrays is a real structural distinction for the matcher
// (functional-model/synergy.ts), but each Fact already carries its own
// `role` field, so showing that split as two top-level JSON keys here is
// redundant, not informative — one array, same order the Facts tab's own
// table already uses (sink then source), is the more honest "what does one
// fact actually look like" view.
const functionalModelJson = computed(() =>
  synergy.value ? JSON.stringify([...synergy.value.sink, ...synergy.value.source], null, 2) : null
);

// Raw constraint fields off a fact, verbatim — describeFact()'s own label
// deliberately omits these now (a `target` constraint, e.g. activateAbility's
// "target Creature") in favor of a terser label, with the nuance folded into
// `value` instead; this column is where that omitted detail still shows,
// exactly as authored, no relabeling.
const CONDITION_KEYS = ['types', 'cmc', 'power', 'toughness', 'amount', 'name', 'target', 'oncePerTurn'] as const;
function factConditions(fact: Fact): string {
  const obj: Record<string, unknown> = {};
  for (const key of CONDITION_KEYS) {
    const value = (fact as unknown as Record<string, unknown>)[key];
    if (value !== undefined) obj[key] = value;
  }
  return Object.keys(obj).length ? JSON.stringify(obj) : '—';
}

// Same shape as FunctionalModelText.vue's own `factKey` — matches a table
// row's raw `Fact` to the `AnnotatedFactRef`(s) behind a linked phrase there,
// so hovering a row can highlight its own phrase in the annotated text.
// Prefers the fact's own author-assigned `id` (stable, unambiguous); falls
// back to role+sourceText+description for a fact that predates `id` (two
// such facts sharing all three would also render identically in the table,
// so nothing is lost by treating them as the same key).
function factKey(fact: Fact): string {
  return fact.id ?? `${fact.role}::${fact.sourceText}::${describeFact(fact)}`;
}
const hoveredFactKey = ref<string | null>(null);

// Functional model's own four views, tabbed instead of stacked
// <details>/<summary> spoilers — Facts is the default (the primary,
// AI-authored+verified representation this page leads with), the other
// three are progressively rawer looks at the same card (its trace.json
// scenario log, the synergy facts as literal JSON, then the hand-authored
// CardDefinition source itself).
const functionalModelTab = ref<'facts' | 'scenarios' | 'json' | 'definition'>('facts');
const functionalModelTabs = [
  { label: 'Facts', value: 'facts' as const },
  { label: 'Scenarios', value: 'scenarios' as const },
  { label: 'Json', value: 'json' as const },
  { label: 'Card Definition', value: 'definition' as const },
];

const themeLabelById = computed(() => {
  const map = new Map<string, string>();
  data.value?.themes.forEach((t) => map.set(t.id, t.label));
  return map;
});

// Same chip/column pipeline TooltipView.vue uses for the hover popup — this
// page shows the same info, just as a dedicated route instead of a tooltip.
const relationChips = computed(() => {
  if (!data.value) return [];
  return data.value.edges.flatMap((e) => {
    const label = themeLabelById.value.get(e.theme) ?? e.theme;
    return describeRelation(label, e.role, e.weight).map((chip, i) => ({ ...chip, key: `${e.theme}-${i}` }));
  });
});
const chipColumns = computed(() => groupChipsByVerb(relationChips.value));

useHead(() => ({ title: card.value ? card.value.name : 'Card' }));

// Left/right arrow keys walk the same Previous/Next target the links below
// do — this page has no text inputs, so no need to guard against typing.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' && prevTarget.value) navigateTo(`/app/card/${prevTarget.value.set}/${prevTarget.value.collectorNumber}`);
  else if (e.key === 'ArrowRight' && nextTarget.value) navigateTo(`/app/card/${nextTarget.value.set}/${nextTarget.value.collectorNumber}`);
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  loadFilterOrder();
});
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div v-if="pending" class="flex flex-1 items-center justify-center">
      <div
        class="size-8 animate-spin rounded-full border-[3px] border-border border-t-produce"
        aria-hidden="true"
      ></div>
    </div>
    <div v-else-if="error || !card" class="text-muted">Card not found.</div>
    <template v-else>
      <div class="mb-4 flex items-center justify-between gap-4">
        <NuxtLink to="/app" class="inline-block text-sm text-muted hover:text-text">&larr; Back to graph</NuxtLink>
        <div class="flex items-center gap-3 text-sm">
          <NuxtLink v-if="prevTarget" :to="`/app/card/${prevTarget.set}/${prevTarget.collectorNumber}`" class="text-muted hover:text-text">
            &larr; Previous
          </NuxtLink>
          <span v-else class="text-muted/40">&larr; Previous</span>
          <span class="text-muted">#{{ currentNumber }}</span>
          <NuxtLink v-if="nextTarget" :to="`/app/card/${nextTarget.set}/${nextTarget.collectorNumber}`" class="text-muted hover:text-text">
            Next &rarr;
          </NuxtLink>
        </div>
      </div>
      <h1 class="mb-2 flex items-center gap-2 text-lg font-semibold">
        {{ card.name }}
        <span v-if="deckQty" class="rounded-full bg-bg px-2 py-0.5 text-xs font-bold text-muted" title="Copies in your imported deck">
          ×{{ deckQty }}
        </span>
        <span
          v-if="data?.functionalModel && data.functionalModel.review !== 'human'"
          class="-translate-y-px rounded bg-warn/20 px-1.5 py-px text-[10px] font-bold tracking-wide text-warn uppercase"
          title="AI-authored, not yet human-reviewed against the real card"
          >draft</span
        >
      </h1>
      <CardMedia :images="card.images" :tokens="card.tokens" />

      <!-- functional-model/ — a declarative CardDefinition
           (functional-model/card.ts) run through real, mutable game state
           (functional-model/state.ts) across its own scenarios.ts. Primary
           position right under the card now (not a comparison column
           anymore) — synergy-model/forge-model are deprecated (see their
           own README/SCHEMA.md banners), this is the current direction. -->
      <div v-if="data?.functionalModel" class="mt-2">
        <!-- Real oracle text, pre-split server-side (functional-model/synergy.ts's
             annotateCardText, see server/api/card/[set]/[number].ts) into plain
             runs and fact-linked runs — hover a dotted-underline phrase to see
             the same role/value info the Facts tab's own table shows per row,
             anchored to the exact words that fact came from. Sits above the
             tabs (not inside the Facts one) since it's a separate thing — the
             card's own annotated text, not one of the four data views below. -->
        <div v-if="data.functionalModel.annotatedText" class="mb-2">
          <FunctionalModelText
            :text="data.functionalModel.annotatedText.text"
            :facts="data.functionalModel.annotatedText.facts"
            :highlight-key="hoveredFactKey"
          />
        </div>

        <!-- Same "strip only, content switched separately" split AppHeader.vue's
             own filter-mode UTabs already uses — nothing here depends on
             UTabs rendering slotted content itself. -->
        <UTabs v-model="functionalModelTab" :items="functionalModelTabs" variant="link" size="xs" class="mb-2" />

        <template v-if="functionalModelTab === 'facts'">
          <div v-if="synergy" class="overflow-x-auto">
            <table class="border-collapse text-xs whitespace-nowrap">
              <tbody>
                <tr
                  v-for="(fact, fi) in [...synergy.sink, ...synergy.source]"
                  :key="fi"
                  class="align-middle hover:bg-surface/25"
                  @mouseenter="hoveredFactKey = factKey(fact)"
                  @mouseleave="hoveredFactKey = null"
                >
                  <td class="py-1 px-2"><ValueBar :value="fact.value" /></td>
                  <td class="py-1 px-2">
                    <Icon
                      :name="fact.role === 'source' ? 'lucide:log-out' : 'lucide:log-in'"
                      :class="fact.role === 'source' ? 'text-blue-400' : 'text-emerald-500'"
                      class="h-3.5 w-3.5"
                      :title="fact.role === 'source' ? 'Source — this card provides this' : 'Sink — this card wants this'"
                    />
                  </td>
                  <td class="py-1 px-2 text-[13px] whitespace-pre-wrap text-muted first-letter:uppercase">{{ describeFact(fact) }}</td>
                  <td class="py-1 px-2 whitespace-pre-wrap font-mono text-muted/60">{{ factConditions(fact) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-xs text-muted italic">Not yet migrated to v2 synergy.json.</div>
        </template>

        <template v-else-if="functionalModelTab === 'scenarios'">
          <TraceViewer v-if="data.functionalModel.traces?.length" :traces="data.functionalModel.traces" />
          <div v-else class="text-xs text-muted italic">No scenarios recorded.</div>
        </template>

        <template v-else-if="functionalModelTab === 'json'">
          <pre class="max-h-96 overflow-auto rounded border border-border bg-panel p-2 font-mono text-[10px] text-text/80">{{
            functionalModelJson
          }}</pre>
        </template>

        <template v-else>
          <FunctionalModelScript :code="data.functionalModel.source" />
        </template>
      </div>

      <!-- app/lib/synergyInteractions.ts's cross-card join, grouped by this
           card's own node (or, for a rule this card only bears, the rule
           owner's node — see groupInteractionsForCard) — one row per
           mechanism, with every matching pool card and a count, rather than
           one row per pair. Computed server-side from real synergy nodes
           (hand-authored or Forge-translated, see the two columns above),
           not pre-baked; only wired for the small worked-example pool in
           server/api/card/[set]/[number].ts (no full-corpus join yet). -->
      <div v-if="data?.interactions?.length" class="mt-4 w-full max-w-full">
        <div class="mb-1 text-[10px] font-semibold tracking-wide text-muted uppercase">Interactions</div>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="(group, gi) in data.interactions"
            :key="gi"
            class="rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs text-text"
          >
            <details>
              <summary class="flex cursor-pointer items-center gap-1.5">
                <Icon
                  :name="group.direction === 'source' ? 'lucide:log-out' : 'lucide:log-in'"
                  :class="group.direction === 'source' ? 'text-blue-400' : 'text-emerald-500'"
                  class="h-3.5 w-3.5 shrink-0"
                  :title="group.direction === 'source' ? 'This card is the source — other cards benefit from it' : 'This card is the beneficiary — other cards are the source'"
                />
                {{ group.description }}<span class="ml-auto shrink-0 rounded-full bg-bg px-2 py-px text-[10px] font-bold text-muted"
                  >{{ group.matches.length }} card{{ group.matches.length === 1 ? '' : 's' }}</span
                >
              </summary>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <NuxtLink
                  v-for="m in group.matches"
                  :key="m.card"
                  :to="m.set && m.collectorNumber ? `/app/card/${m.set}/${m.collectorNumber}` : undefined"
                  class="block shrink-0"
                  :class="{ 'pointer-events-none': !(m.set && m.collectorNumber) }"
                  :title="m.selfInteraction ? `Self-interaction: ${m.selfInteraction}` : undefined"
                >
                  <img v-if="m.image" :src="m.image" :alt="m.card" class="block w-[220px] min-w-0 rounded-md" />
                  <span v-else class="flex h-[307px] w-[220px] items-center justify-center rounded-md bg-bg text-center text-xs text-muted">{{
                    m.card
                  }}</span>
                </NuxtLink>
              </div>
            </details>
          </li>
        </ul>
      </div>
      <a :href="card.scryfallUri" target="_blank" rel="noopener" class="mt-3 inline-block text-xs text-muted hover:text-text">
        View on Scryfall &rarr;
      </a>
    </template>
  </div>
</template>
