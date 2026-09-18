// The FDN authoring-pipeline's own coverage-justification model — a
// per-slug, SPAN-VERIFIED manifest proving a card's real printed oracle
// text is fully accounted for, either by real `CardDefinition` structure
// (`type: 'definition'|'rules'`) or by a real, deliberately-fact-less span
// (`type: 'lore'`, flavor/reminder text). Supersedes the inline
// `CardDefinition.coverageJustification` field this same schema-tightness
// redesign introduced earlier the same day (2026-09-18) — see
// `.claude/contracts/card-schema.md`'s own dated sections for the full
// before/after story, and `card.ts`'s own header note (right above
// `MissingSchemaFunctionality`) for where the old inline field used to
// live.
//
// Direct successor to FIN's own real precedent for this EXACT shape of
// problem (`synergy.ts`'s `AnnotationRef`/`FactAnnotationAuthoring`/
// `AnnotationAuthoringFile`, `scripts/compute-annotations.mjs`/
// `scripts/annotation-coverage.mjs`) — "author writes short, human intent
// down; a script resolves/verifies it against the card's own REAL printed
// text; nothing is ever hand-typed as pre-computed offsets" — but with a
// genuinely STRONGER completeness bar FIN's own annotation model never
// had: FIN only ever requires "does every authored Fact have at least one
// real annotation" (fact-centric, blind to unclaimed TEXT — see
// `annotation-coverage.mjs`'s own header). This module additionally proves
// **every real character of the card's own printed `oracle_text` is
// claimed by EXACTLY one manifest entry's span**, punctuation/whitespace
// excepted — the user's own explicit ask ("run a script... against
// original card description and ensure nothing is lost").
//
// ## Why per-card `justification.json`, not `annotations-authoring.json`'s
// own line/highlight-substring-search authoring shape
//
// FIN's `FactAnnotationAuthoring` (`sourceText`/`highlight`/`anchor`/`line`)
// is deliberately LOOSE — a short, possibly-ambiguous highlight phrase a
// script resolves via `indexOf`, tolerant of a highlight simply not
// resolving (silently `undefined`, not a hard failure, since not every fact
// needs an anchor). That looseness is wrong for THIS mechanism, whose whole
// point is "nothing is lost" — a bare highlight-phrase search can't prove
// full-text coverage (two entries could both fail to resolve and no
// "walk the whole string" check would even be possible without real,
// author-declared offsets). So this module's own on-disk shape
// (`CoverageJustificationEntry.spans`) requires the author to name real
// `from`/`to` OFFSETS plus the exact `text` substring at that location —
// the verifier's job is EXACT-MATCH confirmation (`realText.slice(from,
// to) === text`), not fuzzy resolution — a hard, loud failure the moment an
// author's own offsets/text don't match the real printed card, mirroring
// `rawHighlightRange`'s own "the author pointed at real text and it
// doesn't resolve = loud error" precedent, just unconditional here instead
// of conditional on a prior successful anchor.
//
// ## Multi-span entries (2026-09-18, later still — user correction)
//
// A single logical coverage claim can legitimately correspond to more than
// one DISJOINT real span — Arahbo's own "Whenever Arahbo or another
// nontoken Cat you control enters, create a 1/1 white Cat creature token."
// splits into an Arahbo-covered half ("Whenever Arahbo" + "enters, create a
// 1/1 white Cat creature token.") and a genuinely uncovered middle ("or
// another nontoken Cat you control"), and those two covered fragments are
// NOT a contiguous substring — forcing them into one span would require
// either quoting the whole sentence (falsely claiming the uncovered middle
// too) or "..." elision (which would not literal-match the real text at
// all, defeating the exact-substring check). `CoverageJustificationEntry
// .spans` is therefore a non-empty ARRAY of `CoverageSpan`s, each with its
// OWN `text` (one substring per span, never a single concatenated string
// for the whole entry — keeps the exact-match check unambiguous: each span
// verifies independently against its own claimed range).
//
// ## Full-text coverage is enforced for `oracle_text` ONLY, not `type_line`
//
// A real printed type line ("Legendary Creature — Cat Avatar") is
// mechanically trivial — already, unconditionally covered by a card's own
// baseline `typeLine`/`name`/`pt` fields with no authoring effort possible
// to skip, unlike `oracle_text` (genuinely hand-written rules prose a
// definition can genuinely fail to cover). Requiring per-character
// justification of every type line would be pure busywork the user's own
// sketch never asked for. `type_line` remains a legitimate `textLocation`
// (mirrors `AnnotationRef`'s own rare `target:'typeLine'` variant — a claim
// whose real textual basis is the printed type line, not the ability text
// body) — SPANS on a `type_line` entry are still exact-substring-verified
// and still checked for overlap (a char can't be double-claimed there
// either), just never required to reach 100% coverage.

import type { CardDefinition, Effect, Keyword } from './card';
import { collectEffects } from './card-status';

/** WHY a span exists — classifies the entry, not the text's literal content:
 * `'definition'`/`'rules'` = real rules text that needs (and carries) a
 * real `definitionKeys` pointer into this SAME card's own `CardDefinition`;
 * `'lore'` = flavor/reminder text that will never need a functional
 * counterpart, but still needs a real, verified span so it counts toward
 * full-text coverage instead of being silently un-claimable. */
export type CoverageSpanType = 'definition' | 'rules' | 'lore';

/** Which of a face's own real printed text fields a `CoverageJustificationEntry`
 * claims a span against — mirrors `AnnotationRef`'s own `'oracle'`/`'typeLine'`
 * split, renamed to the real Scryfall field-name spelling per the user's own
 * "textLocation: scryfall key" ask. `oracle_text` is the one subject to the
 * full-coverage completeness check (see this file's own header); `type_line`
 * is not. */
export type JustificationTextLocation = 'oracle_text' | 'type_line';

/** One real, exact, verified substring of the named `textLocation`'s real
 * text — `from`/`to` are plain character offsets into the WHOLE text string
 * (Scryfall's own `\n`-joined `oracle_text`, or the single-line `type_line`),
 * half-open like `AnnotationRef` (`realText.slice(from, to)`). `text` is the
 * real, exact substring at that location — verified byte-for-byte by
 * `verifyCoverageJustification` below, never trusted merely because it was
 * typed; a mismatch is a hard, loud failure (see this file's own header). */
export interface CoverageSpan {
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

/**
 * Closed vocabulary for what a `definition`/`rules`-typed entry's
 * `definitionKeys` can point at — the direct, unchanged-in-shape successor
 * to the old inline `CoverageReference` union (`card.ts`, pre-2026-09-18-
 * later-still) — `name`/`field`/`index`/`keyword`/`effectKind` are bare
 * STRUCTURAL identifiers (a real lookup key into the SAME card's own
 * `CardDefinition`), never free-form judgment text. Grows on demand, same
 * discipline `Keyword`/`Trigger.on` already follow in `card.ts` itself.
 */
export type CoverageReference =
  | { readonly kind: 'keyword'; readonly keyword: Keyword }
  | { readonly kind: 'trigger'; readonly name: string }
  | { readonly kind: 'ability'; readonly name: string }
  | { readonly kind: 'effect'; readonly effectKind: Effect['kind'] }
  | { readonly kind: 'field'; readonly field: CoverageFieldName }
  | { readonly kind: 'missingSchemaFunctionality'; readonly index: number }
  /** Legitimate only for a FIN card, in principle — the FDN gate hard-fails
   * on ANY `staticAbilities` usage at all (`validate-card-definition.mjs`'s
   * own `findStaticAbilitiesPolicyViolationReasons`), so this pointer kind
   * can never actually resolve for a real FDN card as things stand; kept in
   * the union for schema generality only, same as before the relocation. */
  | { readonly kind: 'staticAbilities'; readonly index: number };

/** Any other structured `CardDefinition` field whose mere PRESENCE conveys
 * coverage, beyond the dedicated `keyword`/`trigger`/`ability`/`effect`
 * pointer kinds above (each of which already carries its own real lookup
 * key). Direct, unchanged-in-shape successor to the old inline
 * `CoverageFieldName` union. Grows on demand, same discipline as
 * `CoverageReference` itself. */
export type CoverageFieldName =
  | 'pt'
  | 'cmc'
  | 'alternateCosts'
  | 'costReduction'
  | 'spellCostReductionGrants'
  | 'millModifierGrants'
  | 'activationCost'
  | 'crewCost'
  | 'manaAbilities'
  | 'ptFormula'
  | 'continuousKeywordGrants'
  | 'continuousPTGrants'
  | 'continuousTypeGrants'
  | 'activatedAbilityLock'
  | 'triggerDoubling'
  | 'typeLine'
  | 'manaCost'
  | 'name';

/**
 * One real, distinct coverage claim — the on-disk unit of
 * `functional-model/fdn-cards/<slug>/justification.json` (a plain, flat
 * array of these; see `JustificationFile`). Unlike the old inline shape
 * (one `clause: string`), the real claimed text lives ONLY as real,
 * verified `spans` — no separate free-text `clause` field at all, since
 * that would just be a second, unverified copy of the same text
 * `spans[].text` already carries verified.
 */
export interface CoverageJustificationEntry {
  readonly type: CoverageSpanType;
  readonly textLocation: JustificationTextLocation;
  /** Which face this entry's spans are claimed against — mirrors
   * `Fact.face`/`AnnotationRef`'s own convention. Omitted = `'front'` (the
   * only face on a single-faced card, or the front face of a DFC). A
   * `'back'` entry is only ever legal on a card with a real `backFace`. */
  readonly face?: 'front' | 'back';
  /** One or more DISJOINT real spans this ONE entry claims — see this
   * file's own header, "Multi-span entries," for why more than one is a
   * real, legitimate shape, not a workaround. */
  readonly spans: readonly [CoverageSpan, ...CoverageSpan[]];
  /** Required (real, non-empty) for `type: 'definition'|'rules'`; must be
   * OMITTED (or empty) for `type: 'lore'` — a flavor/reminder-text span has
   * nothing in `CardDefinition` to point at by definition, and declaring
   * one anyway would misrepresent it as functionally backed. */
  readonly definitionKeys?: readonly CoverageReference[];
  /** The author's own written reasoning connecting this entry's spans to
   * `definitionKeys` (or, for `type:'lore'`, simply why this span is
   * flavor/reminder text) — the user's own phrasing, "this text is covered
   * by this code in definition." Real prose required for every entry
   * regardless of `type`, never a bare restatement of the span text. */
  readonly reasoning: string;
}

/** On-disk shape of `functional-model/fdn-cards/<slug>/justification.json`
 * — a plain, flat array (no source/sink split the way FIN's
 * `AnnotationAuthoringFile` needs, since coverage-justification has no
 * analogous role axis). Checked in, human/AI-authored, never derived by a
 * script — same "authored intent, script only VERIFIES it" split FIN's own
 * `annotations-authoring.json` already establishes. */
export type JustificationFile = CoverageJustificationEntry[];

/** Real text available for verification, keyed by face then
 * `JustificationTextLocation` — the pure core below takes this already
 * resolved (no fs access itself, mirrors `text-coverage.mjs`'s own
 * `computeTextCoverage(facts, oracleByFace, ...)` "pure core, fs stays in
 * the caller" split) so it's directly unit-testable against synthetic
 * text, and so the real fs/source-resolution question (see
 * `functional-model/scripts/verify-coverage-justification.mjs`'s own
 * header for where the REAL text actually comes from) stays fully out of
 * this module. */
export interface JustificationTexts {
  front: { oracle_text?: string; type_line?: string };
  back?: { oracle_text?: string; type_line?: string };
}

export interface CoverageJustificationResult {
  ok: boolean;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// definitionKeys resolution — direct port of the old
// `validate-card-definition.mjs`'s `unresolvedCoverageReferenceReason`/
// `COVERAGE_REFERENCE_KINDS`, unchanged in behavior, just relocated to a
// real TS module (this file) instead of a duplicated plain-JS runtime Set —
// `card.ts`'s own `CoverageReference` union WAS that duplication's source
// of truth before the relocation; now that `CoverageReference` lives here
// directly as a real TS type, `validate-card-definition.mjs` can keep its
// own thin plain-JS mirror (still duplicated across the JS/TS boundary, same
// documented trade-off `pipeline-status.ts`'s own header already accepts
// for `CardDefinitionValidationResult`) OR import this file's own real
// runtime check directly — see that script's own updated header for which
// it does.

const COVERAGE_REFERENCE_KINDS = new Set(['keyword', 'trigger', 'ability', 'effect', 'field', 'missingSchemaFunctionality', 'staticAbilities']);

/**
 * Mechanically checks a `CoverageReference` actually resolves to something
 * real on `definition` (a single face's own object — the caller decides
 * whether that's the front `CardDefinition` or its `backFace`). Returns
 * `undefined` when it resolves, otherwise a real, specific reason string.
 * Never semantic — see this file's own header and `validateCoverageJustification`'s
 * own doc comment for what this does and doesn't verify.
 */
export function unresolvedCoverageReferenceReason(coveredBy: CoverageReference | null | undefined, definition: CardDefinition): string | undefined {
  if (!coveredBy || typeof coveredBy !== 'object' || !COVERAGE_REFERENCE_KINDS.has(coveredBy.kind)) {
    return `definitionKeys entry has no real, recognized \`kind\` (got ${JSON.stringify(coveredBy)})`;
  }
  switch (coveredBy.kind) {
    case 'keyword':
      return (definition.keywords ?? []).includes(coveredBy.keyword) ? undefined : `kind:'keyword' names "${coveredBy.keyword}", not present in this card's own \`keywords\``;
    case 'trigger':
      return (definition.triggers ?? []).some((t) => t.name === coveredBy.name)
        ? undefined
        : `kind:'trigger' names "${coveredBy.name}", not a real trigger name on this card's own \`triggers\``;
    case 'ability':
      return (definition.abilities ?? []).some((a) => a.name === coveredBy.name)
        ? undefined
        : `kind:'ability' names "${coveredBy.name}", not a real ability name on this card's own \`abilities\``;
    case 'effect':
      return collectEffects(definition).some((e) => e.kind === coveredBy.effectKind)
        ? undefined
        : `kind:'effect' names Effect kind "${coveredBy.effectKind}", not actually used anywhere on this card`;
    case 'field': {
      const value = (definition as unknown as Record<string, unknown>)[coveredBy.field];
      return value !== undefined && !(Array.isArray(value) && value.length === 0) ? undefined : `kind:'field' names "${coveredBy.field}", not actually present (or empty) on this card`;
    }
    case 'missingSchemaFunctionality':
      return typeof coveredBy.index === 'number' && coveredBy.index >= 0 && coveredBy.index < (definition.missingSchemaFunctionality ?? []).length
        ? undefined
        : `kind:'missingSchemaFunctionality' index ${coveredBy.index} is out of range (this card has ${(definition.missingSchemaFunctionality ?? []).length} real entries)`;
    case 'staticAbilities':
      return typeof coveredBy.index === 'number' && coveredBy.index >= 0 && coveredBy.index < (((definition as unknown as { staticAbilities?: unknown[] }).staticAbilities ?? []).length)
        ? undefined
        : `kind:'staticAbilities' index ${coveredBy.index} is out of range`;
    default:
      return `definitionKeys entry has no real, recognized \`kind\` (got ${JSON.stringify(coveredBy)})`;
  }
}

// ---------------------------------------------------------------------------
// Full-text tiling/coverage — the genuinely NEW mechanical guarantee this
// module adds beyond the old inline manifest's own presence-only check.

/** Same "bare sentence punctuation/whitespace carries no content of its
 * own" character class `functional-model/scripts/text-coverage.mjs`'s own
 * `isGapWorthy` already established (kept as a separate, small duplicate —
 * same "small stable duplicate, grow only when forced" precedent
 * `annotation-coverage.mjs`/`scenario-card-names.mjs` already each accept —
 * rather than importing a `.mjs` file's own internal helper into a `.ts`
 * module). A real content character INSIDE a printed symbol (`{1}`'s `1`,
 * `+1/+1`'s digits/`+`/`/`) is deliberately NOT exempted here — those
 * characters carry real information (which mana value, which counter type)
 * and are expected to fall naturally inside whichever entry's span already
 * covers that whole clause, never carved out as a bare punctuation gap of
 * their own. */
function isPunctuationOrWhitespace(ch: string): boolean {
  return /[\s,.;:—-]/.test(ch);
}

interface FlatSpan {
  from: number;
  to: number;
  entryIndex: number;
}

/** Every real gap (uncovered, non-punctuation run) or overlap (double-
 * claimed run) found while tiling `spans` against `text` — pure, no
 * knowledge of entries/definitionKeys, just character-level interval math.
 * `requireFullCoverage` gates whether an uncovered gap is reported at all
 * (`type_line` callers pass `false` — see this file's own header, "Full-
 * text coverage is enforced for oracle_text ONLY"); overlap is ALWAYS
 * checked regardless (a character being double-claimed is never legitimate,
 * on either text location). */
function tileSpans(text: string, spans: FlatSpan[], requireFullCoverage: boolean): string[] {
  const reasons: string[] = [];
  const claimCount = new Array<number>(text.length).fill(0);
  const claimedBy = new Array<number[]>(text.length);
  for (const span of spans) {
    for (let i = Math.max(0, span.from); i < Math.min(text.length, span.to); i++) {
      claimCount[i]++;
      (claimedBy[i] ??= []).push(span.entryIndex);
    }
  }

  // Overlap — a real double-claim, always an error regardless of
  // requireFullCoverage (see this function's own doc comment).
  let overlapStart = -1;
  for (let i = 0; i <= text.length; i++) {
    const overlapped = i < text.length && claimCount[i] > 1;
    if (overlapped && overlapStart === -1) overlapStart = i;
    if (!overlapped && overlapStart !== -1) {
      const entries = [...new Set(claimedBy.slice(overlapStart, i).flat())].sort((a, b) => a - b);
      reasons.push(`spans overlap at [${overlapStart}, ${i}) ("${text.slice(overlapStart, i)}"), claimed by more than one entry (indices ${entries.join(', ')})`);
      overlapStart = -1;
    }
  }

  if (!requireFullCoverage) return reasons;

  // Uncovered gap — same "a covered gap-worthy char is a hard segment
  // boundary, an uncovered run merges across intervening punctuation/
  // whitespace" algorithm `text-coverage.mjs`'s own `computeTextCoverage`
  // already established, ported to operate over the WHOLE string (this
  // module uses flat, whole-text offsets, not FIN's own per-line ones — see
  // this file's own header) rather than per-line.
  let segStart = 0;
  for (let i = 0; i <= text.length; i++) {
    const boundary = i === text.length || (!isPunctuationOrWhitespace(text[i]!) && claimCount[i] > 0);
    if (!boundary) continue;
    let hasUncovered = false;
    for (let j = segStart; j < i; j++) if (!isPunctuationOrWhitespace(text[j]!) && claimCount[j] === 0) hasUncovered = true;
    if (hasUncovered) {
      reasons.push(`real text not claimed by any entry's span at [${segStart}, ${i}) ("${text.slice(segStart, i)}") — every non-punctuation/non-whitespace character must be covered by exactly one entry`);
    }
    segStart = i + 1;
  }
  return reasons;
}

// ---------------------------------------------------------------------------
// The real orchestrator

function faceObject(definition: CardDefinition, face: 'front' | 'back'): CardDefinition | undefined {
  return face === 'front' ? definition : definition.backFace;
}

/**
 * The real, mechanical, pure verification core — no fs access, real text
 * already resolved into `texts` by the caller (see
 * `functional-model/scripts/verify-coverage-justification.mjs`'s own header
 * for where that real text actually comes from). Checks, in order:
 *   1. `entries` is a real, non-empty array.
 *   2. Every entry is well-formed (`type`/`textLocation`/`face`/`spans` all
 *      real; `definitionKeys` required+non-empty for `definition`/`rules`,
 *      forbidden for `lore`).
 *   3. Every entry's `face:'back'` only appears when `definition.backFace`
 *      is real.
 *   4. Real text is actually available for every `(face, textLocation)`
 *      pair an entry claims — a card whose real oracle text hasn't been
 *      synced yet (see `data/fdn/fdn_scryfall.json`) fails here with a
 *      clear, actionable reason, never silently skipped.
 *   5. Every span's `text` EXACTLY matches the real text at `[from, to)` —
 *      hard failure on any mismatch (see this file's own header).
 *   6. Every `definitionKeys` pointer resolves against the RIGHT face's own
 *      `CardDefinition` (`unresolvedCoverageReferenceReason`).
 *   7. Full-text tiling per `(face, 'oracle_text')`: zero overlaps, zero
 *      uncovered non-punctuation/non-whitespace runs. `type_line` spans are
 *      overlap-checked but NOT required to reach full coverage (see this
 *      file's own header).
 *   8. Directional completeness: every real `missingSchemaFunctionality`
 *      entry (per face) is referenced by at least one `definitionKeys`
 *      pointer somewhere in this SAME face's own entries.
 * Never throws — every input here is already a real, already-imported/
 * already-parsed plain object/string by the time this runs.
 */
export function validateCoverageJustification(definition: CardDefinition, entries: JustificationFile | null | undefined, texts: JustificationTexts): CoverageJustificationResult {
  const reasons: string[] = [];

  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, reasons: ['missing/empty justification manifest — every FDN card needs a real, span-verified functional-model/fdn-cards/<slug>/justification.json (see coverage-justification.ts\'s own CoverageJustificationEntry doc comment)'] };
  }

  const hasBackFace = Boolean(definition.backFace);

  entries.forEach((entry, i) => {
    const label = `entry [${i}]`;
    if (entry?.type !== 'definition' && entry?.type !== 'rules' && entry?.type !== 'lore') {
      reasons.push(`${label} has no real \`type\` (expected 'definition'|'rules'|'lore', got ${JSON.stringify(entry?.type)})`);
    }
    if (entry?.textLocation !== 'oracle_text' && entry?.textLocation !== 'type_line') {
      reasons.push(`${label} has no real \`textLocation\` (expected 'oracle_text'|'type_line', got ${JSON.stringify(entry?.textLocation)})`);
    }
    const face = entry?.face ?? 'front';
    if (face !== 'front' && face !== 'back') {
      reasons.push(`${label} has an invalid \`face\` (expected 'front'|'back', got ${JSON.stringify(entry?.face)})`);
    } else if (face === 'back' && !hasBackFace) {
      reasons.push(`${label} claims face:'back' but this card has no real backFace`);
    }
    if (!Array.isArray(entry?.spans) || entry.spans.length === 0) {
      reasons.push(`${label} has no real, non-empty \`spans\` array`);
    } else {
      entry.spans.forEach((span, si) => {
        if (typeof span?.from !== 'number' || typeof span?.to !== 'number' || span.from < 0 || span.to <= span.from) {
          reasons.push(`${label} span [${si}] has an invalid from/to (${JSON.stringify(span)})`);
        }
        if (typeof span?.text !== 'string' || span.text.length === 0) {
          reasons.push(`${label} span [${si}] has no real, non-empty \`text\``);
        }
      });
    }
    if (typeof entry?.reasoning !== 'string' || entry.reasoning.trim().length === 0) {
      reasons.push(`${label} has no real, non-empty \`reasoning\` text`);
    }
    if (entry?.type === 'lore') {
      if (Array.isArray(entry.definitionKeys) && entry.definitionKeys.length > 0) {
        reasons.push(`${label} is type:'lore' but declares non-empty \`definitionKeys\` — a lore/flavor span has nothing real to point at by definition`);
      }
    } else if (entry?.type === 'definition' || entry?.type === 'rules') {
      if (!Array.isArray(entry.definitionKeys) || entry.definitionKeys.length === 0) {
        reasons.push(`${label} is type:'${entry.type}' but has no real, non-empty \`definitionKeys\``);
      } else {
        const faceDef = faceObject(definition, face === 'back' ? 'back' : 'front');
        if (faceDef) {
          entry.definitionKeys.forEach((ref, ri) => {
            const unresolved = unresolvedCoverageReferenceReason(ref, faceDef);
            if (unresolved) reasons.push(`${label} definitionKeys[${ri}] does not resolve: ${unresolved}`);
          });
        }
      }
    }
  });

  if (reasons.length > 0) return { ok: false, reasons };

  // Real text availability + span exact-match + tiling, per (face,
  // textLocation). `oracle_text` is ALWAYS checked (it's the mandatory,
  // full-coverage-required location — a face with a real backFace but
  // literally ZERO justification entries for its own oracle text is not
  // "nothing to check," it's 100% uncovered, and must fail exactly the same
  // way a partially-covered one does). `type_line` is optional — only
  // checked when at least one entry actually claims it (see this file's own
  // header, "Full-text coverage is enforced for oracle_text ONLY").
  const faces: Array<'front' | 'back'> = hasBackFace ? ['front', 'back'] : ['front'];
  for (const face of faces) {
    const faceTexts = face === 'front' ? texts.front : texts.back;
    for (const textLocation of ['oracle_text', 'type_line'] as const) {
      const relevantEntries = entries
        .map((entry, i) => ({ entry, i }))
        .filter(({ entry }) => (entry.face ?? 'front') === face && entry.textLocation === textLocation);
      if (relevantEntries.length === 0 && textLocation === 'type_line') continue;

      const realText = faceTexts?.[textLocation];
      if (typeof realText !== 'string') {
        reasons.push(
          `no real "${textLocation}" text available for the ${face} face — run functional-model/scripts/sync-fdn-oracle-text.mjs (see this file's own header) before authoring spans against it`,
        );
        continue;
      }

      const flatSpans: FlatSpan[] = [];
      for (const { entry, i } of relevantEntries) {
        for (const span of entry.spans) {
          const real = realText.slice(span.from, span.to);
          if (real !== span.text) {
            reasons.push(
              `entry [${i}] (${face}, ${textLocation}) span [${span.from}, ${span.to}) does not match the real text — expected ${JSON.stringify(span.text)}, real text is ${JSON.stringify(real)}`,
            );
          }
          flatSpans.push({ from: span.from, to: span.to, entryIndex: i });
        }
      }

      const requireFullCoverage = textLocation === 'oracle_text';
      for (const r of tileSpans(realText, flatSpans, requireFullCoverage)) reasons.push(`${face}/${textLocation}: ${r}`);
    }
  }

  // Directional completeness — every real missingSchemaFunctionality entry
  // (per face) referenced by at least one same-face definitionKeys pointer.
  for (const face of faces) {
    const faceDef = faceObject(definition, face);
    const gaps = faceDef?.missingSchemaFunctionality ?? [];
    gaps.forEach((_, gi) => {
      const referenced = entries.some(
        (entry) =>
          (entry.face ?? 'front') === face &&
          (entry.definitionKeys ?? []).some((ref) => ref.kind === 'missingSchemaFunctionality' && ref.index === gi),
      );
      if (!referenced) {
        reasons.push(`${face} missingSchemaFunctionality[${gi}] has no justification entry referencing it (definitionKeys entry {kind:'missingSchemaFunctionality', index:${gi}})`);
      }
    });
  }

  return reasons.length > 0 ? { ok: false, reasons } : { ok: true, reasons: [] };
}
