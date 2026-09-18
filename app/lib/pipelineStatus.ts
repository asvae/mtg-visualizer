// Shared color/label table for FDN's own authoring-PIPELINE-STAGE status
// (`functional-model/pipeline-status.ts`'s `PipelineStatus`) — same small,
// standalone "display metadata only, never engine internals" module
// `app/lib/cardStatus.ts` already establishes for FIN's own fact-authoring
// axis. Duplicated as a plain string union here rather than importing
// `PipelineStatus` itself — this module only ever provides DISPLAY
// metadata, same "card agent reads generated output, doesn't import engine
// internals" convention `.claude/contracts/card-schema.md` documents.
//
// Labels deliberately do NOT reuse the pipeline plan's own literal
// "Ok"/"Not ok" review-verdict wording for `green`/`yellow` — this session
// already established `Confirm`/`Reject…` as the ACTION button labels and
// `Confirmed`/`Rejected` as the RESULTING status labels everywhere else
// (`/app/engine/predicates`, `/app/engine/features`, and FIN's own
// `/app/engine/cards` `STATUS_OPTIONS_FIN`) — this is a genuinely different
// axis, but the SAME wording convention, so it's kept consistent here too
// rather than coining a second vocabulary for what a reviewer sees on
// screen (the underlying `PipelineReviewAction.verdict` values sent to the
// server, `'ok'`/`'not-ok'`, are unaffected — that's wire format, not UI
// copy).
export type PipelineStatusColor = 'gray' | 'purple' | 'blue' | 'yellow' | 'green' | 're-review';

export const PIPELINE_STATUS_META: Record<PipelineStatusColor, { color: string; label: string }> = {
  gray: { color: '#6b7280', label: 'Not started' },
  purple: { color: '#a855f7', label: 'Blocked' },
  blue: { color: '#3b82f6', label: 'Transcribed' },
  yellow: { color: '#eab308', label: 'Rejected' },
  green: { color: '#22c55e', label: 'Confirmed' },
  're-review': { color: '#7dd3fc', label: 'Needs re-review' },
};
