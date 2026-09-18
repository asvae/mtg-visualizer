<script setup lang="ts">
// The card-detail "content" block — CardMedia + review-status table +
// annotated oracle text + the Facts/Scenarios/Facts Json/Card Json/Card
// Definition tab strip + Interactions + the Scryfall link — factored out of
// `app/pages/app/card/[set]/[number].vue` (2026-09-15). Briefly consolidated
// away on 2026-09-18 into `app/pages/app/engine/cards/[set]/[[number]].vue`
// (the internal engine-console tab) alone, then restored same day per
// explicit user direction: the user-facing `/app/card/...` route and the
// internal `/app/engine/cards/...` route are kept as separate routes going
// forward, both mounting this SAME component for their content (may diverge
// later, doesn't today) — so the graph page's
// of its own separate, older `CardMedia` + `CardRelations` pairing (dropped
// entirely — `CardRelations.vue` itself is unused now; nothing else in the
// app references it as of this change, left in place rather than deleted
// outright since removing an app/components/*.vue file wholesale wasn't
// asked for and `TooltipView.vue`-style hover chips reuse the same
// describeRelation/groupChipsByVerb pipeline independently). This is what
// the full card page ALREADY mounts wholesale, and what the peek panel now
// mounts too — one component, one place this content's shape lives, so a
// future change to the tab set can't silently leave the panel behind the way
// it did before this file existed.
//
// Deliberately does NOT own data-fetching, Previous/Next chrome, the
// deck-qty badge, or the pending/error/loading states — both callers keep
// those themselves (they render meaningfully differently: the full page
// keeps its header nav visible through a fetch, the panel shows a small
// centered spinner). This component only ever renders once a caller already
// has a resolved `CardResponse` in hand.
import { computed, inject, ref, watch } from 'vue';
import { factConditions, isSelfReferencing } from '../lib/factConditions';
import { orderByTextPosition, isFactRow, NON_FACT_SPAN_KIND_LABEL } from '../lib/factOrder';
import type { DisplayRow, FactRow, NonFactSpanRow } from '../lib/factOrder';
import { describeFact } from '../../functional-model/synergy';
import type { Fact } from '../../functional-model/synergy';
import { TYPE_DERIVED_RECOGNIZER_IDS } from '../../functional-model/recognizers/types';
import type { EnrichedInteractionGroup, AnnotatedNonFactSpan } from '../../server/api/card/[set]/[number]';
import type { ReviewStatus } from '../types';
import type { CardResponse } from '../lib/cardResponse';
import { StoreKey } from '../composables/useGraphStore';
import { CARD_STATUS_META } from '../lib/cardStatus';
import type { CardStatusBucket } from '../lib/cardStatus';
import { cardStatusBaseline } from '../../functional-model/card-status';
import { emitReviewStatusChanged } from '../composables/useReviewStatusBus';
import { PIPELINE_STATUS_META } from '../lib/pipelineStatus';
import { SINK_ATTACHMENT_STATUS_META } from '../lib/sinkAttachmentStatus';
import { statusBadgeStyle } from '../lib/badgeColor';
import type { PipelineStatusFile } from '../../functional-model/pipeline-status';
import type { SinkAttachmentFile, SinkAttachmentStatus } from '../../functional-model/sink-attachment';
import { SINK_CATALOG } from '../../functional-model/sink-model/catalog/index';
import type { SinkCatalogEntry } from '../../functional-model/sink-model/catalog/index';

// Debug column showing each row's raw `Fact` JSON, so it's inspectable
// without switching to the separate JSON tab or opening devtools. On by
// default (standing debug aid, not a one-off) — flip to false to hide it
// without deleting anything.
const SHOW_FACT_DEBUG_COLUMN = true;

const store = inject(StoreKey)!;

const props = defineProps<{
  data: CardResponse;
  // The card's own set/collector-number — needed for the Facts tab's
  // copy-context string and the review-status POST body. Passed as plain
  // strings rather than re-deriving from `useRoute()` here, since the peek
  // panel's own "route" is just a `?card=` query param it parses itself
  // (`store.panelCardKey`), not this component's concern either way.
  set: string;
  number: string;
}>();

const card = computed(() => props.data.card);

// **`fdn` vs `fin` are two genuinely different card kinds this one shared
// component now renders, not a generalized "any set" rule** — same "real
// branch, not a fake generalization" pattern this session already applied
// server-side (`server/api/card/[set]/[number].ts`'s own `loadFdnFunctional
// Model`, `server/api/card-status/[set].get.ts`'s own header). An FDN card
// has no Facts/synergy.json/interactions at all, FULL STOP — a firm
// policy, not just today's incidental state, structurally enforced by the
// `functional-model/fdn-cards/`-vs-`cards/` directory split itself (no code
// path anywhere writes a synergy.json for an FDN card). `scenarios.ts`
// (and therefore real `traces`) is different: no real FDN card has one
// TODAY (that only gets authored later, when a reviewer rejects a `blue`
// card and a smart-tier model writes one to investigate), but the
// Scenarios tab/its rendering machinery stay wired and ready for when one
// does — everything gated on this below either hides content that has no
// real FDN analog at all (the Facts tab, the Facts/Scenarios/Interactions
// review-status table — there is exactly ONE card-level review action on
// an FDN card, the pipeline-status Confirm/Reject block, no per-tab
// analogs) or swaps in the real, different thing FDN cards DO have instead
// (that same authoring-PIPELINE-STAGE Confirm/Reject block, see
// `pipelineStatusEntry` below). Keyed off `props.set` (not
// `props.data.functionalModel?.slug`, which is `null` for the common "no
// functional-model/fdn-cards/<slug> folder yet" case) — every caller of
// this component already has its own real `set` route param to hand.
const isFdn = computed(() => props.set === 'fdn');

// FDN's own authoring-pipeline-status axis (`functional-model/
// pipeline-status.ts`) — declared up here (not alongside the rest of the
// Confirm/Reject review logic further below) because the pre-existing
// `watch(() => props.data.functionalModel, ..., { immediate: true })`
// below resets it on every card load and runs its callback SYNCHRONOUSLY
// at `watch()`-call time — a `const` declared textually AFTER that call
// would still be in its temporal-dead-zone the instant that immediate
// callback fires, a real `ReferenceError` confirmed the hard way while
// building this. See the fuller doc comment on the rest of this axis
// (`canReviewPipeline`/`submitPipelineReview`/...) further down this file.
const pipelineStatusOverride = ref<PipelineStatusFile | null>(null);
const pipelineStatusEntry = computed<PipelineStatusFile | null>(() => pipelineStatusOverride.value ?? props.data.functionalModel?.pipelineStatus ?? null);
const pipelineStatusColor = computed(() => pipelineStatusEntry.value?.status ?? 'gray');
const pipelineStatusMeta = computed(() => PIPELINE_STATUS_META[pipelineStatusColor.value]);

// FDN's own per-card sink-ATTACHMENT axis (`functional-model/
// sink-attachment.ts`) — same-tab optimistic overlay + editable draft
// selection, declared up here (not alongside the rest of the Sinks-tab UI
// logic further down this file) for the exact same synchronous-immediate-
// watch TDZ reason `pipelineStatusOverride` above already documents (the
// combined `watch(() => props.data.functionalModel, ..., {immediate:true})`
// below resets/reinitializes these too). `selectedSinkSlugs` is the
// user's own currently-EDITED draft picker selection (may legitimately
// differ from the last-saved `sinkAttachmentEntry.attachedSlugs` until
// "Mark attachment reviewed" is clicked) — never written to directly by a
// server response, only by `toggleSinkSlug`/the reset logic below.
const sinkAttachmentOverride = ref<SinkAttachmentFile | null>(null);
const sinkAttachmentStatusOverride = ref<SinkAttachmentStatus | null>(null);
const sinkAttachmentEntry = computed<SinkAttachmentFile | null>(() => sinkAttachmentOverride.value ?? props.data.functionalModel?.sinkAttachment ?? null);
const sinkAttachmentStatus = computed<SinkAttachmentStatus>(
  () => sinkAttachmentStatusOverride.value ?? props.data.functionalModel?.sinkAttachmentStatus ?? 'not-started',
);
const selectedSinkSlugs = ref<string[]>([]);

// Per-card (not per-face) fact-authoring status badge — LIVE, computed
// fresh per request by the API route itself (server/api/card/[set]/
// [number].ts's own `FunctionalModelData.cardStatus`), not the static,
// only-refreshed-on-`npm run card-status` `data/fin/fin_card_status.json`
// batch snapshot this used to read via `app/lib/cardStatus.ts`'s own
// (now-removed) `getCardStatusEntry` (2026-09-16 — a confirmed real bug: a
// just-confirmed review didn't show as "Verified" here until that script
// was manually rerun). `CARD_STATUS_META` (color/label lookup table) is
// still the shared one from `app/lib/cardStatus.ts` — only the DATA lookup
// moved off that file's static import; the `/app/status` grid page also
// went live the same day, via its own `/api/card-status/[set]` route.
// `null` for a card the live computation couldn't classify at all
// (no functional-model card directory/definition) — the Facts tab's own
// strip label (below, via UTabs's `#leading` slot) renders nothing at all
// in that case. Lives in the tab strip, not next to the card name
// (`FunctionalModelText.vue`) — moved there 2026-09-16 same day, per
// explicit follow-up request; see this file's own git history/agent notes
// if the original name-row placement is ever wanted back.
const baseCardStatus = computed(() => props.data.functionalModel?.cardStatus ?? null);

// Same-tab optimistic overlay on top of `baseCardStatus` (2026-09-17,
// "Confirm (Uncertain)" UI action) — `baseCardStatus` only ever reflects
// whatever the server computed AT PAGE-LOAD time (`classifyCardStatus` is a
// live per-request computation, but this component never re-fetches the
// whole card after a review-status POST, only its own local
// factsReviewStatus/factsReviewCaveat refs), so without this, clicking
// Confirm/Unconfirm/"Confirm (Uncertain)" would flip the button's own label
// instantly but leave this badge showing a stale bucket until a full page
// reload. Mirrors `app/pages/app/status/index.vue`'s own
// `applyReviewStatusChange` — same safety rule: only ever narrows within the
// green/verified/uncertain triad (never invents a transition into/out of
// yellow/orange/red/gray/re-review locally, since only a real regen/live
// recompute can know that), reset to null whenever a genuinely new card
// loads (see the `factsReviewStatus` watcher below, which now also resets
// this).
const cardStatusOverride = ref<CardStatusBucket | null>(null);
function narrowedCardStatusReasons(reasons: string[]): string {
  return (reasons[0] ?? '').replace(/; human-reviewed$/, '').replace(/; flagged with a known caveat:.*$/, '');
}
const cardStatus = computed(() => {
  const base = baseCardStatus.value;
  const override = cardStatusOverride.value;
  if (!base || !override || (base.status !== 'green' && base.status !== 'verified' && base.status !== 'uncertain')) return base;
  const baseReason = narrowedCardStatusReasons(base.reasons);
  if (override === 'uncertain') {
    // Same truncate-to-200-chars convention `classifyCardStatus` itself uses
    // for this exact suffix (functional-model/card-status.ts's own
    // `truncate(trimmedCaveat, 200)` call).
    const caveat = factsReviewCaveat.value ?? '';
    const truncated = caveat.length > 200 ? `${caveat.slice(0, 199)}…` : caveat;
    return { ...base, status: 'uncertain', reasons: [`${baseReason}; flagged with a known caveat: ${truncated}`] };
  }
  if (override === 'verified') return { ...base, status: 'verified', reasons: [`${baseReason}; human-reviewed`] };
  return { ...base, status: 'green', reasons: [baseReason] };
});

// Badge tooltip text — `${label}: ${reasons.join(' ')}`. Checked directly
// against `functional-model/card-status.ts`'s own `classifyCardStatus`
// (2026-09-17, `uncertain` bucket): a `progress.json.reviewCaveat` is NOT
// threaded through as its own separate field on `CardStatusEntry` — the
// classifier folds a truncated (200-char) copy of it straight into this
// same `reasons` string ("...; flagged with a known caveat: <text>") before
// this ever reaches the API response, so no extra plumbing is needed here
// for the caveat to be visible: `reasons.join(' ')` already carries it on an
// `uncertain` card, same as every other bucket's own reasons text.
const cardStatusTitle = computed(() => (cardStatus.value ? `${CARD_STATUS_META[cardStatus.value.status].label}: ${cardStatus.value.reasons.join(' ')}` : ''));

// Real review-action gate (`.claude/contracts/card-schema.md`'s "Real,
// enforced gate DOES now exist for the REVIEW-ACTION side of this axis"
// section, 2026-09-18) — confirming/rejecting is meaningless on a
// `gray`/`purple`-baseline card ("was this card's fact-authoring ever
// actually claimed complete" is a precondition for "a human confirmed
// it"). `POST /api/card/review-status` already 400s a `reviewed:true`
// attempt server-side unless the CURRENT `cardStatusBaseline` is `blue`;
// this mirrors that same check client-side so the Confirm/"Confirm
// (Uncertain)" controls simply aren't there to click on an ineligible
// card, rather than surfacing that 400 as a confusing failed request.
// Reads `cardStatus` (this component's own live, same-tab-optimistic-
// aware badge state), not `baseCardStatus` — an in-flight/just-applied
// local override should immediately re-open (or, in principle, close) this
// gate the same instant it changes the visible badge, no extra reactivity
// needed. `null` (no functional-model directory at all, or the classifier
// couldn't run) is never eligible — same "pretend it doesn't exist" floor
// `gray`/`purple` already get.
const canConfirmCardStatus = computed(() => {
  const status = cardStatus.value?.status;
  return !!status && cardStatusBaseline(status) === 'blue';
});

// functional-model's own outline data — the card's v2 (SYNERGY_DESIGN.md)
// AI-authored, execution-verified attribute-bag facts
// (functional-model/cards/<slug>/synergy.json). `null` for a card not yet
// migrated to v2 (see synergy.value).
const synergy = computed(() => props.data.functionalModel?.synergy ?? null);
// Flattened for display — the underlying synergy.json/Fact[] split into
// `source`/`sink` arrays is a real structural distinction for the matcher
// (functional-model/synergy.ts), but each Fact already carries its own
// `role` field, so showing that split as two top-level JSON keys here is
// redundant, not informative — one array, same order the Facts tab's own
// table already uses (sink then source), is the more honest "what does one
// fact actually look like" view.
// A single Facts-tab row's debug cell shows only a compact single-line JSON
// summary inline (see factDebugJson below) — click opens the full
// pretty-printed fact JSON in this modal instead of relying on a native
// title-attribute hover tooltip, which stays exactly as hard to read as the
// inline text itself. (The JSON tab itself renders its own full JSON
// directly inline via JsonHighlight now — no modal indirection there, this
// modal is Facts-debug-cell-only.) `debugModalOpen`/`debugModalTitle`/
// `debugModalContent` follow AppHeader.vue's own `UModal v-model:open`
// convention. The modal itself is header-less (no `title` prop,
// `:close="false"`) so the JSON content is the sole visible thing, but a
// normal centered/sized box — NOT `fullscreen` (tried once, was too much
// per explicit correction) — `:ui="{ content: 'max-w-3xl' }"` caps its
// width the same way the very first (pre-fullscreen) version of this modal
// did. `debugModalTitle` is kept (write-only now) for a future
// accessible-name/breadcrumb use, not read by the template.
const debugModalOpen = ref(false);
const debugModalTitle = ref('');
const debugModalContent = ref('');
function openDebugModal(title: string, content: string) {
  debugModalTitle.value = title;
  debugModalContent.value = content;
  debugModalOpen.value = true;
}
const functionalModelJson = computed(() => (synergy.value ? JSON.stringify([...synergy.value.sink, ...synergy.value.source], null, 2) : null));
const cardJson = computed(() => (props.data.functionalModel?.annotatedCard ? JSON.stringify(props.data.functionalModel.annotatedCard, null, 2) : null));

// `factConditions` itself now lives in app/lib/factConditions.ts (extracted
// for real unit coverage — see that file's own header for why, and its
// sibling factConditions.test.ts) — imported above, not defined here.

// Same formula as FunctionalModelText.vue's own `factKey`, mirroring
// engine's own `factIdentity()` (functional-model/synergy.ts) — matches a
// table row's raw `Fact` to the fact(s) behind a linked phrase there, so
// hovering a row can highlight its own phrase in the annotated text.
// `Fact.id` was removed 2026-09-11; identity is now role + rendered label +
// the fact's own first real `annotations` entry (stringified). `annotations`
// is required by the TYPE, but only summon-bahamut's on-disk synergy.json
// actually carries it so far (pool-wide migration is separate, later work)
// — every other card's real facts lack the field despite the type, so this
// must tolerate `undefined` at runtime (confirmed live 500s otherwise,
// 2026-09-11).
function factKey(fact: Fact): string {
  return `${fact.role}::${describeFact(fact)}::${JSON.stringify(fact.annotations?.[0])}`;
}
// An ARRAY, not a single key (2026-09-16 follow-up) — two real Facts can
// share the exact identical annotation span (e.g. fin/4 Aerith
// Gainsborough's `[sink]` "Dying"/`[source]` "Dies" pair, both anchored to
// the same `dies-trigger-structural` line/char range — six more real pool
// cards share this shape, see FunctionalModelText.vue's own `highlightKeys`
// doc comment for the full list), so hovering that shared text span must
// highlight BOTH rows, and hovering either row must highlight the one
// shared span. `null`/empty = nothing hovered. A single-fact hover (the
// overwhelmingly common case) is still just a one-element array — pure
// widening, no behavior change there.
const hoveredFactKeys = ref<string[] | null>(null);
function isKeyHovered(key: string): boolean {
  return !!hoveredFactKeys.value?.includes(key);
}

// Parser-derived facts (`Fact.provenance?.origin === 'parser'` —
// functional-model/PRD_AUTOMATED_AUTHORING.md, see .claude/contracts/
// card-schema.md's "Parser-derived facts" section) are boilerplate an agent
// didn't have to author by hand (e.g. "this permanent enters the
// battlefield normally" on nearly every permanent) — real, correct facts,
// just not ones a reviewer needs to see by default. Default OFF so the
// normal per-card Facts view stays exactly as uncluttered as before this
// wiring landed; toggling shows them inline in the SAME text-ordered list
// (never a separate section — `feedback_facts_text_order_role_icon_only`),
// with a small provenance badge per row (see the Facts tab template).
// Lives on the shared store now (survives navigating away and back, and
// persists to localStorage — same treatment as store.functionalModelTab
// just below), not a local ref — see useGraphStore.ts's own comment on
// showParserFacts for why.
const showParserFacts = store.showParserFacts;
function isParserFact(fact: Fact): boolean {
  return fact.provenance?.origin === 'parser';
}

// Sibling toggle (2026-09-14) — "type-derived" facts, a strict SUBSET of
// parser-derived ones whose entire match is structurally implied by the
// card's own printed type/supertype alone (today's real pool: a Saga's
// lore-counter/sacrifice/dies facts — every Saga gets essentially the same
// mechanically-predictable facts, reviewing them per-card is repetitive
// busywork). Classification lives in `functional-model/recognizers/
// types.ts`'s own `TYPE_DERIVED_RECOGNIZER_IDS` (shared with the
// recognizer-coverage page's own identical checkbox,
// `server/api/recognizers/index.get.ts` + `RecognizerEntryCard.vue` — see
// that constant's own doc comment for the full "which recognizers qualify"
// reasoning, not re-derived here) — checked directly against this fact's own
// `provenance.rule` rather than a server-annotated flag, since `provenance`
// is already served per fact (same data the parser-derived toggle above
// already reads). Independent of `showParserFacts`: a fact can be
// type-derived AND parser-derived (true for every real Saga fact today),
// so a row's own visibility is gated by BOTH toggles' current states (see
// `factRowGroups` below), never just one implying the other.
const showTypeDerivedFacts = store.showTypeDerivedFacts;
function isTypeDerivedFact(fact: Fact): boolean {
  return !!fact.provenance?.rule && TYPE_DERIVED_RECOGNIZER_IDS.has(fact.provenance.rule);
}

// Third sibling toggle (2026-09-14) — "AI" facts, the exact complement of
// `isParserFact` (no `Fact.provenance` at all — hand-authored, never run
// through a recognizer). Default ON (see useGraphStore.ts's own comment on
// showAiFacts) so a fresh viewer sees no change from before this toggle
// existed. Same AND-gated combination as the other two in `factRowGroups`
// below, not a separate section.
const showAiFacts = store.showAiFacts;
function isAiFact(fact: Fact): boolean {
  return !isParserFact(fact);
}

// Fourth sibling toggle (2026-09-16) — "annotated non-Fact spans"
// (`progress.json`'s own `annotatedNonFactSpans`, see
// `.claude/contracts/card-schema.md`'s dated section). These rows are NOT
// Facts at all — no `role`, never fed to `factsInteract`/`themeOf` — so they
// get their own toggle rather than being folded into any of the three
// above; default OFF (real, but thin data pool-wide — one real entry as of
// this writing — so a normal viewer shouldn't see an extra row by default).
// `nonFactSpanRows` below wraps each raw span in the same `{ ..., key }`
// display-row shape `FactRow` already uses, so it can slot into the exact
// same `orderByTextPosition`-ordered, single text-ordered list
// (`feedback_facts_text_order_role_icon_only`) rather than a separate
// section.
const showAnnotatedNonFactSpans = store.showAnnotatedNonFactSpans;
const nonFactSpanRows = computed<NonFactSpanRow[]>(() => {
  const spans = props.data.functionalModel?.annotatedNonFactSpans ?? [];
  // Stable key: no `Fact.id`-style identity exists for these at all (they're
  // not Facts), so a span's own full position/kind tuple plus its index in
  // the authored array is used instead — unique enough for this array (two
  // spans can't share every one of these fields and still be a different
  // span) without needing a hash.
  return spans.map((span, i) => ({
    span,
    key: `nonfact::${i}::${span.target}::${span.line ?? -1}::${span.start}::${span.end}`,
  }));
});
// The toggle-gated subset actually shown/highlighted (2026-09-16 follow-up)
// — passed to BOTH the Facts tab's own row render (`factRowGroups` below)
// and FunctionalModelText.vue's `nonFactSpans` prop, so the checkbox
// controls the row and its printed-text highlight together. Built from the
// FULL `nonFactSpanRows` above (not re-keyed) so a span's own `key` stays
// stable regardless of the toggle's current state — required for the
// hover/highlight sync (`hoveredFactKeys`) to keep working correctly across
// a toggle flip.
const visibleNonFactSpanRows = computed<NonFactSpanRow[]>(() => (showAnnotatedNonFactSpans.value ? nonFactSpanRows.value : []));

// `describeFact()` (functional-model/synergy.ts, engine-owned) always
// returns its label lowercase. Capitalizing via CSS `::first-letter` on the
// label cell is fragile: it only targets the first TEXT NODE, so rows whose
// label is preceded by the "linked to card text" icon (a sibling element,
// not part of the text node) silently don't get capitalized. Capitalize the
// string itself instead, uniformly, regardless of what markup precedes it.
function factLabel(fact: Fact): string {
  const text = describeFact(fact);
  return text.length ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// Every fact now links to something real — a body oracle-text span
// (isFactAnnotated) or, failing that, the header name (isHeaderLinkedFact) —
// so a dedicated icon glyph no longer distinguishes anything (it was on
// every row). The underlying link behavior is unchanged, just moved onto the
// row's own label span instead of a separate icon element: a body-linked
// label's hover-highlight already comes free from the row's own
// hoveredFactKeys handlers on <tr> (unchanged, see the template); a
// header-linked label additionally flashes the header name on hover and
// scrolls to it + pops its tooltip on click, via the three helpers below.
function factLinkTitle(fact: Fact): string | undefined {
  if (isFactAnnotated(fact)) return 'Linked to card text';
  if (isHeaderLinkedFact(fact)) return 'Linked to the card name above — click to jump to it';
  return undefined;
}
function onFactLabelEnter(fact: Fact) {
  if (isHeaderLinkedFact(fact)) headerHighlightIndex.value = factFaceIndex(fact);
}
function onFactLabelLeave(fact: Fact) {
  if (isHeaderLinkedFact(fact)) headerHighlightIndex.value = null;
}
function onFactLabelClick(fact: Fact) {
  if (isHeaderLinkedFact(fact)) scrollToHeaderName(factFaceIndex(fact));
}

// Debug column: a small icon button only (no raw JSON text rendered in the
// cell itself) — click opens the full pretty-printed JSON in the shared
// debug modal (see `openDebugModal` above).
function factDebugJsonPretty(fact: Fact): string {
  return JSON.stringify(fact, null, 2);
}
function openFactDebugModal(fact: Fact) {
  openDebugModal(`Fact JSON — ${factKey(fact)}`, factDebugJsonPretty(fact));
}

// Recognizer-source modal for a parser-derived fact's own provenance — a
// dedicated third debug-column button (`isParserFact(row.fact)` gates it in
// the template, so it only ever renders for a fact that actually names a
// `provenance.rule`), separate from the plain JSON modal above and from the
// role column's own `wand-sparkles` icon (which marks the OPPOSITE case, an
// agent-authored fact with no rule to show at all — the two never appear on
// the same row). Fetches the recognizer's real TypeScript source from
// `GET /api/recognizer-source/:rule` (server/api/recognizer-source/
// [rule].get.ts, allowlist-gated) and renders it via `FunctionalModelScript`
// — same highlighter the card's own Script tab already uses below. Cached
// per-rule in a plain module-scope-adjacent `Map` (not a `ref`, since the
// cache itself never needs to be reactive — only the currently-displayed
// code/error/loading refs below do) so re-opening the same rule's modal
// within this page's lifetime never re-fetches.
const recognizerSourceCache = new Map<string, string>();
const recognizerSourceModalOpen = ref(false);
const recognizerSourceModalRule = ref('');
const recognizerSourceModalCode = ref('');
const recognizerSourceModalError = ref('');
const recognizerSourceModalLoading = ref(false);
async function openRecognizerSourceModal(rule: string) {
  recognizerSourceModalRule.value = rule;
  recognizerSourceModalOpen.value = true;
  recognizerSourceModalError.value = '';
  const cached = recognizerSourceCache.get(rule);
  if (cached !== undefined) {
    recognizerSourceModalCode.value = cached;
    recognizerSourceModalLoading.value = false;
    return;
  }
  recognizerSourceModalCode.value = '';
  recognizerSourceModalLoading.value = true;
  try {
    const res = await $fetch<{ rule: string; content: string }>(`/api/recognizer-source/${rule}`);
    recognizerSourceCache.set(rule, res.content);
    recognizerSourceModalCode.value = res.content;
  } catch (err) {
    // A rule missing from the server's own allowlist, or a genuinely
    // missing file on disk, both 404 via `createError({statusMessage})`
    // server-side — but ofetch's own `FetchError.statusMessage` is the raw
    // HTTP status TEXT ("Not Found"), not that JSON body; the real message
    // lives on `err.data.statusMessage`/`err.data.message` (`err.data` is
    // ofetch's parsed response body). Fall back through both plus the
    // generic `Error.message` for a network-level failure with no response
    // at all (offline, CORS, etc).
    const data = err && typeof err === 'object' ? (err as { data?: { statusMessage?: unknown; message?: unknown } }).data : undefined;
    const message =
      (typeof data?.statusMessage === 'string' && data.statusMessage) ||
      (typeof data?.message === 'string' && data.message) ||
      (err instanceof Error ? err.message : 'Unknown error');
    recognizerSourceModalError.value = `Could not load recognizer source for "${rule}": ${message}`;
  } finally {
    recognizerSourceModalLoading.value = false;
  }
}

// Copy-fact-context button, sitting next to the debug-JSON braces icon in the
// same cell: copies a full one-line context string — "<set>/<number> #<row
// number> [source|sink] <label>[ · <conditions>] · <provenance>" (e.g.
// "fin/21 #3 [source] Dying · yours · (Creature/Artifact) permanent · once
// per turn · parser:diesTrigger" or "fin/305 #2 [source] Create a token ·
// hand-authored (not recognizer-verified)") — built from the SAME rendered
// `factLabel`/`factConditions` text already shown in this row's own cells,
// not reformatted from raw JSON. `#<row number>` is the fact's 1-based
// position in the table's own DISPLAYED order (`factOrderIndex`, already
// computed below for the Interactions panel's own reordering — matches what
// a person actually sees counting rows down the table, not raw synergy.json
// source/sink array order). The bracketed `[source]`/`[sink]` tag mirrors
// this row's own role icon (`log-out`/blue = source, `log-in`/green = sink,
// just above) — spelled out in full rather than abbreviated ("SO"/"SI", used
// by an earlier now-removed version of this button) since the whole point of
// this string is unambiguous parsing by whoever it's pasted to (typically an
// AI agent), and a full word in its own delimiter reads as a role tag at a
// glance with zero risk of being mistaken for label text.
//
// Trailing provenance segment (2026-09-16) — reuses the same `isParserFact`
// check the "AI"/"type-keywords"/"other" filter toggles and per-row icons
// above already gate on (`Fact.provenance?.origin === 'parser'`), not a
// re-derivation: `parser:<rule>` for a recognizer-derived fact (the rule
// name is what actually makes a pasted fact self-explanatory about which
// recognizer produced it — the source can be pulled up via the row's own
// "View recognizer source" button), or the literal
// `hand-authored (not recognizer-verified)` when `provenance` is absent —
// deliberately spelled out rather than silently omitted, since a reader of
// pasted text has no other way to tell "no provenance field" from "the
// button forgot to include it"; the whole point of this segment existing is
// making that distinction visible in copied output, not just on-screen.
// `copiedFactKey` briefly swaps the button's own icon to a checkmark as
// click feedback, keyed by `row.key` so only the clicked row's button flips.
const copiedFactKey = ref<string | null>(null);
function factContextText(row: FactRow): string {
  const cardRef = `${props.set}/${props.number}`;
  const index = factOrderIndex.value.get(row.key);
  const role = row.fact.role === 'source' ? 'source' : 'sink';
  const label = factLabel(row.fact);
  const conditions = factConditions(row.fact);
  const provenance = isParserFact(row.fact) ? `parser:${row.fact.provenance?.rule ?? '?'}` : 'hand-authored (not recognizer-verified)';
  const text = conditions ? `${label} · ${conditions} · ${provenance}` : `${label} · ${provenance}`;
  return `${cardRef} #${index === undefined ? '?' : index + 1} [${role}] ${text}`;
}
async function copyFactContext(row: FactRow) {
  await navigator.clipboard.writeText(factContextText(row));
  copiedFactKey.value = row.key;
  setTimeout(() => {
    if (copiedFactKey.value === row.key) copiedFactKey.value = null;
  }, 1000);
}

// Every fact — including `addMana` events — renders as its own plain row,
// same convention as any other fact (no card-owned grouping/collapsing;
// see .claude/contracts/card-schema.md for what's engine- vs. card-owned).
// Source-array-then-sink-array — synergy.json's own authored order, the
// order a human reads the file in. This is only the BASE order now, not
// the final displayed one — `factRowGroups` below reorders each group by
// printed oracle-text position (`orderByTextPosition`,
// app/lib/factOrder.ts), using this authored order purely as the
// predecessor-lookup/tiebreak sequence for a fact with no textual anchor
// of its own. `FactRow` itself is defined there too (shared with
// `orderByTextPosition`'s own signature) rather than redeclared here.
// Every fact on this card (source + sink), synergy.json's own authored
// order — the base set `factRows`/`orderedAllDisplayRows` build from below.
// NOT what gets passed to FunctionalModelText.vue anymore (see
// `visibleSynergyFacts` just below) — this is deliberately the full,
// unfiltered set, since the ordering/toggle-filtering pipeline downstream
// needs the whole authored list to work from.
const allSynergyFacts = computed<Fact[]>(() => (synergy.value ? [...synergy.value.source, ...synergy.value.sink] : []));
const factRows = computed<FactRow[]>(() => allSynergyFacts.value.map((fact) => ({ fact, key: factKey(fact) })));
// Filtered by the SAME three fact-provenance toggles that gate the Facts
// tab's own rows (`factRowGroups` below) — 2026-09-16 follow-up, closing a
// real, confirmed-live gap: the printed oracle text's own inline
// highlights (FunctionalModelText.vue's `facts` prop) and the header
// name's own self-fact underline (`headerFaceFacts` below) used to always
// receive the FULL unfiltered `allSynergyFacts`, so unchecking e.g.
// "other" still left every parser-derived fact's phrase highlighted in the
// printed text even though its row was gone from the table. Toggling a
// checkbox now shows/hides both the row AND its corresponding text
// highlight together, matching the same toggle state either way.
const visibleSynergyFacts = computed<Fact[]>(() =>
  allSynergyFacts.value.filter(
    (fact) => (showAiFacts.value || !isAiFact(fact)) && (showTypeDerivedFacts.value || !isTypeDerivedFact(fact)) && (showParserFacts.value || !isParserFact(fact)),
  ),
);

// Multi-face Facts split (Adventure-layout Town lands, e.g. fin/293
// Zanarkand, Ancient Metropolis // Lasting Fayth) — the user wants the
// flat Facts table grouped by which face of the card each fact belongs to
// ("Main card" = the front face, "Other faces/functions" = everything
// else) rather than one undifferentiated list. Only rendered when there's
// actually more than one face (`annotatedFaces.value.length > 1`) — the
// vast majority of cards are single-faced and keep today's flat,
// ungrouped table exactly as before.
//
// Placement signal: the fact's own author-set `Fact.face`
// (functional-model/synergy.ts) — `'front'` -> Main card, `'back'` -> Other
// faces/functions, see `isMainFaceFact` below, defined alongside
// `factRowGroups` since it's the actual per-row grouping decision. This
// used to be inferred purely from `annotateOracleText`'s oracle-text
// linking (a fact found in face 0's own oracleLines was "Main card",
// anything else — including a fact linked to NO face at all — defaulted to
// "Other faces/functions"). That heuristic mis-filed
// sidequest-catch-a-fish-cooking-campsite's own front-face
// `wants-artifact-or-creature-on-top` sink fact (no `sourceText`/`highlight`
// match at all) into "Other faces/functions" despite it genuinely being a
// front-face effect — exactly the gap `Fact.face` was added to close.
//
// 2026-09-11 `Fact.annotations` pointer rework (see `.claude/contracts/
// card-schema.md`): the old face-0-oracleLines-match fallback heuristic
// (for a fact with no `face` set at all) is gone — under the new pointer
// model, a fact's own `annotations` are computed relative to whichever
// face `Fact.face` already names (omitted = the single face on a
// single-faced card), so there's no longer an independent signal to infer
// "front" from a text match; `factFaceIndex` below just defaults an unset
// `face` to front (0) directly, same as the pointer contract's own
// "omitted-for-single-faced" convention already implies.
const annotatedFaces = computed(() => props.data.functionalModel?.annotatedCard?.faces ?? []);
const isMultiFace = computed(() => annotatedFaces.value.length > 1);
// A fact has a real textual anchor SOMEWHERE (any face) iff it carries at
// least one baked `Fact.annotations` entry (`AnnotationRef[]`,
// functional-model/synergy.ts, computed once by
// functional-model/scripts/compute-annotations.mjs from its own
// `sourceText`/`highlight`) — drives the Facts table's small per-row
// annotation icon. Replaces the old "walk every face's oracleLines segment
// tree looking for this fact's key" computation entirely; no server-built
// segment tree exists to walk anymore.
function isFactAnnotated(fact: Fact): boolean {
  return !!fact.annotations?.length;
}
// Reciprocal of `headerFaceFacts` below — every fact-key that ended up
// annotating the HEADER name (self-referencing, no real oracle-text anchor
// of its own) rather than a body phrase. Drives the Facts table's own row
// icon for exactly these facts: before this, a self-referencing fact (e.g.
// fin/1's "Cast a spell") rendered with no icon at all even though the
// header now underlines/tooltips it — the row looked like plain unlinked
// text while the header quietly carried the other half of the link. Same
// icon, same convention as `isFactAnnotated`'s body-link icon (see the
// Facts tab template) — the fact IS linked, just to the header instead of a
// body span, and the row should read that way too.
const headerLinkedFactKeys = computed(() => {
  const keys = new Set<string>();
  for (const facts of headerFaceFacts.value.values()) for (const f of facts) keys.add(factKey(f));
  return keys;
});
function isHeaderLinkedFact(fact: Fact): boolean {
  return headerLinkedFactKeys.value.has(factKey(fact));
}
// 0 ("front"/only face) or 1 ("back") for a raw `Fact` — the fact's own
// author-set `face` field (functional-model/synergy.ts's `Fact.face`,
// backfilled across every multi-face card in the pool) is the only signal
// now (see `annotatedFaces`'s own doc comment above for why the old
// text-match fallback heuristic is gone post-`Fact.annotations`-rework); an
// unset `face` defaults to front, matching the pointer contract's own
// "omitted-for-single-faced" convention. A genuinely single-faced card (the
// vast majority) always resolves to 0 regardless of `face` — there's no
// second face for anything to belong to. Shared by `isMainFaceFact` below
// (Facts table row grouping) and `headerFaceFacts` (the page header's own
// self-fact annotation, see below) so the two never disagree about which
// face a given fact belongs to.
function factFaceIndex(fact: Fact): number {
  if (annotatedFaces.value.length <= 1) return 0;
  return fact.face === 'back' ? 1 : 0;
}
// Replaces the old `row.fact.sourceText` hover tooltip — `sourceText`/
// `highlight` are no longer served on a `Fact` at all (moved engine-side to
// a separate, non-served `annotations-authoring.json`; see
// `.claude/contracts/card-schema.md`'s "Fact-to-oracle-text pointers"
// section) — so this derives equivalent full-sentence text straight off the
// fact's own baked `annotations` against the real served `annotatedCard`.
// `target: 'oracle'` shows the WHOLE line a span lives on (not just the
// exact highlighted substring — a full sentence reads better as a tooltip
// than a bare phrase, matching what the old `sourceText` tooltip used to
// show); `target: 'typeLine'` has no line structure to speak of, so it's
// just the exact `start`/`end` slice of the face's own single-line
// `typeLine`. A fact's `annotations` array can now have more than one real
// entry (2026-09-13 dedup-retagging pass, e.g. qiqirn-merchant/fin-65's
// merged `drawCard` fact unions a `cantrip` span and a `bigDraw` span into
// one fact) — every entry gets resolved and shown, not just the first, so
// the tooltip doesn't silently drop a real second clause the same file's
// `FunctionalModelText.vue` already highlights inline. Lines are joined
// with `\n` (a native `title` attribute renders embedded newlines fine) and
// deduped in case two annotations happen to resolve to the identical line/
// slice. Falls back to `describeFact(fact)` if this ever comes up empty
// (shouldn't happen — `annotations` is required with a minimum of one
// entry — but a raw pointer into a face that doesn't exist should never
// crash the row).
function factSourceText(fact: Fact): string {
  const face = annotatedFaces.value[factFaceIndex(fact)];
  const anns = fact.annotations ?? [];
  if (!anns.length || !face) return describeFact(fact);
  const texts: string[] = [];
  for (const ann of anns) {
    const text =
      ann.target === 'typeLine'
        ? face.typeLine.slice(ann.start, ann.end)
        : face.oracleText.split('\n')[ann.line];
    if (text && !texts.includes(text)) texts.push(text);
  }
  return texts.length ? texts.join('\n') : describeFact(fact);
}
function isMainFaceFact(row: FactRow): boolean {
  return factFaceIndex(row.fact) === 0;
}
// Same face-index convention as `factFaceIndex` above, for a non-Fact span
// row instead of a `Fact` — an unset `span.face` defaults to front, same
// "omitted-for-single-faced" convention `Fact.face` already uses.
function nonFactSpanFaceIndex(span: AnnotatedNonFactSpan): number {
  if (annotatedFaces.value.length <= 1) return 0;
  return span.face === 'back' ? 1 : 0;
}
// Generalizes `isMainFaceFact` over either row kind (`DisplayRow`) — the
// Facts tab's own multi-face grouping applies identically to a non-Fact
// span row.
function isMainFaceRow(row: DisplayRow): boolean {
  return (isFactRow(row) ? factFaceIndex(row.fact) : nonFactSpanFaceIndex(row.span)) === 0;
}
// A self-referencing fact (`isSelfReferencing`, app/lib/factConditions.ts —
// `subject`/`target` literally `'self'`, e.g. fin/1's own "cast a spell"/
// "dies" baseline facts) describes an implicit RULES action, not something
// literally printed on the card — there's no real oracle-text span for it
// to have a baked `Fact.annotations` entry, unlike a produce/consume fact
// whose annotation points at a real printed phrase. Rather
// than leaving it entirely unlinked, it gets the exact same underline+hover
// treatment as any other annotated fact, just anchored to the CARD'S OWN
// NAME in the page header instead of a body phrase — the card itself is
// the one thing a self-referencing fact is always, unambiguously "about".
// Skips a self fact that DOES have a real match somewhere (`isFactAnnotated`
// — e.g. fin/1's own "Sacrifice after IV" self-graveyard fact, whose
// annotation genuinely points at printed text) so a fact never ends
// up double-linked (its real span AND the header) — the header is strictly
// the fallback for a fact with no textual anchor at all.
// Keyed by `factFaceIndex` (shared with `isMainFaceFact` above) so a
// back-face-only self fact (e.g. an Adventure/DFC's own back-face-only
// zone-presence fact) annotates that face's own name in the header, never
// the front/combined title.
const headerFaceFacts = computed<Map<number, Fact[]>>(() => {
  const map = new Map<number, Fact[]>();
  if (!synergy.value) return map;
  // `visibleSynergyFacts` (not `allSynergyFacts`) — 2026-09-16, see that
  // computed's own comment: a currently-hidden fact's header underline
  // must disappear along with its row, same as a body-linked fact's.
  for (const fact of visibleSynergyFacts.value) {
    if (!isSelfReferencing(fact) || isFactAnnotated(fact)) continue;
    const idx = factFaceIndex(fact);
    const list = map.get(idx);
    if (list) list.push(fact);
    else map.set(idx, [fact]);
  }
  return map;
});
// Reciprocal direction of the header<->row link: which face name (by
// `factFaceIndex`) to visually flash while the user's hovering a
// header-linked fact row's icon in the Facts tab — passed down to
// FunctionalModelText.vue (which now owns the heading itself, and its own
// underline+hover tooltip recipe) as `headerHighlightIndex`.
const headerHighlightIndex = ref<number | null>(null);
// Template ref onto FunctionalModelText.vue's own instance — lets
// `scrollToHeaderName` below delegate into its exposed `scrollToFace`
// (see that component's own header-name markup/`defineExpose`) rather than
// this component reaching into that component's DOM/tooltip state directly.
const functionalModelTextRef = ref<{ scrollToFace: (index: number) => void } | null>(null);
// Bonus half of the reciprocal link: clicking a header-linked fact row's own
// icon (Facts tab) scrolls the face name it annotates back into view and
// pops the exact same tooltip that name's own hover shows (auto-hidden
// shortly after) — so the row's icon doesn't just look linked, clicking it
// visibly answers "linked to what" without the user hunting for the heading
// themselves.
function scrollToHeaderName(faceIndex: number) {
  functionalModelTextRef.value?.scrollToFace(faceIndex);
}
// Grouped view for the Facts tab template — a flat single group (no
// header rendered) when `!isMultiFace`, so a single-faced card's markup is
// completely unchanged; two labeled groups (skipping either one if it ends
// up empty) otherwise. Each group's own rows are further reordered by
// `orderByTextPosition` (app/lib/factOrder.ts) to follow the card's own
// printed oracle-text order (user's own request against fin/279 The Gold
// Saucer) — applied PER GROUP (front-face rows for "Main card"; every other
// face's rows for "Other faces/functions"), never one global cross-face
// position. `orderByTextPosition` no longer takes a `faces` argument
// (2026-09-11 `Fact.annotations` pointer rework) — each row's own fact
// already carries its own (line, start) position directly, no server-built
// segment tree left to walk; see that function's own doc comment.
// Full text-ordered row list, independent of the `showParserFacts`/
// `showTypeDerivedFacts`/`showAiFacts`/`showAnnotatedNonFactSpans` toggles —
// this (not the toggle-filtered render below) is what `factOrderIndex` is
// built from, since the Interactions panel sorts against that same index
// for EVERY interaction group, including ones whose fact happens to be a
// currently-hidden parser fact; hiding a row from the Facts tab's own
// render must not scramble that shared ordering for a still-listed
// interaction that references it. Non-Fact span rows are ALWAYS included
// here (never gated by `showAnnotatedNonFactSpans`, same reasoning) —
// appended AFTER this group's own fact rows, in their own authored
// (progress.json array) order, before the ONE `orderByTextPosition` call per
// group: since a span always carries a real, non-inherited position, its
// presence can't change any FACT's own carry-forward-resolved position
// (which only ever looks at preceding rows in the array actually passed
// in) — putting spans after every fact in the pre-sort input, rather than
// interleaved some other way, guarantees this computation is byte-identical
// to before this field existed whenever `annotatedNonFactSpans` is empty
// (the common case today), and behaves correctly (spans slot into their own
// real line/start position on the far side of the sort) whenever it isn't.
const orderedAllDisplayRows = computed<DisplayRow[]>(() => {
  if (!isMultiFace.value) return orderByTextPosition<DisplayRow>([...factRows.value, ...nonFactSpanRows.value]);
  const main: DisplayRow[] = [];
  const other: DisplayRow[] = [];
  for (const row of factRows.value) (isMainFaceFact(row) ? main : other).push(row);
  for (const row of nonFactSpanRows.value) (isMainFaceRow(row) ? main : other).push(row);
  return [...orderByTextPosition(main), ...orderByTextPosition(other)];
});
// `showParserFacts`/`showTypeDerivedFacts`/`showAiFacts` toggles all apply to
// a FactRow (a row must pass ALL THREE — see `isTypeDerivedFact`'s own
// comment on why they're independent, not one implying the other);
// `showAnnotatedNonFactSpans` is the sole gate for a `NonFactSpanRow` — a
// row must pass ALL THREE only if it's a Fact, so a fact-only toggle never
// hides a non-Fact span row or vice versa. Hidden rows never reach the
// Facts tab's own render at all (not just visually collapsed), but visible
// rows keep the exact same single, text-ordered list either way: hiding a
// row never changes where its neighbors land (`orderedAllDisplayRows` above
// is already in final order; filtering it preserves that order).
const factRowGroups = computed<{ label: string | null; rows: DisplayRow[] }[]>(() => {
  const visible = orderedAllDisplayRows.value.filter((row) =>
    isFactRow(row)
      ? (showParserFacts.value || !isParserFact(row.fact)) &&
        (showTypeDerivedFacts.value || !isTypeDerivedFact(row.fact)) &&
        (showAiFacts.value || !isAiFact(row.fact))
      : showAnnotatedNonFactSpans.value,
  );
  if (!isMultiFace.value) return [{ label: null, rows: visible }];
  const main: DisplayRow[] = [];
  const other: DisplayRow[] = [];
  for (const row of visible) (isMainFaceRow(row) ? main : other).push(row);
  return [
    { label: 'Main card', rows: main },
    { label: 'Other faces/functions', rows: other },
  ].filter((g) => g.rows.length > 0);
});
// `Fact.triggeredBy` cause/effect linking (2026-09-16) — hovering a Fact
// row whose own `triggeredBy` names a `Trigger` (functional-model/synergy.ts,
// e.g. `'onEnter'`) highlights every OTHER currently-visible fact sharing
// that exact same value, in a SECOND shade distinct from the hovered row's
// own (see the template's own row `:class`, `bg-fuchsia-400/15` vs.
// `bg-surface/60`) — "this is what I'm pointing at" vs. "this is what it's
// linked to," per the design's own two-shade requirement, no legend needed.
// Deliberately Facts-tab TABLE rows only — does not extend into
// FunctionalModelText.vue's oracle-text spans or the Interactions panel
// below (out of scope per this feature's own dispatch: "Facts-tab-list
// styling only"), unlike the shared-annotation-span `hoveredFactKeys`
// mechanism this reuses as its input, which does cross into both.
//
// A card can carry multiple INDEPENDENT trigger groups (two different
// `triggeredBy` values) — grouping by the literal string value (not by
// position/order) keeps every group naturally isolated from every other;
// nothing here assumes there's only one trigger per card.
//
// Built from `factRowGroups` (the toggle-filtered, currently-RENDERED rows),
// not the full unfiltered `factRows` — a fact hidden by one of the three
// provenance toggles has no row to highlight, so it must not appear as a
// phantom sibling either (its own row can't visually respond, and counting
// it would make an otherwise-empty group look non-empty for no visible
// reason).
const factsByTrigger = computed<Map<string, string[]>>(() => {
  const map = new Map<string, string[]>();
  for (const group of factRowGroups.value) {
    for (const row of group.rows) {
      if (!isFactRow(row) || !row.fact.triggeredBy) continue;
      const list = map.get(row.fact.triggeredBy);
      if (list) list.push(row.key);
      else map.set(row.fact.triggeredBy, [row.key]);
    }
  }
  return map;
});
// Reverse lookup — a visible fact row's own key to the `triggeredBy` value
// it carries (a fact only ever names ONE trigger, so this is a plain 1:1
// map, not a multi-value one like `factsByTrigger` above).
const triggerOfFactKey = computed<Map<string, string>>(() => {
  const map = new Map<string, string>();
  for (const [trigger, keys] of factsByTrigger.value) for (const key of keys) map.set(key, trigger);
  return map;
});
// Every OTHER visible fact key sharing a currently-hovered key's own
// `triggeredBy` value — empty whenever nothing's hovered, whenever the
// hovered fact carries no `triggeredBy` at all (the common case today), or
// whenever it's the only visible fact under its own trigger (nothing to
// link to yet). Derived from `hoveredFactKeys` (not a separate hover-
// tracking ref) so this reuses the exact same shared-span-aware hover state
// the rest of this file already maintains, rather than a parallel
// mechanism — hovering a shared-span pair (e.g. a "Dying"/"Dies" pair) with
// either fact carrying a `triggeredBy` correctly unions in that trigger's
// siblings too.
const triggerSiblingKeys = computed<Set<string>>(() => {
  const result = new Set<string>();
  const hovered = hoveredFactKeys.value;
  if (!hovered?.length) return result;
  for (const hk of hovered) {
    const trigger = triggerOfFactKey.value.get(hk);
    if (!trigger) continue;
    for (const sibling of factsByTrigger.value.get(trigger) ?? []) {
      if (!hovered.includes(sibling)) result.add(sibling);
    }
  }
  return result;
});
function isTriggerSibling(key: string): boolean {
  return triggerSiblingKeys.value.has(key);
}
// Total count of parser-derived facts on this card, independent of the
// toggle's own current state (unlike a "how many are hidden right now"
// count, which would go to 0 the moment the toggle is switched on and make
// its own guard/label disappear or read oddly).
const parserFactsCount = computed(() => factRows.value.filter((row) => isParserFact(row.fact)).length);
// Same reasoning, sibling count for the type-derived toggle — per-card (0
// for the vast majority of cards; only a Saga has any today).
const typeDerivedFactsCount = computed(() => factRows.value.filter((row) => isTypeDerivedFact(row.fact)).length);
// Same reasoning, third sibling count for the AI-facts toggle.
const aiFactsCount = computed(() => factRows.value.filter((row) => isAiFact(row.fact)).length);
// Same reasoning, fourth sibling count for the annotated-non-Fact-span
// toggle — per-card (0 for nearly every card today; only
// ultima-origin-of-oblivion has a real entry as of this writing).
const nonFactSpansCount = computed(() => nonFactSpanRows.value.length);

// Every fact-key's position in the card's own text order (`orderedAllDisplayRows`,
// "Main card" then "Other faces/functions" — deliberately the UNFILTERED
// list, not `factRowGroups`'s toggle-filtered render, so a currently-hidden
// parser fact's own real interactions still sort correctly below rather
// than silently dropping to the end; non-Fact span rows are also in this
// list but never referenced by an interaction group's own `factKey`, so they
// simply contribute no entry anyone looks up) — the single source of truth the
// Interactions panel below sorts against too (see `orderedInteractions`),
// rather than maintaining its own independent sort.
// Previously `findInteractionsForCard` (functional-model/synergy.ts) shipped
// interaction groups in plain sink-then-source authored order — the same
// order the Facts tab ITSELF used before `orderByTextPosition` was
// introduced (see that module's own header comment for why authored order
// stopped being the final word there) — so the two panels had quietly
// diverged since. Sorting here client-side (not by changing the engine's
// own `findInteractionsForCard` output — that's engine-owned per
// .claude/contracts/card-schema.md, and "which order the UI displays
// things in" is a card/UI presentation concern, not the matcher's) keeps
// the fix entirely on this side of that boundary.
const factOrderIndex = computed(() => {
  const map = new Map<string, number>();
  let i = 0;
  for (const row of orderedAllDisplayRows.value) map.set(row.key, i++);
  return map;
});

// Interactions panel's own groups, one per fact — reordered to match the
// Facts tab's rendered order above (each group's own `fact` is a `Fact`
// straight off this card's synergy.json, so its `factKey` always matches a
// `factRowGroups` row's own key). A group whose fact has no match at all in
// `factOrderIndex` (shouldn't happen — every interaction group's fact comes
// from this same card's own source/sink facts, all of which appear in
// `factRows`) sorts last rather than crashing or silently reordering
// unpredictably.
const orderedInteractions = computed<EnrichedInteractionGroup[]>(() => {
  const groups = props.data.interactions ?? [];
  return [...groups].sort((a, b) => {
    const ai = factOrderIndex.value.get(factKey(a.fact));
    const bi = factOrderIndex.value.get(factKey(b.fact));
    if (ai === undefined && bi === undefined) return 0;
    if (ai === undefined) return 1;
    if (bi === undefined) return -1;
    return ai - bi;
  });
});

// Functional model's own four views, tabbed instead of stacked
// <details>/<summary> spoilers — Facts is the default (the primary,
// AI-authored+verified representation this page leads with), the other
// three are progressively rawer looks at the same card (its trace.json
// scenario log, the synergy facts as literal JSON, then the hand-authored
// CardDefinition source itself). The active tab itself lives on the shared
// store (store.functionalModelTab), not a local ref here — both callers of
// this component (the full card page and the graph page's peek panel)
// unmount/remount navigating away and back, and the tab should stay put
// across that, not reset to 'facts' every time; see the store's own comment
// for why it's still session-only, not localStorage-persisted. This also
// means the full page and the peek panel share ONE current-tab selection —
// switching to Scenarios in the peek panel and then expanding to the full
// page lands on Scenarios there too, which reads as consistent rather than
// surprising.
// Dedicated local refs for `scenariosReview`/`interactionsReview`, NOT read
// directly off `props.data.functionalModel`, mirroring a real bug found the
// hard way on the full page before this component existed: `useFetch`'s
// `data` mutated in place (`data.value.functionalModel[field] = ...`) never
// invalidated a `computed()` that only tracked `data.value` itself as a
// dependency, not the nested property a plain in-place mutation touches —
// no amount of re-keying the consuming component fixes that, since a fresh
// instance still reads the same stale computed output. These two refs are
// real, independently reactive state, synced from the server response
// whenever a NEW card loads, and written directly (not routed back through
// `props.data`) whenever the user toggles one — no computed/nested-mutation
// trap either way.
const factsReviewStatus = ref<'ai' | 'human'>('ai');
// cards/<slug>/progress.json's own `reviewCaveat` (2026-09-17, "Confirm
// (Uncertain)" UI action) — same real/independently-reactive-ref treatment
// as factsReviewStatus above, for the same reason (a plain in-place mutation
// of `props.data` wouldn't invalidate a computed tracking only `props.data`
// itself). `null` = no caveat on file (a plain human/ai review, or never
// reviewed at all).
const factsReviewCaveat = ref<string | null>(null);
const scenariosReviewStatus = ref<'draft' | 'reviewed'>('draft');
const interactionsReviewStatus = ref<'draft' | 'reviewed'>('draft');
watch(
  () => props.data.functionalModel,
  (fm) => {
    factsReviewStatus.value = fm?.review === 'human' ? 'human' : 'ai';
    factsReviewCaveat.value = fm?.reviewCaveat ?? null;
    scenariosReviewStatus.value = fm?.scenariosReview ?? 'draft';
    interactionsReviewStatus.value = fm?.interactionsReview ?? 'draft';
    // A genuinely new card loaded — any same-tab optimistic cardStatus
    // narrowing from a PRIOR card's own review-status click must not leak
    // onto this one (see cardStatus's own doc comment above).
    cardStatusOverride.value = null;
    // Same reasoning, for the FDN pipeline-status axis's own optimistic
    // overlay (see pipelineStatusOverride's own doc comment above).
    pipelineStatusOverride.value = null;
    // Same reasoning, for the FDN sink-attachment axis's own optimistic
    // overlay + editable draft selection (see sinkAttachmentOverride's own
    // doc comment above) — the draft picker resets to whatever this
    // genuinely new card's own last-saved attachment already has (`[]` for
    // "no sinks.json at all yet", the same real "not started" case as any
    // other attachment field here).
    sinkAttachmentOverride.value = null;
    sinkAttachmentStatusOverride.value = null;
    selectedSinkSlugs.value = fm?.sinkAttachment?.attachedSlugs ? [...fm.sinkAttachment.attachedSlugs] : [];
  },
  { immediate: true }
);

// Card page's own two-state fields mapped onto ReviewStatusBadge.vue's
// shared 3-way `ReviewStatus` vocabulary (app/types.ts) — a card's facts/
// scenarios/interactions are always "there" (never `'not_implemented'`,
// that value's only ever reached by the keywords page's own gap entries),
// so only the other two values are ever produced here. Purely a display
// mapping — progress.json's own stored 'ai'/'human'/'draft'/'reviewed'
// values (and review-status.ts's contract) are completely unchanged.
const factsStatus = computed<ReviewStatus>(() => (factsReviewStatus.value === 'human' ? 'human_reviewed' : 'ai_reviewed'));
const scenariosStatus = computed<ReviewStatus>(() => (scenariosReviewStatus.value === 'reviewed' ? 'human_reviewed' : 'ai_reviewed'));
const interactionsStatus = computed<ReviewStatus>(() => (interactionsReviewStatus.value === 'reviewed' ? 'human_reviewed' : 'ai_reviewed'));

// cards/<slug>/verified-snapshot.json's own `capturedAt` (server/api/card/
// [set]/[number].ts's `FunctionalModelData.reviewSnapshotAt`) — read
// straight off `props.data` (no local ref of its own, unlike
// factsReviewStatus above): this is a read-only display, never flipped by
// toggleReviewStatus itself, so there's no optimistic-update case to cover.
// `null` renders nothing next to the Facts row's Confirm button (never
// confirmed, or confirmed before this snapshot mechanism existed and not
// yet backfilled).
const factsSnapshotAt = computed(() => props.data.functionalModel?.reviewSnapshotAt ?? null);
// No existing relative-time OR absolute-date util anywhere in app/
// (grepped for toLocaleDateString/Intl.DateTimeFormat/Intl.RelativeTimeFormat/
// "ago"/a date library — none found), so both formatters below are plain
// local helpers rather than matching a convention that doesn't exist yet.
// Label itself is RELATIVE ("2 hours ago") per explicit user feedback — the
// full absolute date+time lives in the `title` attribute instead (native
// hover tooltip), see the template below.
const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function formatRelativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now(); // negative for a past timestamp
  const absMs = Math.abs(diffMs);
  if (absMs < 60_000) return 'just now';
  for (const [unit, unitMs] of RELATIVE_TIME_UNITS) {
    if (absMs >= unitMs) return relativeTimeFormatter.format(Math.round(diffMs / unitMs), unit);
  }
  return 'just now';
}
const factsSnapshotDate = computed(() => {
  const at = factsSnapshotAt.value;
  if (!at) return null;
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? null : date;
});
const factsSnapshotLabel = computed(() => {
  const date = factsSnapshotDate.value;
  return date ? formatRelativeTime(date) : null;
});
// Full absolute date+time — shown on hover (native `title`) rather than in
// the label itself, so the always-visible text stays short.
const factsSnapshotAbsoluteLabel = computed(() => {
  const date = factsSnapshotDate.value;
  if (!date) return null;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
});
// A snapshot surviving while the CURRENT facts status has since fallen back
// to 'ai' means check-verified-regressions.mjs auto-reset it after this
// card's facts drifted post-review (see review-status.ts's own regression-
// guard comment) — worth a distinct, slightly louder treatment than the
// plain "still confirmed" case, per this task's own "reviewed-then-
// regressed vs never-reviewed" note, without a separate legend/tooltip
// system for what's still just a small inline label.
const factsSnapshotRegressed = computed(() => factsSnapshotAt.value !== null && factsReviewStatus.value !== 'human');
// Hover title: full absolute date+time always, plus the regression note
// appended when applicable (same "changed since" fact the amber color
// already signals, spelled out for anyone not relying on color alone).
const factsSnapshotTitle = computed(() => {
  const absolute = factsSnapshotAbsoluteLabel.value;
  if (!absolute) return undefined;
  return factsSnapshotRegressed.value ? `${absolute} — facts changed since this snapshot` : absolute;
});
// Item counts for the Facts/Json tab strip — a plain "how many rows exist"
// count, NOT a draft/review indicator (see the review-status table's own
// comment above for why THAT was deliberately pulled off the tab strip;
// this is an independent, unrelated thing). `undefined` (not `0`) whenever
// there's nothing to count — a not-yet-migrated card (`synergy` null) or a
// migrated card with genuinely zero scenarios recorded — so UTabs's own
// `v-if="item.badge || item.badge === 0"` renders no badge at all rather
// than a misleading "0"; Json/Card Definition never get one; both counts
// are `computed`, not read once, so they stay correct if `data`/`synergy`
// ever change without a full reload.
const factsCount = computed(() => (synergy.value ? synergy.value.source.length + synergy.value.sink.length : 0));
const scenariosCount = computed(() => props.data.functionalModel?.traces?.length ?? 0);
// FDN gets "Scenarios" + "Card Definition" only — no Facts (and, firmly,
// never will: no `synergy.json`/Facts JSON is ever generated for an FDN
// card at all, structurally enforced by the `fdn-cards/`-vs-`cards/`
// directory split itself, not just a UI-side omission — see `isFdn`'s own
// doc comment) and no Facts Json/Card Json either (both would just be
// empty: `functionalModelJson`/`cardJson` below are `null` whenever
// `synergy`/`annotatedCard` are, which is always true for an `fdn` entry —
// an empty tab that LOOKS like real content is worse than not offering it).
// Scenarios' own RENDERING machinery (the `v-else-if="scenarios"` branch
// below) stays ready for every real FDN card regardless — `scenarios.ts`
// only gets authored later, when a reviewer rejects a `blue` card and a
// smart-tier model writes one to investigate — no FDN-specific casing
// needed there, it already tolerates an empty `traces` array generically.
// The TAB itself, though (updated 2026-09-18, later still — see
// `functionalModelTabs` below's own current comment): omitted entirely
// whenever `scenariosCount` is zero, for either card kind, rather than
// shown and degrading to "No scenarios recorded." text — a tab that can
// only ever open onto empty-state text isn't a real affordance.
// Scenarios tab itself is omitted entirely (not shown with a "No scenarios
// recorded." body) whenever this card has zero real traces — added
// 2026-09-18, later still: a tab that can only ever render empty-state text
// is noise, not a real affordance, for the (currently-common) FDN case
// where no `scenarios.ts` has been authored yet, and equally for any real
// FIN card with a genuinely empty `traces` array. `functionalModelTabValue`
// below has its own matching read-only fallback for when the user's stored
// tab preference happens to be `'scenarios'` on a card that doesn't offer
// it right now.
// Explicit item type (rather than letting TS infer one from the ternary
// below) — added 2026-09-18, later still, alongside the new `'sinks'`
// branch: without it, TS's generic-component-prop inference for `UTabs`'s
// `:items` binding collapses the two ternary branches' own slightly
// differently-shaped literal-array types into a union that no longer
// type-checks against itself once a third distinct item shape (`'sinks'`)
// is in the mix — a real, narrow TS inference fragility, not a sign
// anything about the runtime shape is wrong. `badge` is optional/`number`
// on every branch now (both `undefined`-only members already tolerated
// this via `item.badge || undefined`), so one shared interface covers
// every real item any branch below produces.
interface FunctionalModelTabItem {
  label: string;
  value: 'facts' | 'scenarios' | 'json' | 'cardJson' | 'definition' | 'sinks';
  badge?: number;
}
const functionalModelTabs = computed<FunctionalModelTabItem[]>(() =>
  isFdn.value
    ? [
        ...(scenariosCount.value > 0 ? [{ label: 'Scenarios', value: 'scenarios' as const, badge: scenariosCount.value || undefined }] : []),
        { label: 'Sinks', value: 'sinks' as const, badge: sinkAttachmentEntry.value?.attachedSlugs.length || undefined },
        { label: 'Card Definition', value: 'definition' as const },
      ]
    : [
        { label: 'Facts', value: 'facts' as const, badge: factsCount.value || undefined },
        ...(scenariosCount.value > 0 ? [{ label: 'Scenarios', value: 'scenarios' as const, badge: scenariosCount.value || undefined }] : []),
        { label: 'Facts Json', value: 'json' as const },
        { label: 'Card Json', value: 'cardJson' as const },
        { label: 'Card Definition', value: 'definition' as const },
      ],
);
// The active tab VALUE, wrapping the shared `store.functionalModelTab` (see
// that ref's own comment for why it's shared/session-persisted across
// every caller of this component). `set` always writes straight through
// unconditionally — both `'scenarios'` and `'definition'` (the only two
// values `functionalModelTabs` ever offers for an `fdn` card, so `set` can
// never be called with anything else while `isFdn`) are equally valid
// values for a `fin` card too, so there's no FDN-specific value that would
// corrupt the FIN-facing selection by leaking across a kind switch. `get`
// DOES need an FDN-specific fallback, though: a store value left over from
// a previously-viewed FIN card (`'facts'`/`'json'`/`'cardJson'`) has no
// matching tab for an `fdn` card at all — without this, the raw
// `v-else-if` chain below (which switches on the tab VALUE directly,
// independent of what `functionalModelTabs` currently lists) would render
// that branch's own FIN-flavored "not yet migrated to v2 synergy.json"
// fallback text for an FDN card, which is actively misleading (an FDN card
// was never "migrated" to anything — it simply never gets a synergy.json
// at all, a very different statement). Falls back to `'definition'`,
// read-only — never writes that fallback back into the store, so
// navigating back to the FIN card afterward still resumes exactly where it
// left off.
//
// Second, independent fallback (same read-only shape, added 2026-09-18,
// later still, alongside `functionalModelTabs`'s own new zero-scenarios
// omission above): a stored `'scenarios'` value is only ever meaningful
// when the CURRENT card actually has a Scenarios tab to select at all — a
// card with zero traces doesn't offer one (see `functionalModelTabs`
// above), so without this the raw `v-else-if` chain below would render
// nothing for that value. Falls back to whichever tab is this card kind's
// own sensible default (`'definition'` for `isFdn`, `'facts'` otherwise) —
// read-only, never written back, so a user who genuinely prefers Scenarios
// still resumes there the next time they land on a card that has some.
const functionalModelTabValue = computed<'facts' | 'scenarios' | 'json' | 'cardJson' | 'definition' | 'sinks'>({
  get: () => {
    const stored = store.functionalModelTab.value;
    if (isFdn.value && stored !== 'scenarios' && stored !== 'sinks') return 'definition';
    if (stored === 'scenarios' && scenariosCount.value === 0) return isFdn.value ? 'definition' : 'facts';
    return stored;
  },
  set: (v) => {
    store.functionalModelTab.value = v;
  },
});

// Dev-only — see server/api/card/review-status.ts's own header for why
// (writes into the repo's functional-model/ source tree; refused outright
// server-side outside dev too, this just keeps a doomed-to-403 button from
// showing at all on a real deployment).
const isDev = import.meta.dev;

// POSTs cards/<slug>/progress.json's own `review`/`scenariosReview`/
// `interactionsReview` field (see server/api/card/review-status.ts) and
// updates the matching local ref above directly — no need to refetch the
// whole card just for this one field, and refetching would also re-run
// every trace live (computeTracesLive) for no reason.
//
// Optimistic: the local ref flips to its new value BEFORE the request is
// awaited (not after `res.json()` resolves), so the review-status table's
// Draft pill/Confirm button reflect the click instantly rather than waiting
// on the round-trip. `reviewStatusSaving` still disables the button while a
// request for this field is in flight (guards against a double-click racing
// two writes), but that's just a disabled state layered on top of the
// already-flipped value, not a "wait to show the change" gate. On a non-ok
// response or a thrown request, the snapshot taken before the optimistic
// flip is restored — same rollback either way.
const reviewStatusSaving = ref<'review' | 'scenariosReview' | 'interactionsReview' | null>(null);
async function toggleReviewStatus(field: 'review' | 'scenariosReview' | 'interactionsReview') {
  if (!props.data.functionalModel || reviewStatusSaving.value) return;
  const reviewed =
    field === 'review' ? factsReviewStatus.value !== 'human' : field === 'scenariosReview' ? scenariosReviewStatus.value !== 'reviewed' : interactionsReviewStatus.value !== 'reviewed';

  const prevFacts = factsReviewStatus.value;
  const prevFactsCaveat = factsReviewCaveat.value;
  const prevScenarios = scenariosReviewStatus.value;
  const prevInteractions = interactionsReviewStatus.value;
  const prevCardStatusOverride = cardStatusOverride.value;
  const applyLocal = (value: 'ai' | 'human' | 'draft' | 'reviewed') => {
    if (field === 'review') factsReviewStatus.value = value as 'ai' | 'human';
    else if (field === 'scenariosReview') scenariosReviewStatus.value = value as 'draft' | 'reviewed';
    else interactionsReviewStatus.value = value as 'draft' | 'reviewed';
  };
  // Optimistic flip — happens synchronously, before the fetch below even
  // starts, so the UI never waits on the network for this.
  applyLocal(
    field === 'review' ? (reviewed ? 'human' : 'ai') : reviewed ? 'reviewed' : 'draft'
  );
  // A plain Confirm click (this is the pre-existing toggle button, never
  // passes an explicit caveat) always CLEARS any stale caveat — mirrors
  // server/api/card/review-status.ts's own "plain confirm supersedes a
  // stale caveat claim" behavior exactly, so the local state doesn't drift
  // from what the server is about to do. Unconfirm (`!reviewed`) leaves it
  // untouched either side, same "un-reviewing doesn't erase evidence of
  // prior review" reasoning that field's own oracleTextSnapshot follows.
  if (field === 'review') {
    if (reviewed) factsReviewCaveat.value = null;
    cardStatusOverride.value = reviewed ? 'verified' : 'green';
  }

  reviewStatusSaving.value = field;
  try {
    const res = await fetch('/api/card/review-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `set`/`number`: only actually used server-side for `field ===
      // 'review'` (see review-status.ts's own oracle-text snapshot comment)
      // — sent unconditionally since this component always has them to hand
      // (a caller's own route/URL params) and the server ignores them for
      // the other two fields. No `reviewCaveat` key at all here — this is
      // the PLAIN confirm/unconfirm path (see confirmFactsReviewWithCaveat
      // below for the "Confirm (Uncertain)" one), and an absent key is
      // exactly what makes the server clear any existing caveat.
      body: JSON.stringify({ name: card.value.name, field, reviewed, set: props.set, number: props.number }),
    });
    if (res.ok) {
      // Reconcile with the server's own authoritative value (expected to
      // already match the optimistic one — this just closes the loop).
      const body = await res.json();
      if (field === 'review') {
        factsReviewStatus.value = body.review;
        factsReviewCaveat.value = typeof body.reviewCaveat === 'string' ? body.reviewCaveat : null;
      } else if (field === 'scenariosReview') scenariosReviewStatus.value = body.scenariosReview;
      else interactionsReviewStatus.value = body.interactionsReview;

      // Cheap same-tab broadcast (see useReviewStatusBus.ts's own header)
      // so app/pages/app/status/index.vue's status grid, if it happens to
      // be mounted right now (its own peek panel, or a prior/next browser
      // tab-history mount), can optimistically re-color this exact card's
      // square without a Pinia rework or a fin_card_status.json re-fetch.
      // Only the `review` field feeds that page's own green/verified/
      // uncertain narrowing — scenariosReview/interactionsReview don't
      // affect any square's color, so those two fields don't emit.
      if (field === 'review') {
        emitReviewStatusChanged({ set: props.set, number: props.number, review: body.review, reviewCaveat: factsReviewCaveat.value ?? undefined });
      }
    } else {
      factsReviewStatus.value = prevFacts;
      factsReviewCaveat.value = prevFactsCaveat;
      scenariosReviewStatus.value = prevScenarios;
      interactionsReviewStatus.value = prevInteractions;
      cardStatusOverride.value = prevCardStatusOverride;
    }
  } catch {
    factsReviewStatus.value = prevFacts;
    factsReviewCaveat.value = prevFactsCaveat;
    scenariosReviewStatus.value = prevScenarios;
    interactionsReviewStatus.value = prevInteractions;
    cardStatusOverride.value = prevCardStatusOverride;
  } finally {
    reviewStatusSaving.value = null;
  }
}

// "Confirm (Uncertain)" button (2026-09-17) — a THIRD facts-review action,
// distinct from the plain Confirm/Unconfirm toggle above: always a forced
// CONFIRM (`reviewed: true`), never a toggle, even when the card is already
// `human`-reviewed (re-affirming, or downgrading the confidence of, an
// existing review with a fresh caveat is still a real confirm action, per
// this task's own "uncertain should be handled the same as reviewed for all
// intents and purposes" instruction — same snapshot/regression-guard
// participation as a plain confirm, see server/api/card/review-status.ts's
// own widened snapshot condition).
async function confirmFactsReviewWithCaveat(reviewCaveat: string | undefined) {
  if (!props.data.functionalModel || reviewStatusSaving.value) return;
  const prevFacts = factsReviewStatus.value;
  const prevFactsCaveat = factsReviewCaveat.value;
  const prevCardStatusOverride = cardStatusOverride.value;
  factsReviewStatus.value = 'human';
  factsReviewCaveat.value = reviewCaveat ?? null;
  cardStatusOverride.value = reviewCaveat ? 'uncertain' : 'verified';

  reviewStatusSaving.value = 'review';
  try {
    const res = await fetch('/api/card/review-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: card.value.name,
        field: 'review',
        reviewed: true,
        set: props.set,
        number: props.number,
        // Only included when non-empty — an empty/whitespace-only prompt
        // result is handled by confirmUncertain below BEFORE this function
        // is ever called (treated as a plain confirm instead), so a real
        // caller here always has real text; still guarded defensively.
        ...(reviewCaveat ? { reviewCaveat } : {}),
      }),
    });
    if (res.ok) {
      const body = await res.json();
      factsReviewStatus.value = body.review;
      factsReviewCaveat.value = typeof body.reviewCaveat === 'string' ? body.reviewCaveat : null;
      cardStatusOverride.value = factsReviewCaveat.value ? 'uncertain' : 'verified';
      emitReviewStatusChanged({ set: props.set, number: props.number, review: body.review, reviewCaveat: factsReviewCaveat.value ?? undefined });
    } else {
      factsReviewStatus.value = prevFacts;
      factsReviewCaveat.value = prevFactsCaveat;
      cardStatusOverride.value = prevCardStatusOverride;
    }
  } catch {
    factsReviewStatus.value = prevFacts;
    factsReviewCaveat.value = prevFactsCaveat;
    cardStatusOverride.value = prevCardStatusOverride;
  } finally {
    reviewStatusSaving.value = null;
  }
}

// Prompts for the caveat text (native `window.prompt`, pre-filled with the
// card's own current caveat if any — makes re-confirming with an updated
// note easy), pre-filled and cancel-safe: a cancelled prompt (`null`) does
// nothing at all, never sends a request. An intentionally-blank submission
// (real, non-cancelled, but empty after trim) is NOT a "confirm with no
// reason" state — treated as exactly the same thing a plain Confirm click
// would do (per this task's own explicit instruction), by simply passing
// `undefined` through to the shared confirm function above.
function confirmUncertain() {
  if (!props.data.functionalModel || reviewStatusSaving.value) return;
  const entered = window.prompt('Known conceptual gap this card is being confirmed with (leave blank for a plain confirm):', factsReviewCaveat.value ?? '');
  if (entered === null) return; // cancelled — do nothing
  const trimmed = entered.trim();
  void confirmFactsReviewWithCaveat(trimmed.length > 0 ? trimmed : undefined);
}

// --- FDN authoring-pipeline status + Confirm/Reject review UI
// (`functional-model/pipeline-status.ts`) — a genuinely different review
// axis from every `factsReviewStatus`/`scenariosReviewStatus`/
// `interactionsReviewStatus` mechanism above (those are all `fin`-only,
// meaningless for `fdn`; see `isFdn`'s own doc comment). Pattern copied
// deliberately from `app/pages/app/engine/predicates/[[slug]].vue`'s own
// established Confirm/"Reject…"+note-modal shape (same button labels,
// same `pendingKey`-style in-flight guard, same reject-modal shape) rather
// than inventing a new one for this one axis.
const toast = useToast();

// Confirm/"Reject…" are only ever meaningful on a genuinely `blue` card —
// NOT `re-review` too, despite this task's own original dispatch assuming
// otherwise ("this includes the re-review state, since re-review only ever
// sits on a blue-rooted card"). Checked directly against the REAL, now-live
// `POST /api/fdn-cards/:slug/review` (`server/api/fdn-cards/[slug]/
// review.post.ts`, built concurrently by the engine agent): that route
// gates on `effectivePipelineStatus(...) !== 'blue'` and explicitly 400s a
// `re-review` entry too ("a stale, drifted re-review is refused here too,
// same as a genuinely non-blue card") — a drifted confirmation must go
// back through the authoring pipeline to become a fresh `blue` again
// before it's reviewable, it can't be re-confirmed directly. Matching the
// REAL server precondition here (confirmed live, not guessed) rather than
// showing a clickable button that would just 400 — see this task's own
// report for the full flagged mismatch against the dispatch's assumption.
// Requires a real `slug` too (never true for the common "no folder at all"
// case — nothing to review yet).
const canReviewPipeline = computed(() => isFdn.value && !!props.data.functionalModel?.slug && pipelineStatusColor.value === 'blue');
const pipelineReviewSaving = ref(false);
async function submitPipelineReview(action: { verdict: 'ok' } | { verdict: 'not-ok'; reviewNote: string }) {
  const slug = props.data.functionalModel?.slug;
  if (!slug || pipelineReviewSaving.value) return;
  pipelineReviewSaving.value = true;
  try {
    const updated = await $fetch<PipelineStatusFile>(`/api/fdn-cards/${slug}/review`, { method: 'POST', body: action });
    pipelineStatusOverride.value = updated;
  } catch (err: any) {
    toast.add({
      title: 'Review not saved',
      // `server/api/fdn-cards/[slug]/review.post.ts`'s own error shape is a
      // plain `{ error: string }` body (not h3's `createError`), so ofetch's
      // parsed `err.data.error` is the real message; `statusMessage`/
      // `message` stay as fallbacks for a network-level failure with no
      // parsed body at all.
      description: err?.data?.error ?? err?.data?.statusMessage ?? err?.message ?? 'Request failed.',
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    });
  } finally {
    pipelineReviewSaving.value = false;
  }
}
function confirmPipeline() {
  void submitPipelineReview({ verdict: 'ok' });
}
const pipelineRejectOpen = ref(false);
const pipelineRejectNote = ref('');
function openPipelineReject() {
  pipelineRejectNote.value = '';
  pipelineRejectOpen.value = true;
}
async function submitPipelineReject() {
  if (!pipelineRejectNote.value.trim()) return;
  await submitPipelineReview({ verdict: 'not-ok', reviewNote: pipelineRejectNote.value });
  pipelineRejectOpen.value = false;
}
// No "Unconfirm"/"Clear review" affordance here, unlike every other review
// axis in this file (Facts' Unconfirm, Predicates'/Features' own "Clear
// review") — a REAL, confirmed mismatch, not an oversight: `pipeline-
// status.ts`'s own `applyPipelineReview` is a PURE `blue -> yellow|green`
// transition with no reverse edge at all (`PipelineReviewAction` has no
// `verdict: null`/clear case), so there is nothing for a clear-review click
// to even call. Flagged in this task's own report for the engine agent/
// orchestrator rather than silently inventing a fake clear action or a
// client-only revert that the server could never actually persist.

// Only ever needed once functionalModel/pipelineStatusOverride can change —
// folded onto the SAME watcher `factsReviewStatus` etc. already use (see
// that watcher above) rather than a second, parallel one.
watch(
  () => props.data.functionalModel,
  () => {
    pipelineStatusOverride.value = null;
  },
);

// --- FDN sink ATTACHMENT tab (`functional-model/sink-attachment.ts`,
// `SINK_CATALOG` from `functional-model/sink-model/catalog/index`) — a
// genuinely EARLIER, separate step from the Pipeline-status Confirm/Reject
// block above (see `.claude/contracts/card-schema.md`'s "Sink CATALOG..."
// section, and `sink-attachment.ts`'s own header): "which of the shared
// catalog's sinks does THIS card's author determine it genuinely wants, and
// mark that determination explicitly done" — a card can legitimately want
// ZERO sinks (Serra Angel's own real, `reviewed: true` shape), so an empty
// `selectedSinkSlugs` is never treated as "nothing to save."
//
// `canEditSinkAttachment`: any real FDN card that's actually entered the
// pipeline (a real `functional-model/fdn-cards/<slug>/definition.ts`, same
// precondition `POST /api/fdn-cards/:slug/sinks` itself 404s on) —
// deliberately NOT gated on `pipelineStatusColor`/`effectivePipelineStatus`
// the way `canReviewPipeline` above is: the attachment step is meant to
// happen independently of (often before) a card's own schema-gate status,
// not as a second review action layered on top of an already-`blue` card.
const canEditSinkAttachment = computed(() => isFdn.value && !!props.data.functionalModel?.slug);

function isSinkSlugSelected(slug: string): boolean {
  return selectedSinkSlugs.value.includes(slug);
}
function toggleSinkSlug(slug: string) {
  selectedSinkSlugs.value = isSinkSlugSelected(slug) ? selectedSinkSlugs.value.filter((s) => s !== slug) : [...selectedSinkSlugs.value, slug];
}

// Real, order-insensitive "does the draft selection differ from the
// last-saved attachment" check — drives the Save button's own
// enabled/disabled state (and a small "unsaved changes" note) rather than
// letting it always be clickable regardless of whether there's anything new
// to persist. Compared as sets, not arrays, since re-ordering the same
// slugs is not a real change worth re-saving over.
const sinkAttachmentDirty = computed(() => {
  const saved = new Set(sinkAttachmentEntry.value?.attachedSlugs ?? []);
  const draft = new Set(selectedSinkSlugs.value);
  return saved.size !== draft.size || [...draft].some((s) => !saved.has(s));
});

// Compact, human-readable structural summary of a catalog entry's own
// `SinkQuery` — reuses `factConditions`/`describeFact` (functional-model/
// synergy.ts, `app/lib/factConditions.ts` — the SAME rendering vocabulary
// the Facts tab's own rows already use), rather than a hand-rolled JSON
// dump, since `SinkQuery` is structurally just `Fact` minus `annotations`/
// `provenance`/`role`/`triggeredBy` (`sink-query.ts`'s own doc comment) —
// every field either function inspects is either absent (tolerated; both
// already handle an unset `role`/`recipient`/etc.) or present with the
// exact same meaning. `entry.query.category` (the catalog's own curated
// mechanic name, e.g. "Lifegain") is shown separately as the row's primary
// label — this summary is the secondary "what does it actually check"
// detail, same label+conditions split `factLabel`/`factConditions` already
// establish for a real Fact row.
function sinkCatalogSummary(entry: SinkCatalogEntry): string {
  const fact = entry.query as unknown as Fact;
  const conditions = factConditions(fact);
  return conditions || describeFact(fact) || '(no constraints)';
}

const sinkAttachmentSaving = ref(false);
async function saveSinkAttachment() {
  const slug = props.data.functionalModel?.slug;
  if (!slug || sinkAttachmentSaving.value) return;
  sinkAttachmentSaving.value = true;
  try {
    const updated = await $fetch<SinkAttachmentFile>(`/api/fdn-cards/${slug}/sinks`, {
      method: 'POST',
      body: { attachedSlugs: selectedSinkSlugs.value },
    });
    sinkAttachmentOverride.value = updated;
    // A freshly-written attachment always stamps `reviewedFingerprint` off
    // this card's CURRENT `definition.ts` (`markSinkAttachmentReviewed`) —
    // so it's genuinely `'complete'` the instant this response lands, no
    // need to wait for a full page reload to reflect that.
    sinkAttachmentStatusOverride.value = 'complete';
    selectedSinkSlugs.value = [...updated.attachedSlugs];
  } catch (err: any) {
    toast.add({
      title: 'Sink attachment not saved',
      description: err?.data?.error ?? err?.data?.statusMessage ?? err?.message ?? 'Request failed.',
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    });
  } finally {
    sinkAttachmentSaving.value = false;
  }
}
</script>

<template>
  <!-- CardMedia + the review-status table side by side once there's
       room (md and up); stacked (table below the images) on narrow/
       mobile viewports, same "stack on narrow, row on wide" shape as
       the rest of the app's own responsive containers. items-start so
       the table doesn't stretch to the image column's own height. -->
  <div class="flex flex-col items-start gap-4 md:flex-row">
    <CardMedia :images="card.images" :tokens="card.tokens" />

    <!-- Review-status overview — one small table, not a per-tab/
         per-section badge. Used to be three separate ReviewStatusBadge
         call sites (top of the Facts tab's own content, top of
         Scenarios', beside the Interactions heading) plus, at various
         points earlier this session, a UTabs tab-strip badge — all
         removed in favor of this single table so switching tabs never
         hides a row's status, and the tab strip itself carries no
         draft/review indicator at all anymore. All three rows always
         render now (Facts/Scenarios/Interactions), regardless of
         whether that section actually has anything in it yet — same
         "show the true empty state, don't hide the section" reasoning
         the tab-strip's own item counts use (a 0-count tab and an
         always-present confirm row are the same idea). Each row's own
         `readonly` still requires BOTH dev AND `data.functionalModel`
         (a functional-model/cards/<slug> folder existing at all) —
         `toggleReviewStatus`'s own no-op guard already refuses to POST
         without one (its endpoint 404s on a missing folder either way,
         since all three fields' progress.json lives there), so a
         not-yet-migrated card's rows render with a disabled confirm
         button rather than one that silently does nothing on click.
         ONE button column (no separate Draft pill) —
         `ReviewStatusBadge`'s own `variant="button"` renders the
         section's current status as the button's own label/styling
         (small, muted throughout — "Confirm" reads a shade more
         prominent than "Unconfirm" only so the two stay
         distinguishable, neither is a loud color). Same shared status
         computeds/toggleReviewStatus (and its already-optimistic local
         state flip) as before — no parallel status system, just a
         different layout for the same data. FIN-only — see the `v-else`
         sibling below for FDN's own, genuinely different pipeline-status
         Confirm/Reject block. -->
    <div v-if="!isFdn" class="mt-2 shrink-0">
      <table class="border-collapse text-xs">
        <thead>
          <tr class="text-left text-[10px] font-semibold tracking-wide text-muted uppercase">
            <th class="py-1 pr-4">Facts</th>
            <th class="py-1"></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="py-1 pr-4 align-middle">Facts</td>
            <td class="py-1 align-middle">
              <span class="inline-flex items-center gap-1.5">
                <!-- Confirm/Unconfirm — Confirm ("ai_reviewed" status) is
                     gated behind `canConfirmCardStatus` per
                     `.claude/contracts/card-schema.md`'s "Real, enforced
                     gate DOES now exist for the REVIEW-ACTION side of this
                     axis" section: confirming is meaningless on a
                     gray/purple-baseline card, and the server already 400s
                     the attempt, so the button just isn't here to click.
                     Unconfirm ("human_reviewed" status) is NEVER gated —
                     un-reviewing needs no precondition, same rule this
                     file's other review actions already follow (mirrors
                     `ReviewStatusBadge`'s own "Clear review" always-allowed
                     posture for Predicates/Features). -->
                <ReviewStatusBadge
                  v-if="factsStatus === 'human_reviewed' || canConfirmCardStatus"
                  variant="button"
                  :status="factsStatus"
                  :readonly="!(isDev && data?.functionalModel)"
                  :pending="reviewStatusSaving === 'review'"
                  @confirm="toggleReviewStatus('review')"
                />
                <!-- "Confirm (Uncertain)" (2026-09-17) — a third facts-review
                     action alongside Confirm/Unconfirm above, not a toggle:
                     always prompts for a caveat and always confirms (see
                     confirmUncertain's own doc comment). Same dev-only/
                     functional-model-present gating as the Confirm/Unconfirm
                     button; same `reviewStatusSaving` pending guard (both
                     buttons share the 'review' field slot, so only one of
                     the two can ever be in flight at once). Deliberately its
                     own small text button, not a ReviewStatusBadge variant
                     (that shared component's own `ReviewStatus` vocabulary
                     is 2-way and used by unrelated callers, e.g. the
                     keywords page — widening it for this one card-page-only
                     action isn't worth rippling into those); the actual
                     3-way visual status readout instead reuses the EXISTING
                     fact-authoring status square next to the Facts tab
                     label below (`cardStatus`), which already distinguishes
                     `uncertain` (blue) from `verified` (lime) from a plain
                     never-reviewed bucket, and is now live-reactive to this
                     button too (see `cardStatusOverride`). This is ALWAYS a
                     forced confirm (never an unconfirm), so it shares the
                     Confirm button's own `canConfirmCardStatus` gate
                     unconditionally — there is no "Unconfirm" analog of this
                     button to exempt. -->
                <button
                  v-if="isDev && data?.functionalModel && canConfirmCardStatus"
                  type="button"
                  class="rounded border px-2 py-1 text-xs font-medium transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  :style="{ borderColor: `${CARD_STATUS_META.uncertain.color}66`, background: `${CARD_STATUS_META.uncertain.color}1a`, color: CARD_STATUS_META.uncertain.color }"
                  :disabled="reviewStatusSaving === 'review'"
                  title="Confirm this card's facts with a known caveat — facts are otherwise complete, but one specific conceptual gap remains"
                  @click="confirmUncertain"
                >
                  Confirm (Uncertain)
                </button>
                <!-- Verified-snapshot timestamp — see factsSnapshotLabel's
                     own doc comment above. Absent entirely when there's no
                     snapshot yet (nothing rendered, not an empty/broken
                     label). Amber "since changed" when a snapshot exists but
                     the card's CURRENT facts status has fallen back to 'ai'
                     (the regression guard's own auto-reset) — same warn hue
                     the Draft pill elsewhere in this file already uses for
                     "needs another look", not a new color introduced just
                     for this. -->
                <span
                  v-if="factsSnapshotLabel"
                  class="text-[11px]"
                  :class="factsSnapshotRegressed ? 'text-warn' : 'text-muted'"
                  :title="factsSnapshotTitle"
                >
                  {{ factsSnapshotLabel }}
                </span>
              </span>
            </td>
          </tr>
          <tr>
            <td class="py-1 pr-4 align-middle">Scenarios</td>
            <td class="py-1 align-middle">
              <ReviewStatusBadge
                variant="button"
                :status="scenariosStatus"
                :readonly="!(isDev && data?.functionalModel)"
                :pending="reviewStatusSaving === 'scenariosReview'"
                @confirm="toggleReviewStatus('scenariosReview')"
              />
            </td>
          </tr>
          <tr>
            <td class="py-1 pr-4 align-middle">Interactions</td>
            <td class="py-1 align-middle">
              <ReviewStatusBadge
                variant="button"
                :status="interactionsStatus"
                :readonly="!(isDev && data?.functionalModel)"
                :pending="reviewStatusSaving === 'interactionsReview'"
                @confirm="toggleReviewStatus('interactionsReview')"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- FDN's own real, genuinely different review axis (`functional-model/
         pipeline-status.ts` — see `isFdn`'s own doc comment above): no
         Facts/Scenarios/Interactions to review at all, so this isn't the
         same table above with different labels — it's the card's own
         authoring-PIPELINE-STAGE status plus a Confirm/"Reject…" action,
         pattern copied from `app/pages/app/engine/predicates/[[slug]].vue`'s
         own established Confirm/Reject shape (same button labels, same
         reject-note-modal shape). No "Unconfirm"/"Clear review" affordance
         — see `submitPipelineReview`'s own doc comment for why that's a
         real, confirmed mismatch against `pipeline-status.ts`'s own
         `applyPipelineReview` (a pure one-way `blue -> yellow|green`
         transition), not an oversight. -->
    <div v-else class="mt-2 shrink-0 rounded-md border border-border-subtle bg-panel p-3">
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-semibold tracking-wide text-muted uppercase">Pipeline status</span>
        <UBadge :style="statusBadgeStyle(pipelineStatusMeta.color)" size="sm" variant="solid">{{ pipelineStatusMeta.label }}</UBadge>
      </div>
      <ul v-if="pipelineStatusEntry?.reasons?.length" class="mt-1.5 flex flex-col gap-1">
        <li v-for="(r, i) in pipelineStatusEntry.reasons" :key="i" class="text-[11px] leading-relaxed text-muted">{{ r }}</li>
      </ul>
      <p v-else-if="!data?.functionalModel" class="mt-1.5 text-[11px] text-muted italic">
        No functional-model/fdn-cards/&lt;slug&gt;/ folder for this card yet.
      </p>
      <p v-if="pipelineStatusEntry?.reviewNote" class="mt-1.5 text-[11px] leading-relaxed text-muted">{{ pipelineStatusEntry.reviewNote }}</p>
      <p v-if="pipelineStatusEntry?.reviewedAt" class="mt-1.5 text-[11px] text-muted">Confirmed {{ pipelineStatusEntry.reviewedAt }}</p>
      <div v-if="canReviewPipeline" class="mt-2 flex items-center gap-2">
        <UButton size="xs" color="success" variant="subtle" :disabled="pipelineReviewSaving" :loading="pipelineReviewSaving" @click="confirmPipeline">
          Confirm
        </UButton>
        <UButton size="xs" color="warning" variant="subtle" :disabled="pipelineReviewSaving" @click="openPipelineReject">Reject…</UButton>
      </div>
    </div>
  </div>

  <!-- functional-model/ — a declarative CardDefinition
       (functional-model/card.ts) run through real, mutable game state
       (functional-model/state.ts) across its own scenarios.ts. Primary
       position right under the card now (not a comparison column
       anymore) — synergy-model is deprecated (see its own README/
       SCHEMA.md banners) and forge-model was removed outright
       (2026-09-11, GPL-3.0 exposure cleanup — it was dead code), this
       is the current direction. -->
  <div v-if="data?.functionalModel" class="mt-2">
    <!-- Real structured per-face card data (server/api/card/[set]/
         [number].ts) — `oracleText` served raw/untouched; the component
         itself builds plain-run/fact-linked-run segments client-side
         from each visible fact's own baked `Fact.annotations`
         (functional-model/synergy.ts's `AnnotationRef`, the 2026-09-11
         pointer rework — see `.claude/contracts/card-schema.md`) rather
         than receiving a pre-built segment tree. Hover a
         dotted-underline phrase to see the same role/value info the
         Facts tab's own table shows per row, anchored to the exact
         words that fact came from. Sits above the tabs (not inside the
         Facts one) since it's a separate thing — the card's own
         annotated text, not one of the four data views below. -->
    <div v-if="data.functionalModel.annotatedCard" class="mb-2">
      <FunctionalModelText
        ref="functionalModelTextRef"
        :card="data.functionalModel.annotatedCard"
        :facts="visibleSynergyFacts"
        :non-fact-spans="visibleNonFactSpanRows"
        :highlight-keys="hoveredFactKeys"
        :self-facts="headerFaceFacts"
        :header-highlight-index="headerHighlightIndex"
        @hover="hoveredFactKeys = $event"
      />
    </div>

    <!-- FDN's own real, plain (un-annotated) counterpart to the block
         above — FDN cards have no synergy.json/Fact.annotations at all by
         design (see `isFdn`'s own doc comment), so `FunctionalModelText.vue`
         (which hard-depends on `annotatedCard`) doesn't apply here; this is
         a genuinely separate, deliberately minimal component
         (`PlainOracleText.vue`) instead of a retrofit. Same "sits above the
         tabs" position as the annotated block above, for the same reason —
         it's the card's own real printed text, not one of the tabs below.
         `null`/empty (e.g. a vanilla creature with no rules text) renders
         nothing, same "no real text to show" empty state the annotated
         path already has. -->
    <div v-else-if="isFdn && data.functionalModel.oracleText" class="mb-2">
      <PlainOracleText :oracle-text="data.functionalModel.oracleText" />
    </div>

    <!-- Same "strip only, content switched separately" split AppHeader.vue's
         own filter-mode UTabs already uses — nothing here depends on
         UTabs rendering slotted content itself. No draft/review
         indicator lives on the tab strip (or per-tab content) at all —
         see the review-status table above this block for where that
         now lives, once, covering every section regardless of which
         tab is active. The ONE exception: the Facts tab's own strip
         label gets a small fact-authoring status square (below, via
         `#leading` — see `cardStatus`'s own comment above) — a
         different, unrelated signal from the human/AI review-status
         table (this one comes from the generated `/app/status` dashboard
         data, per-card not per-tab-section), so it doesn't belong in
         that table. -->
    <UTabs v-model="functionalModelTabValue" :items="functionalModelTabs" variant="link" size="xs" class="mb-2">
      <template #leading="{ item }">
        <span
          v-if="item.value === 'facts' && cardStatus"
          class="h-2.5 w-2.5 shrink-0 rounded-sm"
          :style="{ background: CARD_STATUS_META[cardStatus.status].color }"
          :title="cardStatusTitle"
        ></span>
      </template>
    </UTabs>

    <template v-if="functionalModelTabValue === 'facts'">
      <!-- Three-way fact-provenance filter, one compact line (2026-09-14
           condensed from two separate, count-gated rows into this —
           user request: always visible regardless of per-card counts,
           short labels). Each fact falls into exactly one of these three
           buckets (`isAiFact`/`isTypeDerivedFact`/`isParserFact`'s own
           comments) but the toggles are still ANDed independently in
           `factRowGroups`, not mutually exclusive by construction — see
           that computed's own comment. All three render inline in the
           SAME single text-ordered table below, never a separate
           section (`feedback_facts_text_order_role_icon_only`).
           "type-keywords" = the type-derived subset (structural, e.g. a
           Saga's lore/sacrifice facts); "other" = every other
           parser-derived (recognizer) fact; "AI" = hand-authored, no
           `provenance` at all (default ON — see useGraphStore.ts's
           showAiFacts comment for why). -->
      <div v-if="synergy" class="mb-1.5 ml-[0.5em] flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <UCheckbox v-model="showAiFacts" :ui="{ label: 'flex items-center gap-1 text-xs text-muted' }">
          <template #label>
            <span>AI ({{ aiFactsCount }})</span>
          </template>
        </UCheckbox>
        <span class="text-dimmed">|</span>
        <UCheckbox v-model="showTypeDerivedFacts" :ui="{ label: 'flex items-center gap-1 text-xs text-muted' }">
          <template #label>
            <span>type-keywords ({{ typeDerivedFactsCount }})</span>
          </template>
        </UCheckbox>
        <span class="text-dimmed">|</span>
        <UCheckbox v-model="showParserFacts" :ui="{ label: 'flex items-center gap-1 text-xs text-muted' }">
          <template #label>
            <span>other ({{ parserFactsCount }})</span>
          </template>
        </UCheckbox>
        <span class="text-dimmed">|</span>
        <!-- Fourth, independent toggle (2026-09-16) — `progress.json`'s own
             `annotatedNonFactSpans` (see `.claude/contracts/card-schema.md`).
             NOT a fact-provenance bucket like the three above (a row here
             never has a `role` at all) — its own separate checkbox, default
             OFF, same reasoning as `showParserFacts`/`showTypeDerivedFacts`. -->
        <UCheckbox v-model="showAnnotatedNonFactSpans" :ui="{ label: 'flex items-center gap-1 text-xs text-muted' }">
          <template #label>
            <span>non-fact spans ({{ nonFactSpansCount }})</span>
          </template>
        </UCheckbox>
      </div>
      <div v-if="synergy" class="overflow-x-auto">
        <table class="border-collapse text-xs whitespace-nowrap">
          <tbody v-for="group in factRowGroups" :key="group.label ?? 'flat'">
            <!-- Group header — only rendered for a multi-face card (see
                 `factRowGroups`'s own comment); a single-faced card's
                 `label` is always null here, so nothing changes for the
                 vast majority of cards. -->
            <tr v-if="group.label">
              <td
                :colspan="3 + (SHOW_FACT_DEBUG_COLUMN ? 1 : 0)"
                class="pt-2 pb-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase"
              >
                {{ group.label }}
              </td>
            </tr>
            <!-- v-for lives on a wrapping <template> (not the <tr> itself)
                 so the per-row `v-if`/`v-else` split below (Fact row vs.
                 non-Fact-span row, 2026-09-16) has `row` already in scope —
                 combining v-for and v-if on the SAME element is unsafe in
                 Vue 3 (v-if is evaluated first there, before the loop
                 variable exists). -->
            <template v-for="row in group.rows" :key="row.key">
            <tr
              v-if="isFactRow(row)"
              class="align-middle"
              :class="isKeyHovered(factKey(row.fact)) ? 'bg-surface/60' : isTriggerSibling(row.key) ? 'bg-fuchsia-400/15' : 'hover:bg-surface/25'"
              @mouseenter="hoveredFactKeys = [factKey(row.fact)]"
              @mouseleave="hoveredFactKeys = null"
            >
              <td class="py-1 px-2">
                <span class="inline-flex items-center gap-1">
                  <Icon
                    :name="row.fact.role === 'source' ? 'lucide:log-out' : 'lucide:log-in'"
                    :class="row.fact.role === 'source' ? 'text-blue-400' : 'text-emerald-500'"
                    class="h-3.5 w-3.5"
                    :title="row.fact.role === 'source' ? 'Source — this card provides this' : 'Sink — this card wants this'"
                  />
                  <!-- One provenance icon per row, matching the three
                       filter buckets above the table (2026-09-14 — each
                       fact falls into exactly one, `isAiFact`/
                       `isTypeDerivedFact`/`isParserFact`'s own comments):
                       AI (no `provenance` at all — hand-authored, never
                       run through a recognizer), type-keywords
                       (structural, e.g. a Saga's lore/sacrifice facts),
                       or other (every other recognizer/parser fact).
                       Checked in this order since type-derived is a
                       strict SUBSET of parser-derived — must test it
                       first or it'd never be reached. -->
                  <Icon
                    v-if="isAiFact(row.fact)"
                    name="lucide:wand-sparkles"
                    class="h-3 w-3 cursor-help text-violet-400"
                    title="AI — no parser recognizer produced this fact"
                  />
                  <Icon
                    v-else-if="isTypeDerivedFact(row.fact)"
                    name="lucide:shapes"
                    class="h-3 w-3 cursor-help text-teal-400"
                    title="Type-keywords — structurally implied by this card's own printed type/supertype"
                  />
                  <Icon
                    v-else
                    name="lucide:regex"
                    class="h-3 w-3 cursor-help text-amber-400"
                    title="Other — matched by a parser recognizer"
                  />
                </span>
              </td>
              <td
                class="py-1 px-2 text-[13px] whitespace-pre-wrap text-muted"
                :title="factSourceText(row.fact)"
              >
                <!-- No separate link icon anymore — every fact links to
                     something now (a real oracle-text span or, failing
                     that, the header name), so a dedicated glyph no
                     longer distinguishes anything. The label itself is
                     the hover/click target instead: a body-linked fact's
                     cross-highlight already comes free from this row's
                     own hover handlers above; a header-linked fact
                     additionally flashes + scrolls-to the header name via
                     the handlers below (see factLinkTitle/onFactLabel*). -->
                <span
                  :class="{ 'cursor-pointer': isHeaderLinkedFact(row.fact) }"
                  :title="factLinkTitle(row.fact)"
                  @mouseenter="onFactLabelEnter(row.fact)"
                  @mouseleave="onFactLabelLeave(row.fact)"
                  @click="onFactLabelClick(row.fact)"
                >{{ factLabel(row.fact) }}</span>
              </td>
              <td class="py-1 px-2 whitespace-pre-wrap text-muted/60">{{ factConditions(row.fact) }}</td>
              <td v-if="SHOW_FACT_DEBUG_COLUMN" class="py-1 px-2">
                <!-- Copy button sits FIRST (left) with its own extra
                     right-margin (beyond the plain `gap-1.5` used
                     everywhere else in this file), and the JSON/braces
                     debug button sits second (right) — deliberately
                     reordered + spaced apart per direct user feedback
                     ("copy button ... I keep hitting json instead"): the
                     two are similar-looking small icons right next to
                     each other, so copy (the one actually used often)
                     gets breathing room on its own right side rather than
                     living flush against the debug button. -->
                <span class="inline-flex items-center gap-1.5">
                  <Icon
                    :name="copiedFactKey === row.key ? 'lucide:check' : 'lucide:copy'"
                    class="h-3.5 w-3.5 mr-2 cursor-pointer text-muted/50 hover:text-text"
                    title="Copy fact context (card + row number + text)"
                    @click="copyFactContext(row)"
                  />
                  <Icon
                    name="lucide:braces"
                    class="h-3.5 w-3.5 cursor-pointer text-muted/50 hover:text-text"
                    title="View this fact's raw JSON"
                    @click="openFactDebugModal(row.fact)"
                  />
                  <!-- Parser-derived facts only (`Fact.provenance.origin
                       === 'parser'`, see isParserFact) — an
                       agent-authored fact has no recognizer to show, so
                       it gets no button here at all rather than a
                       disabled one. -->
                  <Icon
                    v-if="isParserFact(row.fact)"
                    name="lucide:scroll"
                    class="h-3.5 w-3.5 cursor-pointer text-muted/50 hover:text-text"
                    :title="`View recognizer source: ${row.fact.provenance?.rule ?? ''}`"
                    @click="openRecognizerSourceModal(row.fact.provenance?.rule ?? '')"
                  />
                </span>
              </td>
            </tr>
            <!-- Non-Fact span row (`progress.json`'s own
                 `annotatedNonFactSpans`, 2026-09-16 — see
                 `.claude/contracts/card-schema.md`; row content/highlight
                 wiring revised same day per direct user feedback) —
                 deliberately NOT a Fact: col 1 shows a distinct, non-role
                 icon (never the Fact source/sink log-in/log-out glyph) and
                 col 2 shows a SHORT LABEL derived from `span.kind`
                 (`NON_FACT_SPAN_KIND_LABEL`) — never the raw `kind` string
                 and never the span's own `note` free text, which is
                 authoring-only detail, not rendered anywhere in the UI.
                 Same 4-column shape as a fact row (keeps table alignment;
                 col 3 stays empty — there's no `factConditions`-equivalent
                 for a span). Same hover-to-highlight wiring as a real fact
                 row (`hoveredFactKeys`/FunctionalModelText.vue's own
                 `nonFactSpans` prop) using this row's own stable `key` —
                 the exact same shared mechanism, just keyed by a span
                 instead of a `Fact`. Carries no per-row copy-context button
                 and, per explicit instruction, NO recognizer-source
                 link/icon (these spans have no recognizer at all — that's
                 real Fact-row furniture that simply doesn't apply here) —
                 only the raw-JSON debug view, reusing the same shared
                 modal. -->
            <tr
              v-else
              class="align-middle"
              :class="isKeyHovered(row.key) ? 'bg-surface/60' : 'hover:bg-surface/25'"
              @mouseenter="hoveredFactKeys = [row.key]"
              @mouseleave="hoveredFactKeys = null"
            >
              <td class="py-1 px-2">
                <span class="inline-flex items-center gap-1">
                  <Icon
                    name="lucide:file-text"
                    class="h-3.5 w-3.5 text-slate-400"
                    title="Not a Fact — a real oracle-text span deliberately accounted for with no synergy Fact of its own"
                  />
                </span>
              </td>
              <td class="py-1 px-2 text-[13px] whitespace-pre-wrap text-muted">{{ NON_FACT_SPAN_KIND_LABEL[row.span.kind] }}</td>
              <td class="py-1 px-2 whitespace-pre-wrap text-muted/60"></td>
              <td v-if="SHOW_FACT_DEBUG_COLUMN" class="py-1 px-2">
                <Icon
                  name="lucide:braces"
                  class="h-3.5 w-3.5 cursor-pointer text-muted/50 hover:text-text"
                  title="View this span's raw JSON"
                  @click="openDebugModal(`Non-Fact span — ${row.span.kind}`, JSON.stringify(row.span, null, 2))"
                />
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-else class="text-xs text-muted italic">Not yet migrated to v2 synergy.json.</div>
    </template>

    <template v-else-if="functionalModelTabValue === 'scenarios'">
      <ScenarioReplay
        v-if="data.functionalModel.traces?.length"
        :traces="data.functionalModel.traces"
        :card-images="card.images"
        :card-keywords="card.keywords"
        :card-back-keywords="card.backKeywords"
        :card-power="card.power"
        :card-toughness="card.toughness"
        :card-back-power="card.backPower"
        :card-back-toughness="card.backToughness"
        :continuous-keyword-grants="data.functionalModel.continuousKeywordGrants"
      />
      <div v-else class="text-xs text-muted italic">No scenarios recorded.</div>
    </template>

    <!-- FDN's own per-card sink-ATTACHMENT tab (`functional-model/
         sink-attachment.ts` + `SINK_CATALOG`) — see this file's own
         `canEditSinkAttachment`/`saveSinkAttachment` doc comments. A
         genuinely different, EARLIER step from the Pipeline status block's
         Confirm/Reject above: which shared catalog sinks does THIS card
         want, explicitly marked done (zero is a real, legitimate answer,
         same as Serra Angel's own on-disk shape). -->
    <template v-else-if="functionalModelTabValue === 'sinks'">
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-semibold tracking-wide text-muted uppercase">Attachment status</span>
        <UBadge :style="statusBadgeStyle(SINK_ATTACHMENT_STATUS_META[sinkAttachmentStatus].hex)" size="sm" variant="solid">
          {{ SINK_ATTACHMENT_STATUS_META[sinkAttachmentStatus].label }}
        </UBadge>
        <span v-if="sinkAttachmentEntry?.reviewedAt" class="text-[11px] text-muted">as of {{ sinkAttachmentEntry.reviewedAt }}</span>
      </div>
      <p v-if="sinkAttachmentStatus === 're-review'" class="mt-1.5 text-[11px] leading-relaxed text-muted">
        This card's <code class="rounded bg-surface px-1 py-0.5">definition.ts</code> has changed since attachment was last marked
        reviewed — re-check the selection below and save again.
      </p>
      <p v-else-if="sinkAttachmentStatus === 'not-started'" class="mt-1.5 text-[11px] leading-relaxed text-muted italic">
        Attachment hasn't been performed for this card yet — pick the catalog sinks it genuinely wants below (zero is a valid
        answer for a card with no real synergy hooks) and save.
      </p>

      <ul class="mt-3 flex flex-col gap-1.5">
        <li
          v-for="entry in SINK_CATALOG"
          :key="entry.slug"
          class="flex items-start gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-text"
          :class="isSinkSlugSelected(entry.slug) ? 'bg-surface/60' : 'bg-panel'"
        >
          <input
            :id="`sink-catalog-${entry.slug}`"
            type="checkbox"
            class="mt-0.5 shrink-0"
            :disabled="!canEditSinkAttachment || sinkAttachmentSaving"
            :checked="isSinkSlugSelected(entry.slug)"
            @change="toggleSinkSlug(entry.slug)"
          />
          <label :for="`sink-catalog-${entry.slug}`" class="flex min-w-0 flex-col gap-0.5">
            <span class="flex items-center gap-1.5">
              <span class="font-medium">{{ entry.query.category }}</span>
              <code class="rounded bg-surface px-1 py-0.5 text-[10px] text-muted">{{ entry.slug }}</code>
            </span>
            <span class="text-[11px] text-muted">{{ sinkCatalogSummary(entry) }}</span>
          </label>
        </li>
        <li v-if="!SINK_CATALOG.length" class="text-xs text-muted italic">No catalog sinks exist yet.</li>
      </ul>

      <div v-if="canEditSinkAttachment" class="mt-3 flex items-center gap-2">
        <UButton size="xs" color="success" variant="subtle" :disabled="sinkAttachmentSaving" :loading="sinkAttachmentSaving" @click="saveSinkAttachment">
          Mark attachment reviewed
        </UButton>
        <span v-if="sinkAttachmentDirty" class="text-[11px] text-muted italic">unsaved changes</span>
      </div>
      <p v-else class="mt-3 text-[11px] text-muted italic">No functional-model/fdn-cards/&lt;slug&gt;/ folder for this card yet.</p>
    </template>

    <template v-else-if="functionalModelTabValue === 'json'">
      <JsonHighlight
        :json="functionalModelJson ?? ''"
        class="max-h-[32rem] overflow-auto rounded border border-border bg-panel p-2"
      />
    </template>

    <template v-else-if="functionalModelTabValue === 'cardJson'">
      <JsonHighlight
        :json="cardJson ?? ''"
        class="max-h-[32rem] overflow-auto rounded border border-border bg-panel p-2"
      />
    </template>

    <template v-else>
      <FunctionalModelScript :code="data.functionalModel.source" />
    </template>
  </div>

  <!-- app/lib/synergyInteractions.ts's cross-card join, grouped by this
       card's own node (or, for a rule this card only bears, the rule
       owner's node — see groupInteractionsForCard) — one row per
       mechanism, with every matching pool card and a count, rather than
       one row per pair. Computed server-side from real synergy nodes,
       not pre-baked; only wired for the small worked-example pool in
       server/api/card/[set]/[number].ts (no full-corpus join yet). -->
  <div v-if="orderedInteractions.length" class="mt-4 w-full max-w-full">
    <div class="mb-1 flex items-center gap-2">
      <span class="text-[10px] font-semibold tracking-wide text-muted uppercase">Interactions</span>
    </div>
    <ul class="flex flex-col gap-1.5">
      <li
        v-for="(group, gi) in orderedInteractions"
        :key="gi"
        class="rounded-md border border-border px-2.5 py-1.5 text-xs text-text"
        :class="isKeyHovered(factKey(group.fact)) ? 'bg-surface/60' : 'bg-panel'"
        @mouseenter="hoveredFactKeys = [factKey(group.fact)]"
        @mouseleave="hoveredFactKeys = null"
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

  <UModal v-model:open="debugModalOpen" :close="false" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <JsonHighlight :json="debugModalContent" class="max-h-[70vh] overflow-auto rounded border border-border bg-panel p-2" />
    </template>
  </UModal>

  <UModal v-model:open="recognizerSourceModalOpen" :close="false" :ui="{ content: 'max-w-3xl' }">
    <template #body>
      <div class="mb-2 text-[10px] font-semibold tracking-wide text-muted uppercase">Recognizer: {{ recognizerSourceModalRule }}</div>
      <div v-if="recognizerSourceModalLoading" class="text-xs text-muted italic">Loading recognizer source…</div>
      <div v-else-if="recognizerSourceModalError" class="text-xs text-red-400">{{ recognizerSourceModalError }}</div>
      <FunctionalModelScript v-else :code="recognizerSourceModalCode" />
    </template>
  </UModal>

  <!-- FDN pipeline-status "Reject…" note modal — same shape as Predicates'
       own reject modal (app/pages/app/engine/predicates/[[slug]].vue): a
       required, non-empty note, submit-disabled until one's entered. -->
  <UModal v-model:open="pipelineRejectOpen" title="Reject transcription">
    <template #body>
      <p class="mb-2 text-xs text-muted">
        Explain why this card's <code class="rounded bg-surface px-1 py-0.5">definition.ts</code> is wrong. A note
        is required (that's the whole point of yellow).
      </p>
      <UTextarea v-model="pipelineRejectNote" class="w-full" :rows="4" placeholder="e.g. spot-checked against real Forge source, the transcription mishandles..." autofocus />
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="subtle" @click="close">Cancel</UButton>
        <UButton color="warning" :disabled="!pipelineRejectNote.trim() || pipelineReviewSaving" :loading="pipelineReviewSaving" @click="submitPipelineReject">
          Reject
        </UButton>
      </div>
    </template>
  </UModal>
</template>
