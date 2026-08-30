<script setup lang="ts">
import { inject, ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';
import { StoreKey } from '../store';
import { describeRelation, groupChipsByVerb } from '../lib/relations';
import CardMediaRelations from './CardMediaRelations.vue';
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
  // (mounted on every load whenever VITE_ENABLE_REVIEW is set, review session
  // or not) would spam connection-refused requests to localhost:8787 forever.
  // A real review session starting later just needs a page reload.
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
    describeRelation(themeLabelById.value.get(relation.theme) ?? relation.theme, relation.role, relation.weight ?? 1),
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
  return lastIdx >= 0 && entries[lastIdx].role === 'agent' ? lastIdx : -1;
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
</script>

<template>
  <aside id="review-session" v-if="store.reviewSessionOpen.value">
    <div class="review-session-header">
      <strong>Review session</strong>
      <div class="review-session-header-actions">
        <button class="review-stop" @click="stopReview">Stop review</button>
        <button class="review-close" aria-label="Close" @click="store.reviewSessionOpen.value = false">✕</button>
      </div>
    </div>

    <div class="review-empty" v-if="!started">Waiting for the review session to start…</div>

    <template v-else>
      <div class="review-card-name">{{ cardName }}</div>
      <section class="review-block" v-if="currentCard">
        <h3>Cards</h3>
        <CardMediaRelations :images="currentCard.images" :tokens="currentCard.tokens" :columns="[]" :show-relations="false" />
      </section>

      <section class="review-block">
        <h3>Relations <span>(current)</span></h3>
        <CardMediaRelations
          v-if="currentCard && currentColumns.length"
          :images="[]"
          :tokens="[]"
          :columns="currentColumns"
          :show-media="false"
        />
        <div class="review-no-relations" v-else>None</div>
      </section>

      <!-- Transcript sits right above the input it leads into — the live/pending
           turn (bottom entry) gets the full rich chip display, since that's the
           actual thing being decided right now; past turns are compact one-liners. -->
      <section class="review-history" ref="historyEl" v-if="cardHistory.length">
        <div
          v-for="(entry, i) in cardHistory"
          :key="i"
          class="history-entry"
          :class="[`history-${entry.role}`, { 'history-pending': i === pendingIndex }]"
        >
          <template v-if="entry.role === 'agent'">
            <div v-if="i !== pendingIndex">
              <span v-if="entry.confidence != null" class="confidence-badge" :class="confidenceTier(entry.confidence)">
                {{ entry.confidence }}/10
              </span>
              <div v-if="entry.relationsToAdd?.length" class="history-line history-add">
                + {{ summarizeRelations(entry.relationsToAdd) }}
              </div>
              <div v-if="entry.relationsToRemove?.length" class="history-line history-remove">
                − {{ summarizeRelations(entry.relationsToRemove) }}
              </div>
              <div v-if="entry.note" class="history-note" v-html="entry.note"></div>
            </div>
            <div v-else class="history-pending-body">
              <div class="history-pending-label">
                Proposed
                <span v-if="entry.confidence != null" class="confidence-badge" :class="confidenceTier(entry.confidence)">
                  Confidence: {{ entry.confidence }}/10
                </span>
              </div>
              <section class="review-block" v-if="pendingAddColumns.length">
                <h3>Relations to add</h3>
                <CardMediaRelations :images="[]" :tokens="[]" :columns="pendingAddColumns" :show-media="false" />
              </section>
              <section class="review-block review-remove" v-if="pendingRemoveColumns.length">
                <h3>Relations to remove</h3>
                <CardMediaRelations :images="[]" :tokens="[]" :columns="pendingRemoveColumns" :show-media="false" />
              </section>
              <div v-if="!pendingAddColumns.length && !pendingRemoveColumns.length" class="review-no-relations">
                No relation changes proposed
              </div>
              <div v-if="entry.note" class="history-note" v-html="entry.note"></div>
            </div>
          </template>
          <template v-else>
            <div v-if="entry.kind === 'allGood'" class="history-line">✓ All good</div>
            <div v-else-if="entry.kind === 'feedback'" class="history-line">{{ entry.text }}</div>
            <div v-else class="history-line">Stopped review</div>
          </template>
        </div>
      </section>

      <div class="review-loading" v-if="busy">
        <span class="review-loading-dots"><span></span><span></span><span></span></span>
        Applying your feedback…
      </div>
      <template v-else>
        <textarea
          class="review-feedback"
          v-model="feedbackText"
          placeholder="Feedback (Enter to send)… leave empty and press Enter for All good"
          rows="4"
          @keydown="onKeydown"
        ></textarea>
        <button class="review-submit-btn" :class="{ 'all-good': !hasFeedback }" @click="submit">
          {{ hasFeedback ? 'Send feedback' : 'All good' }}
        </button>
      </template>
    </template>
  </aside>
</template>

<style scoped>
#review-session {
  width: 472px;
  min-width: 472px;
  background: var(--panel);
  border-left: 1px solid #2a2c36;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.review-session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.review-session-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-stop {
  background: none;
  border: 1px solid #3a3d4a;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  padding: 3px 8px;
}

.review-stop:hover {
  color: var(--text);
  border-color: #6c7086;
}

.review-close {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
}

.review-close:hover {
  color: var(--text);
}

.review-empty {
  color: var(--muted);
  font-size: 12px;
  text-align: center;
  padding: 24px 0;
}

.review-history {
  max-height: 400px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: #14151a;
  border: 1px solid #3a3d4a;
  border-radius: 8px;
  font-size: 11px;
  flex-shrink: 0;
}

.history-entry {
  padding: 6px 8px;
  border-radius: 6px;
  max-width: 88%;
}

/* Agent (proposals) on the left, user (responses) on the right, each with a
   colored accent edge — the two sides need to read apart at a glance. */
.history-agent {
  align-self: flex-start;
  background: #20222c;
  border-left: 2px solid var(--produce);
}

.history-user {
  align-self: flex-end;
  background: #23262f;
  border-right: 2px solid var(--muted);
  text-align: right;
}

.history-card-name {
  font-weight: 700;
  margin-bottom: 2px;
}

.history-line {
  color: var(--text);
  line-height: 1.4;
}

.history-add {
  color: var(--produce);
}

.history-remove {
  color: #c0392b;
  text-decoration: line-through;
  opacity: 0.85;
}

/* Content here is written by the agent as raw HTML (v-html), so these target
   tags inside it directly — :deep() is needed since v-html-inserted markup
   never gets this component's scoped attribute. */
.history-note {
  margin-top: 4px;
  color: var(--muted);
  font-style: italic;
}

.history-note :deep(p) {
  margin: 0 0 6px;
}

.history-note :deep(p:last-child) {
  margin-bottom: 0;
}

.history-note :deep(h4) {
  margin: 0 0 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.history-note :deep(h4:not(:first-child)) {
  margin-top: 8px;
}

.history-note :deep(strong) {
  color: var(--produce);
  font-style: normal;
}

/* The one entry still awaiting your response — the whole reason this log
   replaces the old static "current proposal" section, so it needs to read as
   distinctly "this one's live" rather than just another past turn. */
.history-pending {
  border-left-color: var(--produce);
  border-left-width: 3px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--produce) 35%, transparent);
  /* Rich chip columns need real room, unlike a one-line chat bubble — let this
     one entry take the full width instead of the usual 88% bubble cap. */
  max-width: 100%;
  align-self: stretch;
}

.history-pending-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.history-pending-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

/* Low confidence (1-5) needs real visual weight — it's the whole point of
   surfacing this at all — mid is quiet, high barely needs to register. */
.confidence-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  text-transform: none;
  letter-spacing: normal;
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.5;
}

.confidence-badge.low {
  background: #c0392b;
  color: #fff;
}

.confidence-badge.mid {
  background: transparent;
  color: var(--muted);
  border: 1px solid #3a3d4a;
}

.confidence-badge.high {
  background: transparent;
  color: var(--muted);
}

/* Reads as a removal, not just another relations list — dashed red border,
   struck-through theme names. :deep() since the columns are CardMediaRelations'
   own child markup, not this component's template. */
.review-remove :deep(.chip-column) {
  border-color: #c0392b;
  border-style: dashed;
}

.review-remove :deep(.chip-col-theme span:first-child) {
  text-decoration: line-through;
  opacity: 0.75;
}

.review-card-name {
  font-size: 14px;
  font-weight: 700;
}

.review-block {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.review-block h3 {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.review-block h3 span {
  font-weight: 400;
}

.review-no-relations {
  color: var(--muted);
  font-size: 11px;
  font-style: italic;
}

.review-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  background: #14151a;
  border: 1px solid #3a3d4a;
  border-radius: 8px;
  padding: 14px 0;
}

.review-loading-dots {
  display: inline-flex;
  gap: 5px;
}

.review-loading-dots span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--produce);
  animation: review-dot-bounce 1s infinite ease-in-out both;
}

.review-loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.review-loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes review-dot-bounce {
  0%, 80%, 100% { transform: scale(0.4); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.review-feedback {
  background: #14151a;
  color: var(--text);
  border: 1px solid #3a3d4a;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  font-family: inherit;
  resize: vertical;
}

.review-feedback:focus {
  outline: none;
  border-color: #6c7086;
}

.review-submit-btn {
  background: #2a2c36;
  color: var(--text);
  border: 1px solid #3a3d4a;
  border-radius: 6px;
  padding: 7px 0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.review-submit-btn:hover {
  background: #33364280;
}

.review-submit-btn.all-good {
  border-color: var(--produce);
  color: var(--produce);
}

.review-good-btn {
  border-color: var(--produce) !important;
  color: var(--produce) !important;
  font-weight: 600;
}

/* Mobile: the panel is a fixed-width sidebar that assumes a desktop-width
   viewport next to the graph — below phone/small-tablet width that stops
   making sense, so it takes over the whole screen instead (the existing ✕
   button is the way back to the graph). Everything else here is sizing —
   bigger touch targets, readable text, and 16px on the textarea specifically
   to stop iOS Safari auto-zooming into it on focus. */
@media (max-width: 640px) {
  #review-session {
    position: fixed;
    inset: 0;
    width: 100%;
    min-width: 0;
    max-width: none;
    height: 100%;
    border-left: none;
    z-index: 50;
    padding: 14px;
    gap: 12px;
  }

  .review-session-header {
    font-size: 15px;
  }

  .review-stop,
  .review-close {
    min-height: 40px;
    padding: 0 14px;
    font-size: 14px;
  }

  .review-close {
    min-width: 40px;
    padding: 0;
    font-size: 22px;
  }

  .review-card-name {
    font-size: 17px;
  }

  .review-block h3 {
    font-size: 13px;
  }

  .review-history {
    max-height: 40vh;
    font-size: 13px;
  }

  .history-entry {
    max-width: 94%;
  }

  .confidence-badge {
    font-size: 12px;
    padding: 3px 8px;
  }

  .review-feedback {
    font-size: 16px;
    padding: 10px;
  }

  .review-submit-btn {
    min-height: 44px;
    font-size: 15px;
  }
}
</style>
