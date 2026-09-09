<script setup lang="ts">
// Content renderer for ONE keywords/index.vue registry entry — a
// `ai_reviewed`/`human_reviewed` entry embeds the real replay
// (ScenarioReplay.vue, same component the per-card page's own Scenarios tab
// uses, real card art shown same as there); a `not_implemented` entry shows
// only its own honest reason for having no scenario (and only if it's
// FIN-relevant — see `gapNote`'s own doc comment in registry.ts, populated
// only for a FIN-relevant gap; a non-FIN `not_implemented` entry has no
// `gapNote` at all, so nothing extra renders). No collapse/open state of its
// own anymore — keywords/index.vue's sidebar drives which single entry ever
// renders (only one mounted at a time, remounted fresh via
// `:key="entry.key"` on every selection change, which is why this
// component's own local refs below never need an explicit reset).
// Deliberately doesn't render a separate single "featured card" header/
// portrait above the replay (e.g. a big Xande, Dark Mage portrait for
// Menace) — that was a dedicated section, removed per the user's own
// request; real per-card-chip art WITHIN the scenario board itself (via
// ScenarioReplay/ScenarioReplayTrace, same as the per-card page's own
// Scenarios tab) is unaffected and stays on.
//
// 2026-09-09: real 3-way status treatment (was a MINIMAL mechanical
// covered/gap binary before this pass) — `ReviewStatusBadge.vue` (shared
// with the card page) now renders above the replay for both `ai_reviewed`
// (Draft pill + confirm button) and `human_reviewed` (no pill, button reads
// "Mark as draft"); `confirmReview()` below POSTs
// `/api/keywords/review-status` and emits the server's own returned status
// up to the page, which owns the underlying `/api/keywords` data array (see
// that page's own `handleReviewed`) — this component holds no independent
// copy of review state. Also added `setsUsed` (compact chip list, capped
// with a "show all" toggle — some historical keywords list ~80 set codes,
// see registry.ts's own doc comment) rendered BEFORE the gap/replay
// content, for `set-specific` entries only (undefined/omitted for
// evergreen, per registry.ts).
//
// 2026-09-09: `namedCardArt` — a bundle's own scenario can legitimately put
// MORE than one genuinely-named real card on the board (e.g. flying-reach's
// own Iron Giant blocking Ahriman — neither ever gets marked the trace's
// singular `isSelf` identity, see scenarioReplay.ts's own instanceId-driven
// detection), so passing only `entry.cards[0]`'s own art (the old
// single-card assumption) left every OTHER real card on the board with a
// text placeholder even once forceTextOnly was reverted. `namedCardArt`
// forwards ALL of `entry.cards`' real art/keywords/power/toughness, keyed
// by each card's own name, so ScenarioReplayTrace's `imagesFor`/
// `iconKeywords` can resolve ANY real card by name — not just whichever one
// (if any) the trace happens to mark `isSelf`. See ScenarioReplay.vue's own
// doc comment on the prop itself.
import { computed, ref } from 'vue';
import type { KeywordPageEntry } from '../../server/api/keywords/index.get';
import type { ReviewStatus } from '../types';

const props = defineProps<{ entry: KeywordPageEntry }>();
const emit = defineEmits<{ reviewed: [status: ReviewStatus] }>();

const namedCardArt = computed(() => {
  const map: Record<string, { images: string[]; keywords: string[]; power?: string; toughness?: string }> = {};
  for (const c of props.entry.cards) map[c.name] = { images: c.images, keywords: c.keywords, power: c.power, toughness: c.toughness };
  return map;
});

const SETS_SHOWN_COLLAPSED = 16;
const showAllSets = ref(false);

const pendingReview = ref(false);
async function confirmReview() {
  if (pendingReview.value) return;
  // Same component drives both directions (see ReviewStatusBadge's own
  // "Mark as reviewed" / "Mark as draft" label swap) — request whichever
  // state ISN'T current.
  const reviewed = props.entry.status !== 'human_reviewed';
  pendingReview.value = true;
  try {
    const res = await fetch('/api/keywords/review-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: props.entry.key, reviewed }),
    });
    if (res.ok) {
      const body = await res.json();
      emit('reviewed', body.reviewStatus);
    }
  } finally {
    pendingReview.value = false;
  }
}
</script>

<template>
  <div class="rounded-lg border border-border-subtle bg-panel">
    <div class="flex w-full items-center gap-2.5 px-4 py-3 text-left">
      <span class="text-sm font-medium text-text">{{ entry.title }}</span>
      <span class="flex gap-1">
        <span v-for="k in entry.keywords" :key="k" class="rounded bg-bg px-1.5 py-0.5 text-[10px] text-muted">{{ k }}</span>
      </span>
      <span class="font-mono text-[10px] text-muted/70">{{ entry.ruleCite }}</span>
      <span
        class="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium"
        :class="entry.status !== 'not_implemented' ? 'bg-produce/20 text-produce' : 'bg-consume/20 text-consume'"
      >
        {{ entry.status !== 'not_implemented' ? 'Covered' : 'Gap — not yet implemented' }}
      </span>
    </div>

    <div class="border-t border-border-subtle px-4 py-3">
      <!-- Sets-used chip list — set-specific entries only, before any
           gap/replay content below. -->
      <div v-if="entry.setsUsed?.length" class="mb-3 flex flex-wrap items-center gap-1">
        <span class="mr-1 text-[10px] tracking-wide text-muted uppercase">Printed in {{ entry.setsUsed.length }} sets</span>
        <span
          v-for="code in showAllSets ? entry.setsUsed : entry.setsUsed.slice(0, SETS_SHOWN_COLLAPSED)"
          :key="code"
          class="rounded border border-border-subtle bg-bg px-1 py-0.5 font-mono text-[10px] text-muted"
        >
          {{ code.toUpperCase() }}
        </span>
        <button
          v-if="entry.setsUsed.length > SETS_SHOWN_COLLAPSED"
          type="button"
          class="rounded px-1 py-0.5 text-[10px] text-muted underline hover:text-text"
          @click="showAllSets = !showAllSets"
        >
          {{ showAllSets ? 'show fewer' : `+${entry.setsUsed.length - SETS_SHOWN_COLLAPSED} more` }}
        </button>
      </div>

      <template v-if="entry.status === 'not_implemented'">
        <p v-if="entry.gapNote" class="text-xs leading-relaxed text-muted">{{ entry.gapNote }}</p>
      </template>
      <template v-else>
        <ReviewStatusBadge
          class="mb-3"
          :status="entry.status"
          :badge="entry.status === 'ai_reviewed'"
          :pending="pendingReview"
          reviewed-note="Reviewed — this scenario has been checked against the real card."
          @confirm="confirmReview"
        />
        <ScenarioReplay
          v-if="entry.traces.length"
          :traces="entry.traces"
          :card-images="entry.cards[0]?.images"
          :card-keywords="entry.cards[0]?.keywords"
          :card-power="entry.cards[0]?.power"
          :card-toughness="entry.cards[0]?.toughness"
          :named-card-art="namedCardArt"
        />
        <div v-else class="text-xs text-muted italic">No trace recorded.</div>
      </template>
    </div>
  </div>
</template>
