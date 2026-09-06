<script setup lang="ts">
// One scenario's step-through replay: reconstructed board (zones/life) plus
// its own raw log, stepped together — see app/lib/scenarioReplay.ts for how
// the board gets rebuilt from the log (trace.json has no board snapshots of
// its own). Split out from ScenarioReplay.vue (which just lists these, one
// per scenario) so each trace owns its own independent playback state.
import { computed, onUnmounted, ref, watch } from 'vue';
import {
  replayTrace,
  entryRefs,
  displayName,
  placeholderLabel,
  playerRoles,
  computeZoneRects,
  boardHeight,
  groupForDisplay,
  actionEndIndices,
  CARD_LAYOUT,
  ZONE_PADDING,
  type GroupedReplayCard,
} from '../lib/scenarioReplay';
import { ABILITY_ICON_NAMES } from '../lib/abilityIconPaths';
import type { LogEntry, Scenario } from '../../functional-model/harness';
import type { ZoneType } from '../../functional-model/interfaces';

// Subtle per-zone tint — low-opacity fill/border, just enough to tell zones
// apart at a glance without competing with the warn-colored highlight ring.
const ZONE_COLOR: Record<ZoneType, string> = {
  Battlefield: 'border-produce/30 bg-produce/5',
  Hand: 'border-consume/30 bg-consume/5',
  Stack: 'border-warn/30 bg-warn/5',
  Graveyard: 'border-atypical/30 bg-atypical/5',
  Exile: 'border-purple-800/40 bg-purple-950/15',
  Library: 'border-grant/30 bg-grant/5',
  Command: 'border-border-subtle bg-transparent',
};

const props = defineProps<{
  trace: {
    scenario: { setup: string; action: string; result: string; raw?: Scenario };
    log: LogEntry[];
    /** A coarser, human-labeled index into `log` — real engine-piloted traces only (see harness.ts's own `TraceResult.actions` doc comment). Undefined/empty for a flat harness.ts scenario, which falls back to today's per-log-entry stepping. */
    actions?: { label: string; from: number }[];
  };
  /** The tested card's own real Scryfall image(s) (front, then back for a DFC) — app/pages/app/card/[set]/[number].vue's own `card.images`. */
  cardImages?: string[];
  /** Real name -> image, for basic-land/named-token filler (harness.ts's `PlayerState.basicLands`/`tokens`) — resolved once in ScenarioReplay.vue via server/api/cards/by-names.ts and server/api/tokens/by-key.ts. */
  fillerImages?: Record<string, string>;
  /** The real card's own printed keywords (Scryfall's `card.keywords`) — shown on the "self" chip alongside whatever `card.keywords` (mid-scenario `grantKeyword` entries) already tracks. Every OTHER chip only ever gets keywords via `grantKeyword` (a filler creature has no real printed keywords of its own). */
  cardKeywords?: string[];
}>();

/** One or two image URLs to show for this card (front, then back for a flipping self) — undefined when this card has no real art to show (an old-style synthetic filler, `placeholderLabel` covers it instead). */
function imagesFor(card: GroupedReplayCard): string[] | undefined {
  if (card.isSelf) return props.cardImages?.length ? props.cardImages : undefined;
  const filler = props.fillerImages?.[card.name];
  return filler ? [filler] : undefined;
}

/** This card's keywords worth a badge — its own real printed ones (self only) plus anything `grantKeyword` added mid-scenario, filtered down to what AbilityIcon.vue actually has a glyph for. */
function iconKeywords(card: GroupedReplayCard): string[] {
  const all = card.isSelf ? new Set([...(props.cardKeywords ?? []), ...card.keywords]) : card.keywords;
  return [...all].filter((k) => ABILITY_ICON_NAMES.has(k));
}

// Pure reads (`read:hasSubtype`, `read:getCreaturesInPlay`, ...) never
// mutate the board — they're candidate-pool/predicate evidence for the
// synergy matcher (see harness.ts's own `loggingCard`/`loggingPlayer`
// comment), not something a scenario replay's step-through needs to show.
// Used for the SECONDARY raw-log display, and (when this trace has no
// `actions`) for stepping itself — the pre-actions behavior, unchanged.
const log = computed(() => props.trace.log.filter((e) => !e.fn.startsWith('read:')));
const filteredTrace = computed(() => ({ scenario: props.trace.scenario, log: log.value }));
const filteredSnapshots = computed(() => replayTrace(filteredTrace.value));

const hasActions = computed(() => (props.trace.actions?.length ?? 0) > 0);
// `actions[].from` is authored against the RAW log (engine-trace.ts's own
// `pilot.log`, `read:*` included) — replaying that same raw log (not
// `log`/`filteredSnapshots` above, which strips `read:*` and would shift
// every index) is what keeps these lined up. Only computed when actually
// needed — a harness.ts scenario's `log` can be large-ish and this trace
// has no `actions` to index into it with anyway.
const rawSnapshots = computed(() => (hasActions.value ? replayTrace({ scenario: props.trace.scenario, log: props.trace.log }) : []));
const actionEnds = computed(() => (hasActions.value ? actionEndIndices(props.trace.actions!, props.trace.log.length) : []));

// The user's current position — an ACTION index (0..actions.length-1) when
// this trace has them, else today's raw filtered-log entry index
// (0..filteredSnapshots.length-1). One ref for both: a single trace instance
// only ever has one meaning for its own lifetime, and `play`/`pause`/`jumpTo`
// below don't care which — they just walk `stepIndex` up to `maxStep.value`.
const stepIndex = ref(0);
const maxStep = computed(() => (hasActions.value ? props.trace.actions!.length - 1 : filteredSnapshots.value.length - 1));

const activeSnapshots = computed(() => (hasActions.value ? rawSnapshots.value : filteredSnapshots.value));
/** Which index into `activeSnapshots` the CURRENT `stepIndex` resolves to — the end of the current action, or `stepIndex` itself in the no-actions fallback (today's exact meaning). */
const activeIndex = computed(() => (hasActions.value ? (actionEnds.value[stepIndex.value] ?? 0) : stepIndex.value));
/** Same resolution, one step back — the end of the PREVIOUS action (not just "one raw entry earlier," which could still be inside the current action) when this trace has them. */
const prevIndex = computed(() => {
  if (stepIndex.value <= 0) return undefined;
  return hasActions.value ? actionEnds.value[stepIndex.value - 1]! : stepIndex.value - 1;
});

const snapshot = computed(() => activeSnapshots.value[activeIndex.value]!);
const prevLife = computed(() => (prevIndex.value !== undefined ? activeSnapshots.value[prevIndex.value]!.life : undefined));

const roles = computed(() => playerRoles(props.trace.scenario.raw));
const boardOrder = computed(() => [...roles.value.filter((r) => r !== 'you'), 'you']);

function ownerCards(owner: string): GroupedReplayCard[] {
  return groupForDisplay(snapshot.value.cards.filter((c) => c.owner === owner));
}
function cardsFor(owner: string, zone: ZoneType): GroupedReplayCard[] {
  return ownerCards(owner).filter((c) => c.zone === zone);
}
// Recomputed every step, not cached across the whole trace — a zone's box
// only exists while it actually holds a card (Battlefield always keeps a
// 2-slot minimum instead — see computeZoneRects), and its width tracks that
// count directly, so the board grows/shrinks with what's really there. The
// existing left/top CSS transition on each card is what turns that resize
// into a smooth shift instead of a jump.
function zonesFor(owner: string) {
  return computeZoneRects(ownerCards(owner));
}
function boardWidth(owner: string): number {
  const rects = zonesFor(owner);
  if (!rects.length) return 0;
  const last = rects[rects.length - 1]!;
  return last.x + last.width;
}

/** Pure function of (zone, position within that zone) — bound straight to a CSS `left`/`top` with a `transition`, so a card changing zone (or its zone box resizing) slides there instead of popping. */
function cardStyle(card: GroupedReplayCard): Record<string, string> {
  const rect = zonesFor(card.owner).find((r) => r.zone === card.zone);
  const siblings = cardsFor(card.owner, card.zone as ZoneType);
  const index = Math.max(0, siblings.findIndex((c) => c.key === card.key));
  const x = (rect?.x ?? 0) + ZONE_PADDING.x + index * (CARD_LAYOUT.width + CARD_LAYOUT.gap);
  return { left: `${x}px`, top: `${CARD_LAYOUT.labelHeight}px` };
}

// Which chips/life this step actually touched — the whole action's own
// entries when this trace has actions (a multi-entry action, e.g. a cast
// plus its tapForMana lines, should highlight all of it, not just the
// single entry `snapshot` happens to land on), else just the one entry that
// produced the current snapshot (today's exact behavior).
const highlighted = computed(() => {
  if (hasActions.value) {
    const from = props.trace.actions![stepIndex.value]!.from;
    const to = actionEnds.value[stepIndex.value]!;
    return new Set(props.trace.log.slice(from, to).flatMap((e) => entryRefs(e)));
  }
  return new Set(snapshot.value.entry ? entryRefs(snapshot.value.entry) : []);
});

// Playback — a plain setInterval driving stepIndex forward; pauses itself
// at the end rather than looping, so "done" reads as done.
const playing = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;
function pause() {
  playing.value = false;
  if (timer) clearInterval(timer);
  timer = undefined;
}
function play() {
  if (stepIndex.value >= maxStep.value) stepIndex.value = 0;
  playing.value = true;
  timer = setInterval(() => {
    if (stepIndex.value >= maxStep.value) {
      pause();
      return;
    }
    stepIndex.value++;
  }, 850);
}
function toggle() {
  playing.value ? pause() : play();
}
function jumpTo(i: number) {
  pause();
  stepIndex.value = Math.min(maxStep.value, Math.max(0, i));
}
onUnmounted(pause);

function fieldsOf(entry: LogEntry): string {
  return Object.entries(entry)
    .filter(([k]) => k !== 'fn')
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('  ');
}

// The scenario's own raw input (harness.ts's `Scenario`) shown the same
// field=value way the log's own `fieldsOf` renders one entry — this is the
// board's actual seed data (see scenarioReplay.ts's `seedPlayerCards`), not
// just the prose `setup` summary above.
const scenarioRows = computed(() => {
  const raw = props.trace.scenario.raw;
  if (!raw) return [];
  return Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)] as const);
});

// Auto-scroll the active row (an action row when this trace has them, else
// a raw log row) into view as playback/step-clicks move it. Only one of the
// two lists ever renders for a given trace instance, so one ref array
// serves both — whichever list is on screen is the one populating it.
const stepRows = ref<(HTMLElement | null)[]>([]);
watch(stepIndex, (i) => {
  const rowIndex = hasActions.value ? i : i - 1;
  stepRows.value[rowIndex]?.scrollIntoView({ block: 'nearest' });
});
</script>

<template>
  <div class="text-[11px]">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-muted">
      <span v-if="trace.scenario.setup"><span class="text-muted/60">setup:</span> {{ trace.scenario.setup }}</span>
      <span v-else class="text-muted/60">setup: default board</span>
      <span><span class="text-muted/60">action:</span> {{ trace.scenario.action }}</span>
      <span class="text-text"><span class="text-muted/60">result:</span> {{ trace.scenario.result }}</span>
    </div>
    <div v-if="scenarioRows.length" class="mt-1.5 max-h-24 overflow-x-auto overflow-y-auto rounded border border-border bg-panel p-2">
      <table class="w-full border-collapse font-mono text-[10px] whitespace-nowrap">
        <thead>
          <tr class="text-muted/70 uppercase">
            <th class="pr-2 pb-1 text-left font-normal">field</th>
            <th class="pb-1 text-left font-normal">value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[field, value] in scenarioRows" :key="field" class="align-top">
            <td class="py-0.5 pr-2 text-text">{{ field }}</td>
            <td class="py-0.5 whitespace-pre-wrap text-muted">{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-1.5 flex items-center gap-1.5">
      <button class="rounded border border-border px-1.5 py-0.5 hover:bg-surface" title="Start" @click="jumpTo(0)">|&lt;</button>
      <button class="rounded border border-border px-1.5 py-0.5 hover:bg-surface" title="Back" @click="jumpTo(stepIndex - 1)">&lt;</button>
      <button class="w-14 rounded border border-border px-1.5 py-0.5 hover:bg-surface" @click="toggle">{{ playing ? 'Pause' : 'Play' }}</button>
      <button class="rounded border border-border px-1.5 py-0.5 hover:bg-surface" title="Forward" @click="jumpTo(stepIndex + 1)">&gt;</button>
      <button class="rounded border border-border px-1.5 py-0.5 hover:bg-surface" title="End" @click="jumpTo(maxStep)">&gt;|</button>
      <input
        type="range"
        class="mx-1 flex-1"
        min="0"
        :max="maxStep"
        :value="stepIndex"
        @input="jumpTo(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="w-14 shrink-0 text-right text-muted/70">{{ stepIndex }} / {{ maxStep }}</span>
    </div>

    <div class="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_minmax(220px,320px)]">
      <div class="flex flex-col gap-3 rounded border border-border bg-panel p-2">
        <template v-for="(owner, ownerIdx) in boardOrder" :key="owner">
          <!-- Real turn/phase/active-player — only an engine-piloted trace
               ever sets these (scenarioReplay.ts's own `ReplaySnapshot.turn`/
               `activePlayer`/`phase` doc comment); a harness.ts flat scenario
               has no real turn concept, so this divider just doesn't render
               for one. Placed right before the LAST board (boardOrder always
               ends with 'you' — see playerRoles), so it sits between the
               opponent(s)' board(s) and yours regardless of opponent count. -->
          <div
            v-if="ownerIdx === boardOrder.length - 1 && snapshot.turn !== undefined"
            class="flex items-center gap-1.5 self-start rounded bg-surface/50 px-2 py-1 font-mono text-[10px] text-muted"
          >
            <span class="rounded bg-surface px-1.5 py-0.5 text-text">Turn {{ snapshot.turn }}</span>
            <span>{{ snapshot.activePlayer === 'you' ? 'Your' : `${snapshot.activePlayer}'s` }} turn</span>
            <span class="text-muted/50">·</span>
            <span>{{ snapshot.phase }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span
                class="flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase transition-colors duration-300"
                :class="snapshot.activePlayer === owner ? 'text-warn' : 'text-muted'"
              >
                <span v-if="snapshot.activePlayer === owner" class="h-1.5 w-1.5 rounded-full bg-warn" />
                {{ owner === 'you' ? 'You' : owner }}
              </span>
              <span
                class="rounded px-1 text-[10px] transition-colors duration-300"
                :class="prevLife && prevLife[owner] !== snapshot.life[owner] ? 'bg-warn/15 text-text' : 'text-muted'"
              >
                <Transition name="life-pop">
                  <span :key="snapshot.life[owner] ?? 20">{{ snapshot.life[owner] ?? 20 }} life</span>
                </Transition>
                <template v-if="prevLife && prevLife[owner] !== snapshot.life[owner]">
                  <span :class="(snapshot.life[owner] ?? 20) > (prevLife[owner] ?? 20) ? 'text-produce' : 'text-warn'">
                    ({{ (snapshot.life[owner] ?? 20) > (prevLife[owner] ?? 20) ? '+' : '' }}{{ (snapshot.life[owner] ?? 20) - (prevLife[owner] ?? 20) }})
                  </span>
                </template>
              </span>
            </div>
            <div class="relative transition-[width] duration-500 ease-out" :style="{ width: boardWidth(owner) + 'px', height: boardHeight() + 'px' }">
              <div
                v-for="zr in zonesFor(owner)"
                :key="zr.zone"
                class="absolute rounded border border-dashed transition-[left,width] duration-500 ease-out"
                :class="ZONE_COLOR[zr.zone]"
                :style="{ left: zr.x + 'px', top: 0, width: zr.width + 'px', height: boardHeight() + 'px' }"
              >
                <span class="absolute top-0.5 left-1 text-[9px] text-muted/50">{{ zr.label }}</span>
              </div>
              <Transition
                v-for="card in ownerCards(owner).filter((c) => c.zone !== 'Unknown')"
                :key="card.key"
                name="card-pop"
              >
                <div
                  class="absolute shrink-0 transition-[left,top] duration-500 ease-out"
                  :style="cardStyle(card)"
                  :title="displayName(card) + (card.tapped ? ' (tapped)' : '')"
                >
                  <div class="relative transition-transform duration-300" :class="card.tapped ? 'rotate-90' : ''">
                    <div v-if="imagesFor(card)" class="flip-outer h-[126px] w-[90px]">
                      <div class="flip-inner h-full w-full" :class="{ flipped: !!card.faceName }">
                        <img
                          :src="imagesFor(card)![0]"
                          alt=""
                          class="flip-face front h-full w-full rounded-[3px] border object-cover transition-shadow duration-300"
                          :class="highlighted.has(card.name) ? 'border-warn ring-1 ring-warn/60' : 'border-border-subtle'"
                        />
                        <img
                          v-if="imagesFor(card)![1]"
                          :src="imagesFor(card)![1]"
                          alt=""
                          class="flip-face back h-full w-full rounded-[3px] border object-cover transition-shadow duration-300"
                          :class="highlighted.has(card.name) ? 'border-warn ring-1 ring-warn/60' : 'border-border-subtle'"
                        />
                      </div>
                    </div>
                    <div
                      v-else
                      class="flex h-[126px] w-[90px] items-center justify-center rounded-[3px] border font-mono text-[9px] transition-colors duration-300"
                      :class="highlighted.has(card.name) ? 'border-warn bg-warn/10 text-text' : 'border-border-subtle bg-surface text-muted'"
                    >
                      {{ placeholderLabel(card) }}
                    </div>
                    <span
                      v-if="Object.keys(card.counters).length"
                      class="absolute -right-1 -bottom-1 rounded bg-warn px-0.5 text-[8px] leading-tight text-bg"
                    >
                      <template v-for="(amount, type) in card.counters" :key="type">{{ amount }}{{ type }}</template>
                    </span>
                    <span
                      v-if="card.qty > 1"
                      class="absolute -top-1 -right-1 rounded bg-surface px-0.5 text-[8px] leading-tight text-text"
                    >
                      ×{{ card.qty }}
                    </span>
                    <div
                      v-if="iconKeywords(card).length"
                      class="absolute top-0 left-0 flex gap-0.5 rounded-br-[3px] bg-bg/80 px-0.5 py-0.5"
                    >
                      <AbilityIcon v-for="kw in iconKeywords(card)" :key="kw" :keyword="kw" :size="10" class="text-text/90" />
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </template>
      </div>

      <div class="flex flex-col gap-2">
        <!-- Actions: the primary clickable list driving the slider, when
             this trace has them (an engine-piloted trace — see harness.ts's
             own `TraceResult.actions` doc comment). -->
        <div v-if="hasActions" class="max-h-36 overflow-x-auto overflow-y-auto rounded border border-border bg-panel p-2">
          <table class="w-full border-collapse font-mono text-[10px] whitespace-nowrap">
            <thead>
              <tr class="bg-panel text-muted/70 uppercase sticky top-0">
                <th class="pr-2 pb-1 text-left font-normal">#</th>
                <th class="pb-1 text-left font-normal">action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(act, ai) in trace.actions"
                :key="ai"
                :ref="(el) => (stepRows[ai] = el as HTMLElement | null)"
                class="cursor-pointer align-top"
                :class="stepIndex === ai ? 'bg-surface' : 'hover:bg-surface/50'"
                @click="jumpTo(ai)"
              >
                <td class="py-0.5 pr-2 text-muted/50">{{ ai }}</td>
                <td class="py-0.5 whitespace-pre-wrap text-text">{{ act.label }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Raw log: the primary (and only) list for a harness.ts flat
             scenario (no actions); a smaller, secondary detail panel scoped
             to just the current action's own entries otherwise — not
             something this replay needs to make especially readable, just
             not thrown away (still useful for debugging). -->
        <div class="max-h-36 overflow-x-auto overflow-y-auto rounded border border-border bg-panel p-2" :class="{ 'max-h-24': hasActions }">
          <table class="w-full border-collapse font-mono text-[10px] whitespace-nowrap">
            <thead>
              <tr class="bg-panel text-muted/70 uppercase sticky top-0">
                <th class="pr-2 pb-1 text-left font-normal">#</th>
                <th class="pr-2 pb-1 text-left font-normal">fn</th>
                <th class="pb-1 text-left font-normal">fields</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(entry, ei) in hasActions
                  ? trace.log.slice(trace.actions![stepIndex]!.from, actionEnds[stepIndex]!).filter((e) => !e.fn.startsWith('read:'))
                  : log"
                :key="ei"
                :ref="(el) => { if (!hasActions) stepRows[ei] = el as HTMLElement | null; }"
                class="align-top"
                :class="[hasActions ? '' : 'cursor-pointer', !hasActions && stepIndex === ei + 1 ? 'bg-surface' : 'hover:bg-surface/50']"
                @click="hasActions ? undefined : jumpTo(ei + 1)"
              >
                <td class="py-0.5 pr-2 text-muted/50">{{ ei + 1 }}</td>
                <td class="py-0.5 pr-2 text-text">{{ entry.fn }}</td>
                <td class="py-0.5 whitespace-pre-wrap text-muted">{{ fieldsOf(entry) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A real DFC flip (rotateY), not a cut — Tailwind has no 3D-transform
   utilities, so this one bit of visual behavior lives in plain CSS. */
.flip-outer {
  perspective: 400px;
}
.flip-inner {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s ease;
}
.flip-inner.flipped {
  transform: rotateY(180deg);
}
.flip-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.flip-face.back {
  transform: rotateY(180deg);
}

/* A card's first appearance on the board (or, in principle, its removal) —
   fades and scales in rather than popping, same spirit as the zone-move
   `transition-[left,top]` bound in cardStyle() above. */
.card-pop-enter-active,
.card-pop-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}
.card-pop-enter-from,
.card-pop-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

/* A life total change gets a brief pop rather than just changing digits. */
.life-pop-enter-active {
  transition:
    transform 0.3s ease,
    color 0.3s ease;
}
.life-pop-enter-from {
  transform: scale(1.35);
}
</style>
