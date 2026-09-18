// Shared response shape for `GET`/`POST /api/card/:set/:number` — the single
// source of truth for what that route hands back, imported by every client
// consumer instead of each one redeclaring its own copy of this interface.
// Previously this was declared inline, separately, in both
// `app/pages/app/card/[set]/[number].vue` (the full card page) and
// `app/components/CardPeekPanel.vue` (the graph page's peek panel, which
// used to fetch only a `{card, edges, themes}` subset for its own now-removed
// `CardRelations` widget) — the panel's narrower shape is what let it drift
// out of sync with what the full page actually renders. Both now import this
// one interface and get the FULL response, since both render the same
// `CardDetailTabs.vue` content.
import type { EnrichedInteractionGroup, EnrichedCardInteractionCategory, ContinuousKeywordGrant, AnnotatedNonFactSpan } from '../../server/api/card/[set]/[number]';
import type { CardData, EdgeData, ThemeData, AnnotatedCard } from '../types';
import type { LogEntry, Scenario } from '../../functional-model/harness';
import type { Fact } from '../../functional-model/synergy';
import type { CardStatusEntry } from '../../functional-model/card-status';
import type { PipelineStatusFile } from '../../functional-model/pipeline-status';

export interface CardResponse {
  card: CardData;
  edges: EdgeData[];
  themes: ThemeData[];
  functionalModel: {
    source: string;
    synergy: { source: Fact[]; sink: Fact[] } | null;
    traces: {
      scenario: { setup: string; action: string; result: string; raw: Scenario };
      log: LogEntry[];
      actions?: { label: string; from: number }[];
    }[];
    annotatedCard: AnnotatedCard | null;
    review: 'ai' | 'human' | null;
    // `progress.json`'s own `reviewCaveat` (2026-09-17, "Confirm (Uncertain)"
    // UI action) — see server/api/card/[set]/[number].ts's own
    // `FunctionalModelData.reviewCaveat` doc comment. Was missing from this
    // hand-mirrored interface even though CardDetailTabs.vue already read it
    // off `props.data` (the exact `cardresponse-hand-mirror-gotcha` this
    // interface's own header warns about) — fixed in passing while removing
    // the reverted sink-attachment fields below.
    reviewCaveat: string | null;
    scenariosReview: 'draft' | 'reviewed';
    interactionsReview: 'draft' | 'reviewed';
    // `verified-snapshot.json`'s own `capturedAt` — see server/api/card/
    // [set]/[number].ts's own `FunctionalModelData.reviewSnapshotAt` doc
    // comment. Pre-existing gap in this hand-mirrored interface (found and
    // fixed in passing 2026-09-16, same edit that added `cardStatus`
    // below) — CardDetailTabs.vue already reads this field off `props.data`
    // today, so this interface was already out of sync with the real
    // server response before this fix.
    reviewSnapshotAt: string | null;
    continuousKeywordGrants: { front?: ContinuousKeywordGrant[]; back?: ContinuousKeywordGrant[] } | null;
    // `progress.json`'s own `annotatedNonFactSpans` (2026-09-16 annotation-
    // taxonomy rework — see `.claude/contracts/card-schema.md`'s dated
    // section) — always an array, `[]` when the card has none.
    annotatedNonFactSpans: AnnotatedNonFactSpan[];
    // Per-card fact-authoring status (2026-09-16) — see server/api/card/
    // [set]/[number].ts's own `FunctionalModelData.cardStatus` doc comment.
    // Computed live per request in dev; read off the build-time-precomputed
    // bundle in production. `null` when it couldn't be computed at all (no
    // functional-model card directory/definition for this card).
    cardStatus: CardStatusEntry | null;
    // `fdn`-only — see server/api/card/[set]/[number].ts's own
    // `FunctionalModelData.pipelineStatus`/`.slug` doc comments. Always
    // `null` for a `fin` entry.
    pipelineStatus: PipelineStatusFile | null;
    slug: string | null;
    // `fdn`-only — see server/api/card/[set]/[number].ts's own
    // `FunctionalModelData.oracleText` doc comment. Always `null` for a
    // `fin` entry (FIN already has its own richer `annotatedCard` path).
    oracleText: string | null;
    // `fdn`-only, 2026-09-18, later still — this card's own real interaction
    // categories against the current FDN pool
    // (`functional-model/card-interactions.ts`'s `computeCardInteractions`,
    // catalog-first, self-inclusive — see `.claude/contracts/
    // card-schema.md`'s own dated section), enriched server-side with real
    // set/collectorNumber/image per match (see server/api/card/[set]/
    // [number].ts's own `EnrichedCardInteractionCategory` doc comment).
    // Always `[]` for a `fin` entry — that set still uses the top-level
    // `interactions` field below (the older paired source+sink Fact
    // model's own cross-card join), a genuinely different mechanism.
    cardInteractions: EnrichedCardInteractionCategory[];
    // `fdn`-only, 2026-09-19 — this card's own `functional-model/
    // fdn-cards/<slug>/NOTES.md` raw content, when one exists. See
    // server/api/card/[set]/[number].ts's own `FunctionalModelData.notes`
    // doc comment. Always `null` for a `fin` entry (no NOTES.md convention
    // exists for that set), and `null` for most `fdn` entries too (a card
    // hasn't gotten one yet) — absence is the common, expected case, not
    // an error.
    notes: string | null;
    // Pretty-printed JSON from the separate `functional-model/scripts/
    // experiments/forge-json-mapper/` experiment's own output, when a
    // matching file exists for this card. See server/api/card/[set]/
    // [number].ts's own `FunctionalModelData.forgeJsonMapper` doc comment —
    // covers exactly 20 real cards today (FDN collector numbers 1-20), so
    // `null` for everything else.
    forgeJsonMapper: string | null;
  } | null;
  interactions: EnrichedInteractionGroup[];
}
