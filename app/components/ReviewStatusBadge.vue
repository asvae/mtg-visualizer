<script setup lang="ts">
// Shared "Draft" pill + confirm-button review-status control — extracted
// off app/pages/app/card/[set]/[number].vue's own three near-identical
// call sites (facts/scenarios/interactions), so the keywords coverage page
// (app/pages/app/keywords/) can drive the same UI against its own status
// field/endpoint without copy-pasting the markup or the label-swap logic.
//
// Deliberately does NOT make the API call itself — every caller's own
// review-status endpoint has a different payload shape (card page: POST
// /api/card/review-status with {name, field, reviewed}; keywords page:
// its own /api/keywords/review-status with {key}), so this component just
// renders current `status` and emits `confirm` on click; the caller owns
// the fetch, the optimistic/pending state, and re-syncing `status` off
// the response — same responsibilities app/pages/app/card/[set]/[number]
// .vue's own `toggleReviewStatus` already had, just no longer duplicated
// three times.
//
// `status` uses the shared 3-way vocabulary (app/types.ts's own
// `ReviewStatus`) that functional-model/keywords/registry.ts's
// `KeywordEntry.status` is expanding to — `'not_implemented'` renders
// nothing at all (no badge, no button: there's nothing to confirm yet),
// `'ai_reviewed'` shows the Draft pill with an icon-only checkmark button
// embedded in it, `'human_reviewed'` hides the pill and shows a standalone
// icon-only "revert to draft" button instead (plus, optionally,
// `reviewedNote`). The card page's own two-state fields map onto just the
// latter two values (see its own template) — this component neither knows
// nor cares that a card's facts/scenarios/interactions can never actually
// be `'not_implemented'`.
//
// Confirm control is deliberately icon-only, no text label — the user's
// own request, to keep it compact: a small checkmark button either
// embedded at the Draft pill's own trailing edge (`ai_reviewed`, pill
// shown) or standing alone (`badge` false — caller shows the pill
// elsewhere, e.g. the card page's own UTabs `item.badge` — or
// `human_reviewed`, which never had a pill at all). `title`/`aria-label`
// carry the same "Mark as reviewed"/"Mark as draft" text a sighted mouse
// user no longer sees on the button face.
import type { ReviewStatus } from '../types';

withDefaults(
  defineProps<{
    status: ReviewStatus;
    /** Show the inline "Draft" pill when `status === 'ai_reviewed'`. Default
     * true — set false when the caller already surfaces the same status
     * another way (the card page's Facts/Scenarios tabs show it via a
     * UTabs `item.badge` instead), so this component renders just the
     * confirm control. */
    badge?: boolean;
    /** Text shown next to the button once `status === 'human_reviewed'` —
     * omit for no note (e.g. the Interactions panel, which shows only the
     * pill/button, no explanatory sentence). */
    reviewedNote?: string;
    /** Disables the button while a request for THIS control is in flight —
     * caller's own responsibility to track (same field-scoped
     * `reviewStatusSaving` pattern the card page already used). */
    pending?: boolean;
    /** Interactions panel's own button/pill run a size step smaller
     * (inline with the section header) than the Facts/Scenarios tabs' —
     * same two literal class strings that existed before this extraction,
     * just switched on a prop instead of duplicated per call site. */
    size?: 'sm' | 'xs';
    /** Hides the confirm button (and `reviewedNote`) while still showing
     * the pill — the card page's Interactions panel only ever renders its
     * "Mark as reviewed" button in dev (see server/api/card/review-status
     * .ts's own dev-only 403 guard) but always shows the Draft pill itself,
     * dev or not. Default false — every other call site shows both
     * together. */
    readonly?: boolean;
  }>(),
  { badge: true, size: 'sm', readonly: false }
);
defineEmits<{ confirm: [] }>();
</script>

<template>
  <span v-if="status !== 'not_implemented'" class="inline-flex items-center gap-1.5">
    <!-- Draft pill — the confirm control now lives INSIDE it (an icon-only
         checkmark button embedded at the pill's own trailing edge) rather
         than as a separate labeled button beside it, per the user's own
         "attached to the draft badge itself" request. Only rendered when
         there's actually something to confirm (`status === 'ai_reviewed'`,
         same condition as before) — `human_reviewed` never had a pill,
         still doesn't. -->
    <span
      v-if="badge && status === 'ai_reviewed'"
      class="inline-flex items-center gap-1 rounded bg-warn/20 py-px pr-1 pl-1.5 text-[10px] font-bold tracking-wide text-warn uppercase"
    >
      Draft
      <button
        v-if="!readonly"
        type="button"
        class="flex items-center justify-center rounded-sm text-warn hover:bg-warn/30 disabled:opacity-50"
        :class="size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'"
        :disabled="pending"
        title="Mark as reviewed"
        aria-label="Mark as reviewed"
        @click="$emit('confirm')"
      >
        <Icon name="lucide:check" class="h-full w-full" />
      </button>
    </span>
    <template v-if="!readonly">
      <!-- Standalone icon-only confirm button — only rendered when there's
           no pill HERE to attach it to: either the caller already shows the
           pill elsewhere (`badge` false — e.g. the card page's own UTabs
           `item.badge`) or `status === 'human_reviewed'` (no pill, ever;
           this reverts it back to draft). -->
      <button
        v-if="!(badge && status === 'ai_reviewed')"
        type="button"
        class="flex items-center justify-center rounded border border-border p-0.5 hover:bg-surface disabled:opacity-50"
        :class="[size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4', status === 'human_reviewed' ? 'text-produce' : 'text-warn']"
        :disabled="pending"
        :title="status === 'human_reviewed' ? 'Mark as draft' : 'Mark as reviewed'"
        :aria-label="status === 'human_reviewed' ? 'Mark as draft' : 'Mark as reviewed'"
        @click="$emit('confirm')"
      >
        <Icon :name="status === 'human_reviewed' ? 'lucide:rotate-ccw' : 'lucide:check'" class="h-full w-full" />
      </button>
      <span v-if="status === 'human_reviewed' && reviewedNote" class="text-xs text-muted">{{ reviewedNote }}</span>
    </template>
  </span>
</template>
