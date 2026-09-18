// Shared color/label table for FDN's own per-card sink-ATTACHMENT axis
// (`functional-model/sink-attachment.ts`'s `SinkAttachmentStatus`) — same
// "display metadata only, never engine internals" module `app/lib/
// pipelineStatus.ts`/`app/lib/cardStatus.ts` already establish for their own
// axes. Duplicated as a plain string union here rather than importing
// `SinkAttachmentStatus` itself, same convention those two files already
// use for the same reason.
//
// Colors deliberately REUSE this project's own shared status vocabulary
// (per `feedback_reuse_shared_status_vocabulary`) rather than coining a
// fourth palette: `'not-started'`/`'incomplete'` both mean "nothing
// definitive done yet, ready for/pending agent or reviewer work" — the
// exact same meaning `pipeline-status.ts`'s own `gray` already carries, so
// both reuse that color. `'re-review'` reuses the IDENTICAL bright/light-blue
// `#7dd3fc` + "a human confirmed it, then the underlying thing drifted
// since" meaning every other axis's own `re-review` state already
// establishes (`engine-status.ts`/`sink-derivation-status.ts`/
// `pipeline-status.ts` all agree on this exact color for this exact
// concept). `'complete'` reuses `green` — marking attachment reviewed
// (`POST /api/fdn-cards/:slug/sinks`) IS a real human/author determination
// action, not a bare mechanical pass, the same "a human confirmed it"
// meaning `pipeline-status.ts`'s own `green` ("Confirmed") already carries.
export type SinkAttachmentStatusColor = 'gray' | 'green' | 're-review';

export const SINK_ATTACHMENT_STATUS_META: Record<
  'not-started' | 'incomplete' | 're-review' | 'complete',
  { color: SinkAttachmentStatusColor; hex: string; label: string }
> = {
  'not-started': { color: 'gray', hex: '#6b7280', label: 'Not started' },
  incomplete: { color: 'gray', hex: '#6b7280', label: 'Incomplete' },
  're-review': { color: 're-review', hex: '#7dd3fc', label: 'Needs re-review' },
  complete: { color: 'green', hex: '#22c55e', label: 'Attached' },
};
