<script setup lang="ts">
import { inject, ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';
import { StoreKey } from '../composables/useGraphStore';
import { describeRelation, groupChipsByVerb } from '../lib/relations';
import type { Role } from '../types';

interface SuggestedRelation {
  theme: string;
  role: Role;
  weight?: number;
}

// One entry per /show (agent) or /respond (user) call, server's full running
// transcript for this review-server process's lifetime — see review-server.mjs.
interface HistoryEntry {
  role: 'agent' | 'user';
  card: string | null;
  ts: number;
  // agent only
  relationsToAdd?: SuggestedRelation[];
  relationsToRemove?: SuggestedRelation[];
  note?: string;
  // Drafting agent's self-rated confidence (1-10) when this proposal came from a
  // pre-drafted queue (scripts/review-drafts.json via review-relay.mjs) rather
  // than a live judgment — null/absent for anything shown without one.
  confidence?: number | null;
  // user only
  kind?: 'allGood' | 'feedback' | 'stop';
  text?: string;
}

// `theme` doesn't have to already exist in store.graph — themeLabelById below
// falls back to the raw id, so proposing a brand-new theme (not yet in THEMES)
// works the same as suggesting an edge on an existing one.

// Talks to scripts/review-server.mjs (long-poll control plane) — the agent pushes
// a card + its assessment via POST /show, this panel polls GET /state to pick it
// up, and POST /respond sends "all good" or free-text feedback back. See that
// file's header comment for the full protocol.
const SERVER = 'http://localhost:8787';

const store = inject(StoreKey)!;

const lastId = ref(0);
const started = ref(false);
const cardName = ref<string | null>(null);
const busy = ref(false); // true while the agent is thinking about our last response
const feedbackText = ref('');
const history = ref<HistoryEntry[]>([]);
const historyEl = ref<HTMLElement | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function poll(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER}/state`);
    const s = await res.json();
    busy.value = !!s.busy;
    if (Array.isArray(s.history)) history.value = s.history;
    if (s.id && s.id !== lastId.value) {
      lastId.value = s.id;
      started.value = true;
      await store.load(); // pick up any re-tag the agent ran since the last card
      cardName.value = s.card;
      feedbackText.value = '';
    }
    return true;
  } catch {
    // review-server not running / transient network hiccup
    return false;
  }
}

onMounted(async () => {
  // Only keep polling once the server's actually there — otherwise this panel
  // (mounted on every load whenever NUXT_PUBLIC_ENABLE_REVIEW is set, review
  // session or not) would spam connection-refused requests to localhost:8787
  // forever. A real review session starting later just needs a page reload.
  if (await poll()) pollTimer = setInterval(poll, 600);
});
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});

const themeLabelById = computed(() => {
  const map = new Map<string, string>();
  store.graph.value?.themes.forEach((t) => map.set(t.id, t.label));
  return map;
});

const edgesByCard = computed(() => {
  const map = new Map<string, { themeId: string; role: Role; weight: number }[]>();
  for (const e of store.graph.value?.edges ?? []) {
    if (!map.has(e.card)) map.set(e.card, []);
    map.get(e.card)!.push({ themeId: e.theme, role: e.role, weight: e.weight });
  }
  return map;
});

const currentCard = computed(() => {
  if (!cardName.value || !store.graph.value) return null;
  return store.graph.value.cards.find((c) => c.name === cardName.value) ?? null;
});

const currentColumns = computed(() => {
  if (!currentCard.value) return [];
  const edges = edgesByCard.value.get(currentCard.value.id) ?? [];
  const chips = edges.flatMap((te) => describeRelation(themeLabelById.value.get(te.themeId) ?? te.themeId, te.role, te.weight));
  return groupChipsByVerb(chips);
});

// Compact one-line summary for a PAST history bubble — full chip columns per turn
// would be too heavy to repeat down a scrolling log, this is a plain-text stand-in
// just for "what did the agent propose." The live/pending entry gets the real rich
// display instead (relationsToColumns below) — it's the one thing actually being
// decided right now, it needs to be as visible as the old static section was.
function summarizeRelations(relations: SuggestedRelation[]) {
  return relations
    .map((r) => `${r.role} ${themeLabelById.value.get(r.theme) ?? r.theme}${r.weight ? ` (${r.weight})` : ''}`)
    .join(', ');
}

function relationsToColumns(relations: SuggestedRelation[]) {
  const chips = relations.flatMap((relation) =>
    describeRelation(themeLabelById.value.get(relation.theme) ?? relation.theme, relation.role, relation.weight ?? 1)
  );
  return groupChipsByVerb(chips);
}

// Low (1-5) needs a second look, mid (6-7) is routine, high (8-10) can be
// skimmed — matches review-relay.mjs's drafting-agent confidence scale.
function confidenceTier(confidence: number): 'low' | 'mid' | 'high' {
  if (confidence <= 5) return 'low';
  if (confidence <= 7) return 'mid';
  return 'high';
}

// Scoped to the card currently on screen — the full transcript mixes every card
// reviewed this session together, which reads as noise rather than a conversation.
// This IS the "current proposal" display now (no separate static section for it):
// the log is chronological, so the latest entry — whatever's actually being
// decided right now — always lands at the bottom, where it's most visible.
const cardHistory = computed(() => history.value.filter((entry) => entry.card === cardName.value));

// The last entry is "pending" (visually distinct) only when it's an agent
// proposal nobody has responded to yet — once a user entry follows it, the
// conversation for this turn is settled, nothing highlighted anymore.
const pendingIndex = computed(() => {
  const entries = cardHistory.value;
  const lastIdx = entries.length - 1;
  return lastIdx >= 0 && entries[lastIdx]?.role === 'agent' ? lastIdx : -1;
});

const pendingAddColumns = computed(() => {
  const entry = cardHistory.value[pendingIndex.value];
  return entry?.relationsToAdd?.length ? relationsToColumns(entry.relationsToAdd) : [];
});
const pendingRemoveColumns = computed(() => {
  const entry = cardHistory.value[pendingIndex.value];
  return entry?.relationsToRemove?.length ? relationsToColumns(entry.relationsToRemove) : [];
});

// Auto-scrolls the transcript to the newest message whenever it grows — waits for
// the DOM to actually reflect the new entry before measuring scrollHeight.
watch(
  () => cardHistory.value.length,
  async () => {
    await nextTick();
    if (historyEl.value) historyEl.value.scrollTop = historyEl.value.scrollHeight;
  }
);

// Highlights the card under review in the main graph while this panel is open —
// same mechanism as the card-lookup dropdown.
watch([() => store.reviewSessionOpen.value, currentCard], ([isOpen, card]) => {
  store.lookupHighlightCardId.value = isOpen && card ? card.id : null;
});
onBeforeUnmount(() => {
  store.lookupHighlightCardId.value = null;
});

async function respond(body: Record<string, unknown>) {
  busy.value = true;
  await fetch(`${SERVER}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// One action, driven by whether there's feedback text — "All good" when empty,
// "Send feedback" otherwise. Enter submits it (Shift+Enter still inserts a newline).
const hasFeedback = computed(() => feedbackText.value.trim().length > 0);
function submit() {
  if (hasFeedback.value) respond({ type: 'feedback', text: feedbackText.value.trim() });
  else respond({ type: 'allGood' });
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}

// Ends the session outright (distinct from just hiding the panel with ✕) — tells
// the agent's blocking /wait loop to stop instead of continuing to the next card.
function stopReview() {
  respond({ type: 'stop' });
  store.reviewSessionOpen.value = false;
}

const CONFIDENCE_CLASSES: Record<'low' | 'mid' | 'high', string> = {
  low: 'bg-[#c0392b] text-white',
  mid: 'border border-border text-muted',
  high: 'text-muted',
};
</script>

<template>
  <aside
    v-if="store.reviewSessionOpen.value"
    class="flex w-[472px] min-w-[472px] flex-col gap-2.5 overflow-y-auto bg-panel p-3 max-sm:fixed max-sm:inset-0 max-sm:z-50 max-sm:w-full max-sm:min-w-0 max-sm:max-w-none max-sm:gap-3 max-sm:p-3.5"
  >
    <div class="flex items-center justify-between text-[13px] max-sm:text-[15px]">
      <strong>Review session</strong>
      <div class="flex items-center gap-2.5">
        <UButton color="neutral" variant="outline" size="xs" @click="stopReview">Stop review</UButton>
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Close" @click="store.reviewSessionOpen.value = false" />
      </div>
    </div>

    <div v-if="!started" class="py-6 text-center text-xs text-muted">Waiting for the review session to start…</div>

    <template v-else>
      <div class="text-sm font-bold max-sm:text-[17px]">{{ cardName }}</div>
      <section v-if="currentCard" class="flex flex-col gap-1.5">
        <h3 class="m-0 text-xs tracking-wide text-muted uppercase max-sm:text-[13px]">Cards</h3>
        <CardMedia :images="currentCard.images" :tokens="currentCard.tokens" />
      </section>

      <section class="flex flex-col gap-1.5">
        <h3 class="m-0 text-xs tracking-wide text-muted uppercase max-sm:text-[13px]">Relations <span class="font-normal">(current)</span></h3>
        <CardRelations v-if="currentCard && currentColumns.length" :columns="currentColumns" />
        <div v-else class="text-[11px] text-muted italic">None</div>
      </section>

      <!-- Transcript sits right above the input it leads into — the live/pending
           turn (bottom entry) gets the full rich chip display, since that's the
           actual thing being decided right now; past turns are compact one-liners. -->
      <section
        v-if="cardHistory.length"
        ref="historyEl"
        class="flex max-h-[400px] shrink-0 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-bg p-2 text-[11px] max-sm:max-h-[40vh] max-sm:text-[13px]"
      >
        <div
          v-for="(entry, i) in cardHistory"
          :key="i"
          class="max-w-[88%] rounded-md p-1.5 max-sm:max-w-[94%]"
          :class="
            entry.role === 'agent'
              ? i === pendingIndex
                ? 'w-full max-w-full self-stretch border-l-[3px] border-produce bg-[#20222c]'
                : 'self-start border-l-2 border-produce bg-[#20222c]'
              : 'self-end border-r-2 border-muted bg-[#23262f] text-right'
          "
          :style="i === pendingIndex && entry.role === 'agent' ? { boxShadow: '0 0 0 1px rgba(46,204,113,0.35)' } : undefined"
        >
          <template v-if="entry.role === 'agent'">
            <div v-if="i !== pendingIndex">
              <span v-if="entry.confidence != null" class="inline-block rounded px-1.5 py-px text-[10px] font-bold" :class="CONFIDENCE_CLASSES[confidenceTier(entry.confidence)]">
                {{ entry.confidence }}/10
              </span>
              <div v-if="entry.relationsToAdd?.length" class="leading-snug text-produce">+ {{ summarizeRelations(entry.relationsToAdd) }}</div>
              <div v-if="entry.relationsToRemove?.length" class="leading-snug text-[#c0392b] line-through opacity-85">
                − {{ summarizeRelations(entry.relationsToRemove) }}
              </div>
              <div v-if="entry.note" class="review-note mt-1 text-muted italic" v-html="entry.note"></div>
            </div>
            <div v-else class="flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-[10px] tracking-wide text-muted uppercase">
                Proposed
                <span v-if="entry.confidence != null" class="inline-block rounded px-1.5 py-px text-[10px] font-bold normal-case" :class="CONFIDENCE_CLASSES[confidenceTier(entry.confidence)]">
                  Confidence: {{ entry.confidence }}/10
                </span>
              </div>
              <section v-if="pendingAddColumns.length" class="flex flex-col gap-1.5">
                <h3 class="m-0 text-xs tracking-wide text-muted uppercase">Relations to add</h3>
                <CardRelations :columns="pendingAddColumns" />
              </section>
              <section v-if="pendingRemoveColumns.length" class="flex flex-col gap-1.5">
                <h3 class="m-0 text-xs tracking-wide text-muted uppercase">Relations to remove</h3>
                <CardRelations :columns="pendingRemoveColumns" removed />
              </section>
              <div v-if="!pendingAddColumns.length && !pendingRemoveColumns.length" class="text-[11px] text-muted italic">
                No relation changes proposed
              </div>
              <div v-if="entry.note" class="review-note mt-1 text-muted italic" v-html="entry.note"></div>
            </div>
          </template>
          <template v-else>
            <div v-if="entry.kind === 'allGood'" class="leading-snug text-text">✓ All good</div>
            <div v-else-if="entry.kind === 'feedback'" class="leading-snug text-text">{{ entry.text }}</div>
            <div v-else class="leading-snug text-text">Stopped review</div>
          </template>
        </div>
      </section>

      <div v-if="busy" class="flex items-center justify-center gap-2.5 rounded-lg border border-border bg-bg py-3.5 text-[13px] font-semibold">
        <span class="inline-flex gap-1.5">
          <span v-for="i in 3" :key="i" class="size-1.5 animate-bounce rounded-full bg-produce" :style="{ animationDelay: `${-0.32 + i * 0.16}s` }"></span>
        </span>
        Applying your feedback…
      </div>
      <template v-else>
        <UTextarea
          v-model="feedbackText"
          class="w-full max-sm:text-base"
          placeholder="Feedback (Enter to send)… leave empty and press Enter for All good"
          :rows="4"
          @keydown="onKeydown"
        />
        <UButton
          block
          :color="hasFeedback ? 'neutral' : 'primary'"
          :variant="hasFeedback ? 'subtle' : 'solid'"
          class="justify-center max-sm:min-h-11"
          @click="submit"
        >
          {{ hasFeedback ? 'Send feedback' : 'All good' }}
        </UButton>
      </template>
    </template>
  </aside>
</template>

<style scoped>
/* Content here is written by the agent as raw HTML (v-html), so these target
   tags inside it directly — :deep() is needed since v-html-inserted markup
   never gets this component's scoped attribute. Not expressible as Tailwind
   utility classes on the outer div for the same reason GraphCanvas's D3 output
   isn't: there's nowhere to put a class="..." on content Vue never rendered. */
.review-note :deep(p) {
  margin: 0 0 6px;
}

.review-note :deep(p:last-child) {
  margin-bottom: 0;
}

.review-note :deep(h4) {
  margin: 0 0 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.review-note :deep(h4:not(:first-child)) {
  margin-top: 8px;
}

.review-note :deep(strong) {
  color: var(--color-produce);
  font-style: normal;
}
</style>
