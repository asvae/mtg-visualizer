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
  libraryCount,
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
import { TOKENS } from '../../functional-model/tokens';
import type { ContinuousKeywordGrant } from '../../server/api/card/[set]/[number]';

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
  /** The tested card's own real printed power/toughness (front, then back for a transforming DFC whose back face is also a creature) — app/pages/app/card/[set]/[number].vue's own `card.power`/`toughness`/`backPower`/`backToughness`. Raw Scryfall strings ("3", "*", ...), same reasoning `cardImages`/`cardKeywords` already use real external data for the one `isSelf` chip instead of tracking it in the trace itself. */
  cardPower?: string;
  cardToughness?: string;
  cardBackPower?: string;
  cardBackToughness?: string;
  /** See ScenarioReplay.vue's own doc comment on this prop — real art/keywords for any OTHER genuinely-named real card, keyed by name. Always populated (ScenarioReplay.vue itself resolves it generically via `/api/cards/by-names`); a caller's own richer data (currently only the keywords-coverage page) is merged on top there, not a replacement for it. */
  namedCardArt?: Record<string, { images: string[]; keywords: string[]; power?: string; toughness?: string }>;
  /** The tested card's own real `CardDefinition.continuousKeywordGrants` (front, then back for a transforming DFC) — see `continuousGrantedKeywords`'s own doc comment just below for how this gets cross-referenced against a live snapshot instead of a discrete log entry. */
  continuousKeywordGrants?: { front?: ContinuousKeywordGrant[]; back?: ContinuousKeywordGrant[] } | null;
}>();

/** One or two image URLs to show for this card (front, then back for a flipping self) — undefined when this card has no real art to show (an old-style synthetic filler, `placeholderLabel` covers it instead), or when it's real hidden information (a card sitting in Library — real MTG rules, a library is secret; the `card-back` branch below covers that instead, even for a real-identity filler like GENERIC_FILLER_LAND that this file otherwise happily shows real art for everywhere else). `namedCardArt` (keyed by this card's own real name) is checked FIRST, ahead of the singular `isSelf`-only `cardImages` prop below — it covers the exact same tested "self" card just as well when present (see its own doc comment), PLUS any other real card a scenario puts on the board that isn't `isSelf` at all (e.g. summon-bahamut's own bystander Ahriman/Coeurl, or flying-reach's own Iron Giant blocking Ahriman on the keywords page — none of these is ever marked `isSelf`, see scenarioReplay.ts's own `instanceId`-driven detection). */
function imagesFor(card: GroupedReplayCard): string[] | undefined {
  if (card.zone === 'Library') return undefined;
  const named = props.namedCardArt?.[card.name];
  if (named?.images.length) return named.images;
  if (card.isSelf) return props.cardImages?.length ? props.cardImages : undefined;
  const filler = props.fillerImages?.[card.name];
  return filler ? [filler] : undefined;
}

/** This card's own real printed keywords — `namedCardArt` by name when present (any real card a keywords-page scenario references), else the singular `cardKeywords` prop for the `isSelf` card only (per-card page's own Scenarios tab), else none (a bystander/filler with no real identity of its own). */
function printedKeywords(card: GroupedReplayCard): string[] {
  const named = props.namedCardArt?.[card.name];
  if (named) return named.keywords;
  return card.isSelf ? (props.cardKeywords ?? []) : [];
}

// Real subtype list for a NAMED TOKEN creature (functional-model/tokens.ts's
// `TOKENS` registry), keyed by the token's own printed name (`ReplayCard.name`
// for a `createToken`-made chip is always `TOKENS[key].name` — see
// scenarioReplay.ts's own `createToken` case) — built once, module scope,
// same "plain data, no engine execution" import ScenarioReplay.vue's own
// `tokenNameToKeys` map already establishes for this file's sibling. Unlike
// that map, an ambiguous name (two TOKENS keys sharing one name, e.g. "Cat")
// is safe to resolve to ANY one matching key here — every current variant of
// a shared name has the SAME subtype list (they only ever differ by
// printed keyword, e.g. w_1_1_cat vs w_1_1_cat_lifelink), so there is no
// "wrong pick" the way there is for art. A real bystander creature (not a
// TOKENS-registry token) has no entry here — see `continuousGrantedKeywords`'s
// own doc comment for why that's an accepted, documented gap rather than a
// silent wrong answer.
const TOKEN_SUBTYPES_BY_NAME = new Map<string, string[]>();
for (const def of Object.values(TOKENS)) {
  if (!TOKEN_SUBTYPES_BY_NAME.has(def.name)) {
    TOKEN_SUBTYPES_BY_NAME.set(
      def.name,
      def.types.filter((t) => !['Creature', 'Artifact', 'Enchantment', 'Land'].includes(t)),
    );
  }
}
function subtypesOf(card: GroupedReplayCard): string[] {
  return TOKEN_SUBTYPES_BY_NAME.get(card.name) ?? [];
}

/**
 * A real, QUERY-TIME continuous keyword grant (613, ENGINE_GAPS.md gap #14,
 * closed 2026-09-12 — see `functional-model/state.ts`'s own `effectiveKeywords`
 * doc comment for the engine-side read path this mirrors) — "Dion and other
 * Knights you control have flying," "Demons you control have menace,
 * lifelink, and haste." Unlike every other keyword source this file reads
 * (`printedKeywords`, `card.keywords` off a `grantKeyword` log entry), a
 * continuous grant is NEVER a discrete event — nothing "happens" at a single
 * log step to represent "the grant is active right now," so there is no
 * `fn:'grantKeyword'`-style entry for it to read (Dion's own `scenarios.ts`
 * can only prove it fired with a manual `read:hasKeyword` query at ONE
 * instant — see that file's own comment — and even that never names the
 * Knight token specifically, only Dion himself). Recalculating it HERE, at
 * render time, once per snapshot/card, is the only way a board chip that
 * isn't the granting permanent itself (the Knight token, not Dion) ever gets
 * the icon at all — and the only way it correctly toggles off again once the
 * turn passes to an opponent (`grant.onlyDuringYourTurn`), rather than being
 * permanently on or off for the whole replay.
 *
 * Deliberately generic — reads whichever grant(s) `props.continuousKeywordGrants`
 * describes for THIS card's own front/back face, no Dion-specific branch.
 * Two real, accepted gaps, both because `ReplayCard` doesn't (yet) track the
 * field a grant would need to check:
 *  - `grant.subtype`-matched OTHER permanents only resolve via the TOKENS
 *    registry (`subtypesOf` above) — a real BYSTANDER creature (not a
 *    functional-model token) has no served subtype data anywhere in this
 *    pipeline today, so it can never match a subtype-scoped grant. Not hit by
 *    any currently-authored scenario (checked: no card combines a subtype
 *    grant with a real non-token bystander of that subtype).
 *  - `grant.equippedBySelf` (Dragoon's Lance's own "equipped creature has
 *    flying") is never matched — `scenarioReplay.ts`'s own `equip` case
 *    doesn't record WHICH creature an Equipment is attached to, only that
 *    both chips exist. A real, flagged follow-up, not fixed here (out of
 *    this task's own scope — Dion's grant is subtype-based, not
 *    equipment-based).
 */
function continuousGrantedKeywords(card: GroupedReplayCard): string[] {
  const self = snapshot.value.cards.find((c) => c.isSelf);
  if (!self || self.zone !== 'Battlefield' || card.zone !== 'Battlefield') return [];
  // `faceName` is only ever set once a transform has moved display away from
  // the stable front `name` (see `ReplayCard.faceName`'s own doc comment in
  // scenarioReplay.ts) — so its mere presence means "currently showing the
  // back face," which face's own grants (if any) apply instead of the front's.
  const grants = (self.faceName ? props.continuousKeywordGrants?.back : props.continuousKeywordGrants?.front) ?? [];
  if (!grants.length) return [];
  // `undefined` activePlayer (a flat harness.ts scenario, never a real turn)
  // reads as "yes, it's this permanent's controller's turn" — the exact same
  // default `state.ts`'s own `isActiveOrDefault` uses, so a turn-conditional
  // grant isn't silently, permanently off outside an engine-piloted trace.
  const activePlayer = snapshot.value.activePlayer;
  const out = new Set<string>();
  for (const grant of grants) {
    if (grant.onlyDuringYourTurn && activePlayer !== undefined && activePlayer !== self.owner) continue;
    const isSelfMatch = grant.includeSelf && card.isSelf;
    const isMatchingOther = !!grant.subtype && !card.isSelf && card.owner === self.owner && subtypesOf(card).includes(grant.subtype);
    if (isSelfMatch || isMatchingOther) for (const kw of grant.keywords) out.add(kw);
  }
  return [...out];
}

/** This card's keywords worth a badge — its own real printed ones (see `printedKeywords`) plus anything `grantKeyword` added mid-scenario, plus any real continuous grant (`continuousGrantedKeywords`) currently in effect, filtered down to what AbilityIcon.vue actually has a glyph for. */
function iconKeywords(card: GroupedReplayCard): string[] {
  const all = new Set([...printedKeywords(card), ...card.keywords, ...continuousGrantedKeywords(card)]);
  return [...all].filter((k) => ABILITY_ICON_NAMES.has(k));
}

/** This card's CURRENT power/toughness (base, then real 704.5r/107.11 layer 7d +1/+1 / -1/-1 counters, then layer 7c `pump`), or undefined when it isn't a creature right now. Self's own base comes from the real Scryfall props (`cardPower`/`cardToughness`, back-face variants once `faceName` shows a transform has flipped it) — a "*" or otherwise non-numeric base (variable P/T, e.g. Tarmogoyf) can't be added to, so those render no badge rather than a wrong number. Every other chip's base is `card.power`/`toughness` (seeded from `ps.creaturePower`, a real named token's own basePower/baseToughness, or a `createToken`/`copyPermanent` entry — see scenarioReplay.ts) — undefined for anything that isn't a creature, same "no field set = no badge" rule. Confirmed against real usage (`ui`'s own browser check on Aerith, fin/4): a +1/+1 counter alone must move this number, not just show up in the separate counter badge — the two badges together should always foot to the SAME real total a player would count on the card. */
function ptFor(card: GroupedReplayCard): [number, number] | undefined {
  // Only on the battlefield — a card sitting in Hand (or anywhere else
  // off it) isn't "currently" anything; no pump/counters apply there, and
  // the badge only means "this creature's live stats right now."
  if (card.zone !== 'Battlefield') return undefined;
  let base: [number, number] | undefined;
  if (card.isSelf) {
    const flipped = !!card.faceName;
    const p = Number(flipped ? props.cardBackPower : props.cardPower);
    const t = Number(flipped ? props.cardBackToughness : props.cardToughness);
    if (Number.isFinite(p) && Number.isFinite(t)) base = [p, t];
  } else if (card.power !== undefined && card.toughness !== undefined) {
    base = [card.power, card.toughness];
  }
  if (!base) return undefined;
  const counterMod = (card.counters['+1/+1'] ?? 0) - (card.counters['-1/-1'] ?? 0);
  return [base[0] + counterMod + (card.powerMod ?? 0), base[1] + counterMod + (card.toughnessMod ?? 0)];
}

/** True when `ptFor`'s current value differs from this card's own base (a `pump` effect is live right now) — the P/T badge renders in a different color for this, same convention paper Magic UIs use for a buffed/debuffed creature (just one color here, not split by direction — see this file's own header for why "real, not curated" keeps this simple). */
function ptModified(card: GroupedReplayCard): boolean {
  return !!(card.powerMod || card.toughnessMod);
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
/** A manual override into `rawSnapshots` — set by clicking a specific raw-log row within the current action's span (`jumpToRaw`), cleared whenever `stepIndex` itself changes (see the `watch` below). Lets a bundled multi-entry action (a transform plus everything else on the way to the next labeled action, e.g.) be split apart and watched one real event at a time, without demoting any of those events into a fake action of their own. */
const rawOverride = ref<number | undefined>(undefined);
/** Which index into `activeSnapshots` the CURRENT `stepIndex` resolves to — `rawOverride` when set, else the end of the current action, or `stepIndex` itself in the no-actions fallback (today's exact meaning). */
const activeIndex = computed(() => (hasActions.value ? (rawOverride.value ?? actionEnds.value[stepIndex.value] ?? 0) : stepIndex.value));
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
/** Whether `card` was touched THIS step — `entryRefs` keys by `${owner}:${name}` when an entry has a derivable owner, bare `name` otherwise (see that function's own doc comment on why: two players sharing a fungible name, GENERIC_FILLER_LAND, would otherwise both glow for one player's own draw). Checks both shapes since not every fn carries an owner. */
function isHighlighted(card: GroupedReplayCard): boolean {
  return highlighted.value.has(`${card.owner}:${card.name}`) || highlighted.value.has(card.name);
}

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
  }, 2550);
}
function toggle() {
  playing.value ? pause() : play();
}
function jumpTo(i: number) {
  pause();
  stepIndex.value = Math.min(maxStep.value, Math.max(0, i));
}
/** Jump the board to one specific raw-log index within the CURRENT action's own span, without changing `stepIndex`/the action selection — see `rawOverride`'s own doc comment. `i` is a `rawSnapshots` index (log entries processed so far), same convention `jumpTo` uses for the no-actions fallback. */
function jumpToRaw(i: number) {
  pause();
  rawOverride.value = i;
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
  rawOverride.value = undefined;
  const rowIndex = hasActions.value ? i : i - 1;
  stepRows.value[rowIndex]?.scrollIntoView({ block: 'nearest' });
});

/** The current action's own raw entries, each tagged with its ABSOLUTE index into `trace.log` (not its position within this filtered/sliced sub-array) — `jumpToRaw` needs that absolute index (same convention `rawSnapshots` itself indexes by), which a plain `.slice().filter()` in the template would have thrown away. Only computed when there's an action to scope to. */
const currentActionRawEntries = computed(() => {
  if (!hasActions.value) return [];
  const from = props.trace.actions![stepIndex.value]!.from;
  const end = actionEnds.value[stepIndex.value]!;
  return props.trace.log
    .map((entry, idx) => ({ entry, idx }))
    .slice(from, end)
    .filter((row) => !row.entry.fn.startsWith('read:'));
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
      <!-- `min-w-0` — without it, a grid item's default min-width (`auto`)
           refuses to shrink below its content's intrinsic width, so a wide
           board (many cards in one zone) would grow this WHOLE grid track
           instead of scrolling within it, pushing the actions/trace column
           off to the right instead of staying put. -->
      <div class="flex min-w-0 flex-col gap-3 overflow-x-auto rounded border border-border bg-panel p-2">
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
                <!-- Library is facedown — nothing in there is ever
                     individually distinguishable by sight, so it renders as
                     a plain count instead of one card-back chip per
                     fungible group (see computeZoneRects's own doc comment
                     for why this zone alone is a fixed one-slot width). -->
                <span
                  v-if="zr.zone === 'Library'"
                  class="absolute inset-0 flex items-center justify-center font-mono text-lg text-muted"
                  >{{ libraryCount(snapshot.cards, owner) }}</span
                >
              </div>
              <!-- Keyed on qty too, not just identity (`card.key` alone) —
                   a fungible pile (several same-named lands drawn one at a
                   time, e.g.) never moves position when its qty ticks up,
                   so with an identity-only key Vue just patches the "×N"
                   text in place: real for the FIRST card ever drawn into an
                   empty Hand (a brand new key pops in), but every
                   subsequent same-named draw showed no visible change at
                   all (confirmed the hard way — a second Forest drawn had
                   no motion). Appending qty forces the card-pop transition
                   to replay on every count change, at the same screen
                   position either side, cross-fading old->new sizes —
                   `cardStyle`'s own position math still reads `card.key`
                   directly (untouched), this only affects Vue's own vdom
                   reconciliation key. -->
              <Transition
                v-for="card in ownerCards(owner).filter((c) => c.zone !== 'Unknown' && c.zone !== 'Library')"
                :key="`${card.key}:${card.qty}`"
                name="card-pop"
              >
                <div
                  class="absolute shrink-0 transition-[left,top] duration-500 ease-out"
                  :style="cardStyle(card)"
                  :title="displayName(card) + (card.tapped ? ' (tapped)' : '')"
                >
                  <div
                    class="relative rounded-[3px] transition-transform duration-300"
                    :class="[card.tapped ? 'rotate-90' : '', card.attacking ? 'ring-2 ring-red-500' : card.blocking ? 'ring-2 ring-blue-500' : '']"
                  >
                    <div v-if="imagesFor(card)" class="flip-outer h-[126px] w-[90px]">
                      <div class="flip-inner h-full w-full" :class="{ flipped: !!card.faceName }">
                        <img
                          :src="imagesFor(card)![0]"
                          alt=""
                          class="flip-face front h-full w-full rounded-[3px] border object-cover transition-shadow duration-300"
                          :class="isHighlighted(card) ? 'border-warn ring-1 ring-warn/60' : 'border-border-subtle'"
                        />
                        <img
                          v-if="imagesFor(card)![1]"
                          :src="imagesFor(card)![1]"
                          alt=""
                          class="flip-face back h-full w-full rounded-[3px] border object-cover transition-shadow duration-300"
                          :class="isHighlighted(card) ? 'border-warn ring-1 ring-warn/60' : 'border-border-subtle'"
                        />
                      </div>
                    </div>
                    <div
                      v-else
                      class="flex h-[126px] w-[90px] items-center justify-center rounded-[3px] border font-mono text-[9px] transition-colors duration-300"
                      :class="isHighlighted(card) ? 'border-warn bg-warn/10 text-text' : 'border-border-subtle bg-surface text-muted'"
                    >
                      {{ placeholderLabel(card) }}
                    </div>
                  </div>
                  <!-- Badges live OUTSIDE the rotating div on purpose — they
                       used to be children of it, so a tapped card's
                       `rotate-90` rotated THEM too, moving e.g. the ×N qty
                       badge to a different visual corner (confirmed the hard
                       way: a tapped fungible pile's own ×N label went
                       missing, just rotated somewhere else/overlapping
                       another badge). This outer div is unrotated and
                       auto-sized to the card's own unrotated 90x126 box
                       (a CSS transform never changes layout size), so every
                       badge below anchors to a stable corner regardless of
                       tapped state. -->
                  <span
                    v-if="ptFor(card)"
                    class="absolute bottom-0 left-1/2 -translate-x-1/2 rounded bg-surface px-1 text-[8px] leading-tight"
                    :class="ptModified(card) ? 'text-blue-400' : 'text-text'"
                  >
                    {{ ptFor(card)![0] }}/{{ ptFor(card)![1] }}
                  </span>
                  <span
                    v-if="Object.keys(card.counters).length"
                    class="absolute -right-1 -bottom-1 rounded bg-warn px-0.5 text-[8px] leading-tight text-bg"
                  >
                    <template v-for="(amount, type) in card.counters" :key="type">{{ amount }}{{ type }}</template>
                  </span>
                  <span
                    v-if="card.powerMod || card.toughnessMod"
                    class="absolute -left-1 -bottom-1 rounded bg-accent px-0.5 text-[8px] leading-tight text-bg"
                  >
                    {{ (card.powerMod ?? 0) >= 0 ? '+' : '' }}{{ card.powerMod ?? 0 }}/{{ (card.toughnessMod ?? 0) >= 0 ? '+' : '' }}{{ card.toughnessMod ?? 0 }}
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
                  <div
                    v-if="card.animatedTypes?.length"
                    :title="card.animatedTypes.join(' ')"
                    class="absolute right-0 bottom-4 rounded-l-[3px] bg-bg/80 px-0.5 text-[8px] leading-tight text-text/80"
                  >
                    {{ card.animatedTypes.join(' ') }}
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
             to just the current action's own entries otherwise. Clickable
             either way — an action can bundle several real events (a
             transform plus everything else that happened along the way to
             the next labeled action, e.g.), and jumping to one specific raw
             entry (`jumpToRaw`) is the only way to see the board split apart
             mid-action instead of only before/after the whole thing (lost
             the ability to watch a bundled transform's own flip animate
             alone once actions[] grouping landed — this restores it without
             demoting the event back into a fake action). -->
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
                v-for="row in hasActions ? currentActionRawEntries : log.map((entry, ei) => ({ entry, idx: ei }))"
                :key="row.idx"
                :ref="(el) => { if (!hasActions) stepRows[row.idx] = el as HTMLElement | null; }"
                class="cursor-pointer align-top"
                :class="hasActions ? (rawOverride === row.idx + 1 ? 'bg-surface' : 'hover:bg-surface/50') : stepIndex === row.idx + 1 ? 'bg-surface' : 'hover:bg-surface/50'"
                @click="hasActions ? jumpToRaw(row.idx + 1) : jumpTo(row.idx + 1)"
              >
                <td class="py-0.5 pr-2 text-muted/50">{{ row.idx + 1 }}</td>
                <td class="py-0.5 pr-2 text-text">{{ row.entry.fn }}</td>
                <td class="py-0.5 whitespace-pre-wrap text-muted">{{ fieldsOf(row.entry) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A generic MTG card-back look for a Library-zone filler chip — no real
   Scryfall "back of any card" image exists to fetch (checked; nothing
   stable enough to depend on), so this is a plain CSS approximation
   instead: a dark radial ground plus the rhombus outline every real Magic
   card back centers, not an attempt at a pixel match. */
.card-back {
  background: radial-gradient(circle at 50% 40%, #3a2a1e 0%, #1a1006 70%, #0d0803 100%);
}

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
