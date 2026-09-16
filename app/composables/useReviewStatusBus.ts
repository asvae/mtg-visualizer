// Cheap same-tab, same-session event bus for "a card's FACTS review status
// (progress.json's `review` field, 'ai'/'human') just changed" — lets
// app/pages/app/status/index.vue's status grid optimistically re-color a
// square the instant CardDetailTabs.vue's Confirm/Unconfirm button posts a
// successful `field: 'review'` change, without a Pinia/store rework or a
// re-fetch of the generated `fin_card_status.json` (explicit ask: "just
// cheap global emit would do, no need to rework store or re-fetch from
// server"). Deliberately NOT a source of truth — a real page reload always
// shows the server's own generated classification; this is purely a
// same-tab, in-session visual nicety, and deliberately does not survive a
// browser refresh or cross-tab (no persistence, no BroadcastChannel).
//
// Module-scoped state (not per-composable-instance), so a listener
// registered by one mounted component tree (the status grid page) sees an
// emit from a completely separate one (the full card page, or the peek
// panel mounted inside the graph/status pages) the same way a real global
// `mitt` emitter would — without adding the `mitt` dependency itself.
// Grepped `app/composables/` first per SHARED.md convention-check: only
// `useGraphStore.ts`/`useSetOrder.ts` exist, neither is an event-bus
// pattern to reuse, so this is a new (intentionally tiny) one, not a
// duplicate of an existing convention.
export interface ReviewStatusChange {
  /** Lowercase set code, e.g. `'fin'` — matches the status API/grid's own
   * per-set scoping, NOT a per-card field (the generated status data is
   * already scoped to one set, so an individual entry has no set field). */
  set: string;
  /** Collector number, matches `CardStatusEntry.number` exactly (including
   * lettered variants like `'99b'`) — never a slug; the generated status
   * file has no slug field to match against, only set+number. */
  number: string;
  /** The new `progress.json` `review` value this card was just confirmed
   * (or un-confirmed) to. */
  review: 'ai' | 'human';
  /** The card's current `progress.json` `reviewCaveat`, non-empty-trimmed
   * (2026-09-17, "Confirm (Uncertain)" UI action) — `undefined` when absent
   * (a plain confirm/unconfirm, or a caveat that was just cleared). Only
   * ever meaningful alongside `review: 'human'`; a listener narrowing a
   * `green`/`verified` status to `uncertain` should treat this the same way
   * `functional-model/card-status.ts`'s own `classifyCardStatus` does — a
   * non-empty caveat wins over a plain human-reviewed upgrade. */
  reviewCaveat?: string;
}

type Listener = (change: ReviewStatusChange) => void;

const listeners = new Set<Listener>();

export function emitReviewStatusChanged(change: ReviewStatusChange): void {
  for (const listener of listeners) listener(change);
}

/** Subscribe for the lifetime of a component; call the returned function
 * from `onUnmounted` to avoid leaking a listener across SPA page
 * navigations (this module's `listeners` set otherwise outlives any one
 * page/component instance). */
export function onReviewStatusChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
