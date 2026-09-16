// Computes REAL oracle-text coverage for a card's own `synergy.json` — a
// genuinely different, STRONGER check than `annotation-coverage.mjs`'s own
// "does every fact have at least one annotation" (a fact-centric check,
// blind to whether the CARD'S OWN FULL TEXT has any clause with zero
// fact/annotation pointing at it at all). Built 2026-09-15 per the
// coordinator's own ask (fin/7, Ashe, Princess of Dalmasca's own stale
// `textCoverageAudited: true`/`knownGaps: []` despite "Put the rest on the
// bottom of your library in a random order" having no fact/annotation
// anywhere) — see `.claude/contracts/card-schema.md` for the resulting
// `progress.json` field this script's own output is meant to populate.
//
// **Method**: union every REAL `{target:'oracle', line, start, end}`
// annotation span (across a card's own source+sink facts, both faces of a
// DFC) onto that face's own real oracle text, per line; a parenthetical
// reminder-text span (`(...)`) is treated as always-covered (real Magic
// reminder text is a rules clarification, never itself the textual basis
// for a Fact — same convention every recognizer in this pool already
// follows by construction, never anchoring an annotation inside one).
// Whitespace-only/punctuation-only gaps (`\s|[,.;:—-]`) don't count as a
// real uncovered clause either — only a contiguous run of 4+ real
// (non-reminder, non-punctuation) characters is reported as a genuine gap,
// the same "don't flag noise" discipline `annotation-coverage.mjs`'s own
// scope-narrowing comment already uses for a different check.
//
// **Deliberately NOT a claim that 100% coverage is always achievable or
// required** — some real clauses genuinely have no synergy-relevant content
// (a flavor sentence, a fixed rules explanation with no external hook any
// other card could ever produce/consume). This is an INFORMATIONAL signal
// (`textCoverageAudited`'s own real, honest heir), not a hard gate — see
// `verify-text-coverage.mjs`'s own header for why it never hard-fails a
// pool-wide run.
import { readFile, readdir } from 'node:fs/promises';

/** Same real, checked-in Scryfall lookup-by-name convention `apply-
 * recognizers.mjs`'s own `loadOracleTextByName` already established —
 * duplicated (not imported) for the same "small, stable, plain-JS-callable
 * duplicate" reasoning `scenario-card-names.mjs`/`annotation-coverage.mjs`
 * each already give for their own copies, not re-derived here. */
export async function loadOracleTextByName(dataDir) {
  const byName = new Map();
  const setDirs = await readdir(dataDir, { withFileTypes: true }).catch(() => []);
  for (const dir of setDirs) {
    if (!dir.isDirectory()) continue;
    const setDir = new URL(`${dir.name}/`, dataDir);
    const files = await readdir(setDir, { withFileTypes: true }).catch(() => []);
    for (const file of files) {
      if (!file.name.endsWith('_scryfall.json') || file.name.endsWith('_tokens_scryfall.json')) continue;
      const cards = JSON.parse(await readFile(new URL(file.name, setDir), 'utf8'));
      for (const card of cards) {
        if (typeof card?.name !== 'string' || byName.has(card.name)) continue;
        if (Array.isArray(card.card_faces) && card.card_faces.length > 0) {
          byName.set(card.name, {
            front: { oracleText: card.card_faces[0]?.oracle_text ?? '' },
            back: card.card_faces[1] ? { oracleText: card.card_faces[1]?.oracle_text ?? '' } : undefined,
          });
        } else {
          byName.set(card.name, { front: { oracleText: card.oracle_text ?? '' } });
        }
      }
    }
  }
  return byName;
}

/** Marks every parenthetical reminder-text span (`(...)`, non-nested — real
 * Magic reminder text never nests parens) as covered up front, since no
 * recognizer in this pool ever anchors an annotation inside one. */
function markReminderTextCovered(line, covered) {
  const re = /\([^)]*\)/g;
  let m;
  while ((m = re.exec(line))) {
    for (let i = m.index; i < m.index + m[0].length; i++) covered[i] = true;
  }
}

/** Real gap-worthy character — not whitespace, not one of Magic's own
 * bare punctuation marks (comma/period/semicolon/colon/em-dash/hyphen) that
 * carry no content of their own. */
function isGapWorthy(ch) {
  return !/[\s,.;:—\-]/.test(ch);
}

/**
 * Computes this card's own real per-line coverage. `facts` is the raw
 * `{source, sink}` shape off `synergy.json`. `nonFactAnnotations` (2026-09-16,
 * the annotation-taxonomy plumbing — see `progress.json`'s own
 * `annotatedNonFactSpans` field, `.claude/contracts/card-schema.md`) is an
 * OPTIONAL, separate array of spans that are real and accounted-for but
 * deliberately carry no `Fact` at all — same `{target, line, start, end}`
 * span shape `AnnotationRef` already uses, just reused outside the Fact
 * chain (a `Fact.annotations` entry's own hard invariant is "must back a
 * real Fact," which a `kind:'definition-path'`/`'rules'`/`'lore'` span by
 * definition doesn't). Marked covered via the EXACT SAME per-line loop as a
 * real Fact's own annotations, immediately below it — computationally
 * identical treatment, only the reporting distinguishes them (`gaps`
 * doesn't know or care which loop covered a given character; a
 * `nonFactAnnotations` entry closes a gap exactly as effectively as a
 * `Fact.annotations` one). Only `target:'oracle'` entries do anything here
 * (same as a real Fact's own `target:'typeLine'` annotations — this
 * function only ever scans `oracleByFace`, never a type line at all, so a
 * `target:'typeLine'` non-Fact span is a legitimate no-op input here, not
 * an error). Returns `{ ratio, gaps }` — `ratio` is
 * `coveredGapWorthyChars / totalGapWorthyChars` (1 when the face has no
 * gap-worthy characters at all, e.g. a vanilla creature with no oracle
 * text); `gaps` is every real contiguous uncovered run of 4+ gap-worthy
 * characters, as `{ face, line, start, end, text }`.
 */
export function computeTextCoverage(facts, oracleByFace, nonFactAnnotations = []) {
  const gaps = [];
  let totalGapWorthy = 0;
  let coveredGapWorthy = 0;

  for (const [face, oracleText] of Object.entries(oracleByFace)) {
    if (oracleText === undefined) continue;
    const lines = oracleText.split('\n');
    const coveredPerLine = lines.map((l) => new Array(l.length).fill(false));
    for (let i = 0; i < lines.length; i++) markReminderTextCovered(lines[i], coveredPerLine[i]);

    for (const arr of [facts.source ?? [], facts.sink ?? []]) {
      for (const fact of arr) {
        for (const ann of fact.annotations ?? []) {
          if (ann.target !== 'oracle') continue;
          if ((fact.face ?? 'front') !== face) continue;
          const arrLine = coveredPerLine[ann.line];
          if (!arrLine) continue;
          for (let i = ann.start; i < ann.end && i < arrLine.length; i++) arrLine[i] = true;
        }
      }
    }

    // Real, accounted-for spans with no `Fact` at all (`progress.json`'s
    // `annotatedNonFactSpans` — see this function's own doc comment above).
    // Structurally identical loop to the real-Fact one directly above; only
    // the source array differs.
    for (const span of nonFactAnnotations) {
      if (span.target !== 'oracle') continue;
      if ((span.face ?? 'front') !== face) continue;
      const arrLine = coveredPerLine[span.line];
      if (!arrLine) continue;
      for (let i = span.start; i < span.end && i < arrLine.length; i++) arrLine[i] = true;
    }

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const coveredArr = coveredPerLine[lineIdx];
      for (let i = 0; i < line.length; i++) {
        if (!isGapWorthy(line[i])) continue;
        totalGapWorthy++;
        if (coveredArr[i]) coveredGapWorthy++;
      }
      // A COVERED gap-worthy character is a hard segment boundary — an
      // uncovered stretch never merges across one (real, annotated content
      // genuinely splits a card's own text into separate uncovered
      // clauses); an uncovered/whitespace/punctuation run does NOT break a
      // segment, so "look at the top five cards of your library" reports
      // as ONE real gap, not a word-by-word list.
      let segStart = 0;
      for (let i = 0; i <= line.length; i++) {
        const boundary = i === line.length || (isGapWorthy(line[i]) && coveredArr[i]);
        if (!boundary) continue;
        let hasUncovered = false;
        for (let j = segStart; j < i; j++) if (isGapWorthy(line[j]) && !coveredArr[j]) hasUncovered = true;
        if (hasUncovered) {
          const trimmed = line.slice(segStart, i).trim();
          // Strip a leading "<ability name/Saga chapter/modal bullet>
          // — " label (real, checked pool-wide pattern, 2026-09-15: Saga
          // chapter numerals "I —"/"II, III —", modal bullets "• Attack
          // —", static-ability names "Dragonfire Dive —" — this pool's own
          // convention of narrow, precise per-clause annotation anchors
          // deliberately never anchors these, and they're not independent
          // rules content of their own) before applying the length
          // threshold below — measuring the ORIGINAL `trimmed` string
          // would flag hundreds of these real, low-value labels as if they
          // were genuine content gaps (confirmed via a real pool-wide dry
          // run before this fix: 248/300 cards flagged below 85%, almost
          // all of them nothing but an unannotated label prefix — clearly
          // not a useful signal at that rate). The FULL `trimmed` text
          // (label included) is still what's reported/stored below, only
          // the THRESHOLD check itself measures the stripped remainder.
          const afterLabel = trimmed.replace(/^[^—]{0,40}—\s*/, '');
          // Real, checked threshold (2026-09-15) — 20 chars was tuned
          // against Ashe's own two SUBSTANTIAL real gaps (34 and 65 chars,
          // the actual target this whole check exists to surface) versus
          // the real pool-wide false-positive rate above once label
          // prefixes are excluded. Not a claim that 20 is a universally
          // correct cutoff for every future card; revisit if a real gap
          // shorter than this is ever missed.
          if (afterLabel.length >= 20) gaps.push({ face, line: lineIdx, start: segStart, end: i, text: trimmed });
        }
        segStart = i + 1;
      }
    }
  }

  return { ratio: totalGapWorthy === 0 ? 1 : coveredGapWorthy / totalGapWorthy, gaps };
}
