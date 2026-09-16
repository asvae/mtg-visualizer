// Shared color/label table for a card's fact-authoring status bucket —
// small, standalone module so both the full dashboard (`app/pages/app/
// status/index.vue`) and the per-card name-row badge (`FunctionalModelText.
// vue`, wired via `CardDetailTabs.vue`) use the exact same color mapping
// instead of drifting apart. Mirrors `functional-model/card-status.ts`'s own
// `CardStatusBucket` shape (duplicated rather than imported — this module
// only ever provides display metadata, never `functional-model/*` itself,
// same "card agent reads generated output, doesn't import engine internals"
// convention documented in `.claude/contracts/card-schema.md`).
//
// 2026-09-16: the actual per-card STATUS DATA lookup this module used to
// provide (`getCardStatusEntry`, reading a static-imported `data/fin/
// fin_card_status.json` batch snapshot) was removed — both real consumers
// now fetch live, on-request-computed status instead (`CardDetailTabs.vue`
// via the card API's own `cardStatus` field, the status grid page via
// `/api/card-status/[set]`), so a stale static-imported snapshot is no
// longer read anywhere. Only this color/label table remains in use.
export type CardStatusBucket = 'verified' | 'uncertain' | 're-review' | 'green' | 'yellow' | 'orange' | 'red' | 'gray';

// Same 8 colors/labels as `app/pages/app/status/index.vue`'s own
// `STATUS_META` (kept as a separate literal there rather than imported from
// here, since that page predates this module) — keep both in sync by
// convention if a color ever changes.
export const CARD_STATUS_META: Record<CardStatusBucket, { color: string; label: string }> = {
  verified: { color: '#84cc16', label: 'Verified' },
  uncertain: { color: '#3b82f6', label: 'Uncertain' },
  're-review': { color: '#7dd3fc', label: 'Re-review' },
  green: { color: '#22c55e', label: 'Green' },
  yellow: { color: '#eab308', label: 'Yellow' },
  orange: { color: '#f97316', label: 'Orange' },
  red: { color: '#ef4444', label: 'Red' },
  gray: { color: '#6b7280', label: 'Gray' },
};
