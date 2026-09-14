// Wires the `functional-model/recognizers/` prototype library into REAL
// per-card generated data (`cards/<slug>/synergy.json`) — the follow-up
// `PRD_AUTOMATED_AUTHORING.md`'s own "Prototype findings" section explicitly
// scoped OUT ("this prototype does NOT write recognizer output into any
// real cards/<slug>/synergy.json — ... Wiring a recognizer's output into the
// real per-card pipeline ... is real future work, not attempted here").
// This script is that future work.
//
// Additive, mechanical, idempotent — never touches an existing hand-authored
// fact, `progress.json`, or anything except appending NEW facts to a card's
// own `source` array:
//   - Loads every `cards/<slug>/definition.ts` (for `typeLine`/`backFace`,
//     the exact same access pattern `scripts/compute-annotations.mjs`
//     already established) and that card's own real printed oracle text off
//     the checked-in `data/<set>/<set>_scryfall.json` (same lookup-by-name
//     convention that same script uses, including its own two-faced-card
//     "combined name" reconstruction) — a recognizer never sees anything a
//     human couldn't also read straight off the card.
//   - Runs every real recognizer (instant-sorcery-resolves-to-graveyard,
//     permanent-enters-battlefield-normally, destroy-effect-structural,
//     drawCard-effect-structural, saga-lore-and-sacrifice-structural,
//     dies-trigger-structural, lifegain-trigger-structural,
//     dealDamage-effect-structural, putCounter-broadcast-structural)
//     against every face a card has. The plain TEXT recognizers (the first
//     two, plus dies-trigger-structural/lifegain-trigger-structural) only
//     ever read that face's own printed `typeLine`/`oracleText`; the
//     STRUCTURAL ones (destroy/drawCard/saga-lore/dealDamage/putCounter-
//     broadcast) additionally read that SAME face's own structured
//     `effects`/`triggers`/`abilities` straight off its
//     `CardDefinition`/`backFace` — see `recognizers/structural-effects.ts`'s
//     own doc comment. `putCounter-broadcast-structural` additionally
//     EXECUTES a `kind:'custom'` effect's own closure (against a fake,
//     inert, instrumented board — `recognizers/runtime-action-probe.ts`,
//     promoted out of prototype status the same pass as this wiring) before
//     text-confirming its own classified output — the one recognizer in this
//     catalog that isn't a pure function of static source text/structure.
//   - A DECLINED verdict contributes nothing — same "never contradicts an
//     already-authored fact" overlay-model guarantee the PRD's own Design
//     section describes.
//   - Every face's own MATCHED facts (across every recognizer that ran
//     against it, combined) are first grouped by identity and merged
//     (`mergeRecognizedFactsByIdentity` below — 2026-09-13 follow-up,
//     replacing three near-identical bespoke per-recognizer `seen`-Set
//     dedups with one shared, GENERALIZED pass: two facts that are the same
//     real claim but point at two different real annotation spans now merge
//     into one fact carrying both, not just two facts that happen to share
//     one exact span). See that function's own doc comment for the real
//     qiqirn-merchant case this generalization is for.
//   - Each (already-merged) MATCHED fact is then checked against every fact
//     ALREADY in that card's own
//     `source`/`sink` arrays (plus every fact newly appended earlier in this
//     SAME run) on a reduced "core identity" key (`event`/`to`/`from`/
//     `zone`/`subject`/`target`/`face`, deliberately excluding `value`/
//     `controller`/`annotations`/`provenance`; see `coreKey` below for the
//     full reasoning on why those specific fields are excluded). This is
//     real, not a formality: dry-run analysis against the whole pool found
//     `controller` alone is authored inconsistently across today's existing
//     hand-authored `entersBattlefield` facts (present on some, omitted on
//     others for the identical real claim), which would otherwise make this
//     script wrongly treat an already-authored fact as "missing" and append
//     a near-duplicate next to it.
//     - No `coreKey` match at all: genuinely new ground — appended as a
//       brand-new fact with `Fact.provenance: { origin: 'parser', rule:
//       <RecognizerId> }` baked in directly (see `synergy.ts`'s own
//       `Fact.provenance` doc comment) — `RecognizedFact`'s own
//       `{fact, provenance}` sibling shape (unchanged, still exactly what
//       `recognizers.test.ts` proves) is flattened into one on-disk object
//       here, at the one real point this project's "authoring vs. served
//       shape" boundary already lives (`compute-annotations.mjs` does the
//       equivalent flattening for `annotations`).
//     - A `coreKey` match against an existing fact (whether or not that
//       fact already carries `provenance` — 2026-09-14, see below): that
//       existing fact's own `value`/`annotations` are REPLACED with the
//       recognizer's own freshly-computed ones, and `provenance` is set to
//       the same bare `{ origin: 'parser', rule: <RecognizerId> }` shape a
//       brand-new fact gets — no distinction between "first time this
//       recognizer produces this claim" and "re-confirming a claim that
//       used to be hand-authored." `value` is deprecated pool-wide (not
//       consulted by anything downstream that matters) and a recognizer's
//       own `annotations` legitimately being broader/narrower than a
//       hand-authored span isn't a conflict either — `coreKey` itself is
//       what already guards against a genuine conflict (a different
//       `target`/`subject`/zone shape never matches in the first place), so
//       there is nothing left worth preserving from the original object once
//       its identity fields are confirmed to agree.
//       (2026-09-14, replacing the prior, more conservative behavior: a
//       match used to leave `value`/`annotations` byte-for-byte untouched
//       and only add a `Fact.provenance.note` explaining the fact "predates
//       the recognizer" — retired outright, not kept as an option, per an
//       explicit design decision that a `value` or `annotations` difference
//       is never itself a real conflict.)
//     - Genuinely idempotent regardless: re-running against a fact this
//       script already updated recomputes the identical `value`/
//       `annotations`/`provenance` and is counted as already-covered, not
//       re-touched (no console/`factsRetagged` bump, no file write).
//
// A card is skipped entirely (no write) when:
//   - it has no `synergy.json` at all (nothing to append to — this script
//     never originates a fresh synergy.json for an unauthored card, same
//     restraint `find-synergies.mjs`/`compute-annotations.mjs` already show).
//   - its existing `synergy.json` isn't v2-shaped yet (same `isV2Shaped`
//     gate `find-synergies.mjs`/`compute-annotations.mjs` already use — a
//     card mid-migration to the current fact model isn't a safe target).
//   - no real oracle text is found for its own Scryfall name (today: 20 real
//     cross-set reference cards with no `data/<set>/<set>_scryfall.json`
//     entry at all, e.g. Breeding Pool/Cavern of Souls/Craterhoof
//     Behemoth/Elrond, Moon-Reader — real Magic cards this pool references
//     for combos/tokens but that live outside the checked-in FIN corpus;
//     logged, not treated as an error).
//
// **Hard-fail on unresolved `kind:'mismatch'` declines (2026-09-13)** — a
// structural recognizer (`destroy-effect-structural`/`drawCard-effect-
// structural`) can decline for two genuinely different reasons (see
// `recognizers/types.ts`'s own `RecognizerResult.kind` doc comment):
// `'scope'` (no structural basis to even try — silent, permanent, unchanged
// behavior) vs `'mismatch'` (a pattern WAS built from the card's own
// structured data, but 0 or 2+ verbatim matches were found against the real
// oracle text — the recognizer's own model of "what this should read like"
// diverged from the card's real printed text). Every `kind:'mismatch'`
// decline hit across the WHOLE run is collected (never aborts mid-run — see
// `mismatches`/`suppressedMismatches` below) and, unless suppressed by a
// per-card exception marker, printed and hard-failed (non-zero exit) at the
// very end, so a real structural divergence can never again go silently
// swallowed the way EVERY decline used to (`if (!result.matched) continue;`,
// no distinction, no logging, prior to this pass).
//
// **Exception marker**: a plain comment directly in a card's own
// `definition.ts`, anywhere in the file (near the offending `Effect` object,
// by convention, though only presence anywhere in the file is actually
// checked) — `// recognizer-exception: <rule-id> — <short reason>` (the
// rule id must match one of `recognizers/types.ts`'s own `RecognizerId`
// values verbatim). Read via a cheap extra `readFile` of the same
// `definition.ts` path already resolved for the dynamic `import()` below —
// this script already needs raw source text nowhere else, so this is the
// one new read this feature needs. A card+rule pair with a matching marker
// is logged as a suppressed skip, not a hard failure.
//
// Usage: npx vite-node functional-model/scripts/apply-recognizers.mjs [<slug> ...]
//        (no args = whole pool)
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { recognizeInstantSorceryResolvesToGraveyard } from '../recognizers/instant-sorcery-resolves-to-graveyard.ts';
import { recognizePermanentEntersBattlefieldNormally } from '../recognizers/permanent-enters-battlefield-normally.ts';
import { recognizeDestroyEffectStructural } from '../recognizers/destroy-effect-structural.ts';
import { recognizeDrawCardEffectStructural } from '../recognizers/drawCard-effect-structural.ts';
import { recognizeSagaLoreAndSacrificeStructural } from '../recognizers/saga-lore-and-sacrifice-structural.ts';
import { recognizeDiesTriggerStructural } from '../recognizers/dies-trigger-structural.ts';
import { recognizeLifegainTriggerStructural } from '../recognizers/lifegain-trigger-structural.ts';
import { recognizeDealDamageEffectStructural } from '../recognizers/dealDamage-effect-structural.ts';
import { recognizePutCounterBroadcastStructural } from '../recognizers/putCounter-broadcast-structural.ts';
import { recognizeAttacksTriggerStructural } from '../recognizers/attacks-trigger-structural.ts';

const cardsDir = new URL('../cards/', import.meta.url);
const dataDir = new URL('../../data/', import.meta.url);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Does this card's own raw `definition.ts` SOURCE TEXT (not the imported
 * module — comments don't survive import) contain a
 * `// recognizer-exception: <ruleId>` marker for this exact rule? Presence
 * anywhere in the file is sufficient (see this script's own header) — no
 * requirement that it sit next to any particular line. */
function hasExceptionMarker(rawSource, ruleId) {
  const re = new RegExp(`recognizer-exception:\\s*${escapeRegExp(ruleId)}\\b`);
  return re.test(rawSource);
}

// Recognizers A/B only ever read a face's own printed `typeLine`/`oracleText`
// (the `RecognizerInput` shape below already covers them). Recognizers C/D
// additionally read that SAME face's own structured `effects`/`triggers`/
// `abilities` straight off its `CardDefinition` (or `.backFace`, for the back
// face) — see `destroy-effect-structural.ts`'s/`drawCard-effect-structural
// .ts`'s shared `StructuralRecognizerInput` (`structural-effects.ts`). Every
// recognizer here is called with the union of both inputs; A/B simply
// ignore the extra structural fields (same as they already ignore anything
// else on a wider object), so one shared per-face input object is enough —
// no separate wiring path needed for a text-only vs. structural recognizer.
// Each entry carries its own `id` (matching `recognizers/types.ts`'s
// `RecognizerId`) alongside the function — needed so a `kind:'mismatch'`
// decline can be attributed to a specific rule for the exception-marker
// check/hard-fail report above; not previously needed when every decline was
// silently swallowed the same way regardless of source.
const RECOGNIZERS = [
  { id: 'instant-sorcery-resolves-to-graveyard', recognize: recognizeInstantSorceryResolvesToGraveyard },
  { id: 'permanent-enters-battlefield-normally', recognize: recognizePermanentEntersBattlefieldNormally },
  { id: 'destroy-effect-structural', recognize: recognizeDestroyEffectStructural },
  { id: 'drawCard-effect-structural', recognize: recognizeDrawCardEffectStructural },
  { id: 'saga-lore-and-sacrifice-structural', recognize: recognizeSagaLoreAndSacrificeStructural },
  // 2026-09-13 follow-up — 4 more recognizers promoted into this real
  // pipeline the same pass (see each file's own module doc comment for its
  // real pool-wide check): the first two are plain TEXT recognizers (no
  // structural `Effect` reading at all, same family as Recognizers A/B
  // above); the last two are STRUCTURAL (read `effects`/`triggers`/
  // `abilities` off `StructuralRecognizerInput`, same family as
  // destroy/drawCard above) — `putCounter-broadcast-structural` additionally
  // EXECUTES a `kind:'custom'` effect's own closure against
  // `runtime-action-probe.ts`'s fake board (promoted out of prototype status
  // this same pass) before text-confirming its own classified output.
  { id: 'dies-trigger-structural', recognize: recognizeDiesTriggerStructural },
  { id: 'lifegain-trigger-structural', recognize: recognizeLifegainTriggerStructural },
  { id: 'dealDamage-effect-structural', recognize: recognizeDealDamageEffectStructural },
  { id: 'putCounter-broadcast-structural', recognize: recognizePutCounterBroadcastStructural },
  // 2026-09-14 follow-up (ENGINE_GAPS.md — attack-triggered-ability
  // auto-dispatch, `Trigger.on: 'attacks'`'s own real closure): plain TEXT
  // recognizer, same family as dies/lifegain above.
  { id: 'attacks-trigger-structural', recognize: recognizeAttacksTriggerStructural },
];

/** Same real-oracle-text-by-Scryfall-name loader `compute-annotations.mjs`
 * already established (front/back typeLine+oracleText+own-face-name, keyed
 * by the combined "Front // Back" name for a two-faced card) — duplicated
 * here (not imported) for the same reason `scenario-card-names.mjs`/
 * `annotation-coverage.mjs` each keep their own small `.mjs`-side copy of
 * this kind of loader rather than sharing one module: these are plain
 * `node:fs`-touching scripts, not part of the TS build graph, and this
 * project's own established convention is a small stable duplicate over a
 * new shared module for this narrow a piece of logic. */
async function loadOracleTextByName() {
  const byName = new Map();
  const setDirs = await readdir(dataDir, { withFileTypes: true }).catch(() => []);
  for (const dirent of setDirs) {
    if (!dirent.isDirectory()) continue;
    const setDir = new URL(`${dirent.name}/`, dataDir);
    const files = await readdir(setDir, { withFileTypes: true }).catch(() => []);
    for (const file of files) {
      if (!file.isFile()) continue;
      if (!file.name.endsWith('_scryfall.json') || file.name.endsWith('_tokens_scryfall.json')) continue;
      const raw = await readFile(new URL(file.name, setDir), 'utf8').catch(() => null);
      if (!raw) continue;
      let cards;
      try {
        cards = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        if (typeof card?.name !== 'string') continue;
        if (Array.isArray(card.card_faces) && card.card_faces.length > 0) {
          byName.set(card.name, {
            front: { typeLine: card.card_faces[0]?.type_line ?? '', oracleText: card.card_faces[0]?.oracle_text ?? '' },
            back: card.card_faces[1] ? { typeLine: card.card_faces[1]?.type_line ?? '', oracleText: card.card_faces[1]?.oracle_text ?? '' } : undefined,
          });
        } else {
          byName.set(card.name, { front: { typeLine: card.type_line ?? '', oracleText: card.oracle_text ?? '' } });
        }
      }
    }
  }
  return byName;
}

function isV2Shaped(synergy) {
  const all = [...(synergy.source ?? []), ...(synergy.sink ?? [])];
  return all.length > 0 && all.every((f) => typeof f === 'object' && f !== null && ('zone' in f || 'to' in f || 'from' in f || 'event' in f));
}

/** Reduced "is this the same real claim" key — deliberately excludes:
 *   - `value` — a recognizer always bakes in the real `1` (see each
 *     recognizer file's own doc comment on why there's nothing
 *     trace-dependent to defer for these two specific fact shapes); some
 *     existing hand-authored facts still carry the older `-1`
 *     "pending compute-weights.mjs" placeholder for the identical real
 *     claim, which should still count as "already covered," not "missing" —
 *     and, on a `coreKey` match, gets overwritten with the recognizer's own
 *     value anyway (2026-09-14: `value` is deprecated pool-wide, a mismatch
 *     here is never treated as a real conflict — see the main retag loop
 *     below).
 *   - `controller` — real, confirmed pool inconsistency (see this script's
 *     own header): some existing `entersBattlefield` facts declare
 *     `controller: 'you'`, others (Zack Fair among them) omit it for the
 *     identical real claim (a self-subject fact has only one real
 *     controller anyway). Comparing on it would make this script wrongly
 *     treat an already-authored fact as new.
 *   - `annotations`/`provenance` — metadata ABOUT the fact, never part of
 *     what the fact actually claims (two facts asserting the same real
 *     thing are the same fact even if one has richer/different provenance
 *     metadata than the other).
 *   - `targeted` — purely descriptive per `synergy.ts`'s own doc comment,
 *     never part of a fact's core identity for any other purpose in this
 *     codebase either.
 *
 * **`subject` normalization for self-referencing facts (2026-09-13, real bug
 * fix)** — `synergy.ts`'s own doc comment on its 2026-09-11 merge notes that
 * a fully-shaped self-referencing fact carries BOTH `subject:'self'` AND
 * `target:'self'`, but plenty of real hand-authored facts predate that
 * convention and carry `target:'self'` alone, no `subject` key at all. Since
 * this function only adds a key to `reduced` `if (k in fact)`, those two
 * shapes previously produced DIFFERENT JSON keys (one object literally has a
 * `subject` property, the other doesn't) even though they assert the
 * IDENTICAL real claim — `permanent-enters-battlefield-normally`'s own
 * recognizer-produced fact (which DOES carry `subject:'self'`) would then
 * never dedup-match the legacy fact, and got appended as a visible duplicate
 * instead of retagging it in place (confirmed: 12 real pool cards, e.g.
 * `summon-bahamut`/fin-1 showing two "Enters the battlefield" Fact rows).
 * Fixed here by normalizing `subject` OUT of the reduced key whenever
 * `target === 'self'` and `subject` is either absent or already `'self'` —
 * deliberately narrow: a NON-default `subject` (a `{token: ...}` reference,
 * a different real entity entering/being cast) is a genuinely different real
 * claim and must keep distinguishing facts apart, so this only ever
 * collapses the `'self'`-vs-absent case, never any other. See
 * `mergeDuplicateFacts` below for the one-time cleanup this fix needed for
 * data already written to disk by the pre-fix buggy behavior.
 *
 * **`to`/`from` normalization for `event:'dies'` facts (2026-09-13,
 * `destroy-effect-structural.ts`'s own companion-`dies`-fact follow-up)** —
 * the SAME class of fix as the `subject` normalization above, for a
 * different real inconsistency this pass's own pool-wide run surfaced: CR
 * 700.4 makes a `dies` event's zone movement an invariant, ALWAYS
 * `from:'Battlefield'`/`to:'Graveyard'` whenever either is present at all
 * (confirmed: grepped every real `event:'dies'` fact pool-wide — 102 total,
 * 24 already carry this exact `to`/`from` pair, 0 carry any other value) —
 * so a bare bare `{event:'dies', target:...}` fact (78 real, still-
 * unmigrated pool occurrences — e.g. `lunatic-pandora`/`sephiroth-s-
 * intervention`/`sidequest-hunt-the-mark`'s own pre-existing hand-authored
 * `dies` facts) is the IDENTICAL real claim as the fully-qualified shape
 * this recognizer always emits, just missing fields that were always going
 * to be the same pair anyway. Without this, those 3 (and any other
 * still-bare) cards would get a near-duplicate SECOND `dies` fact appended
 * instead of retagging the existing one — confirmed via a real pool check
 * before adding this, not assumed. Scoped to exactly `event === 'dies'`
 * (every OTHER zone-shaped event — `entersBattlefield`, a bounce, a tutor —
 * genuinely has more than one real `(from,to)` pair across the pool, so
 * dropping `to`/`from` there would be a real, different, NOT-yet-checked
 * change; not attempted here).
 */
function coreKey(fact, { normalizeSelfSubject = true } = {}) {
  const keys = ['event', 'to', 'from', 'zone', 'subject', 'target', 'face'];
  const reduced = {};
  for (const k of keys) if (k in fact) reduced[k] = fact[k];
  if (normalizeSelfSubject && reduced.target === 'self' && (reduced.subject === 'self' || reduced.subject === undefined)) {
    delete reduced.subject;
  }
  if (reduced.event === 'dies' && (reduced.to === undefined || reduced.to === 'Graveyard') && (reduced.from === undefined || reduced.from === 'Battlefield')) {
    delete reduced.to;
    delete reduced.from;
  }
  return JSON.stringify(reduced, Object.keys(reduced).sort());
}

/**
 * Runner-level generalization of what THREE structural recognizers
 * (`destroy-effect-structural.ts`/`drawCard-effect-structural.ts`/`saga-lore-
 * and-sacrifice-structural.ts`) each used to do INLINE, independently, via
 * their own bespoke per-face `seen` Set — moved here (2026-09-13 follow-up
 * pass) per the user's own framing: "if we get 2 absolutely identical facts,
 * we can group annotations and consider them 1 fact... move grouping from
 * recognizer level to recognizer runner level." Two real changes versus the
 * old per-recognizer behavior, not just a relocation:
 *   - ONE shared implementation instead of three near-identical copies (the
 *     third, `saga-lore-and-sacrifice-structural.ts`, never actually needed
 *     its own dedup — it can't structurally produce a same-face duplicate at
 *     all — but the other two's own copies are gone now regardless, both
 *     recognizers simplified to just return every matched fact naturally).
 *   - GENERALIZED from "exact full-fact match" (the old per-recognizer `seen`
 *     key was `JSON.stringify(fact)`, `annotations` included — two facts only
 *     ever collapsed when they shared the exact SAME single annotation span)
 *     to "same fact identity, different annotation → merge annotations into
 *     one fact." Real motivating case: `qiqirn-merchant`'s two genuinely
 *     separate activated abilities (`cantrip`'s bare "draw a card",
 *     `bigDraw`'s literal "draw three cards") both produce the identical
 *     `drawCard-effect-structural` fact SHAPE (that recognizer's own fixed
 *     `value: 1` regardless of literal draw count — see its own module doc
 *     comment) at two DIFFERENT real annotation spans — the old per-
 *     recognizer dedup correctly left these as two separate facts (their
 *     `JSON.stringify` differed, on `annotations`), but that's no longer the
 *     desired outcome: a Fact describes a card's real CAPABILITY, not how
 *     many separate abilities happen to produce it, so this pass now merges
 *     them into ONE fact carrying BOTH annotations.
 *
 * Identity for grouping is the SAME reduced `coreKey(fact)` this file's own
 * dedup-against-hand-authored-facts pass already uses (deliberately reused,
 * not a third slightly-different notion invented for this pass alone — see
 * `coreKey`'s own doc comment for exactly which fields that excludes and
 * why, e.g. `value`/`controller`; every real recognizer in this catalog
 * always bakes a fixed `value`/`controller` for a given rule+shape anyway,
 * so this exclusion loses no real information in practice today), scoped to
 * one face's own combined raw output across every recognizer that ran
 * against it (never across recognizers is it re-scoped to just one — the
 * task this pass exists for is explicitly a runner-level, not per-recognizer,
 * concern) plus `role` (kept separate from `coreKey`'s own field list since
 * every recognizer here bundles `role` alongside its `fact`, not inside it —
 * see `RecognizedFact`'s own shape in `recognizers/types.ts`).
 *
 * Any group with more than one member merges into ONE fact: the FIRST
 * member's own non-annotation fields survive byte-for-byte, `annotations`
 * becomes the UNION of every member's own `annotations` entries in original
 * encounter order, de-duplicating any two literally-identical annotation
 * refs within that union (a plain `{target,line?,start,end}` object — cheap
 * to compare via `JSON.stringify`).
 */
function mergeRecognizedFactsByIdentity(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.role}::${coreKey(entry.fact)}`;
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }
  const merged = [];
  let mergedAnnotationCount = 0;
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    const survivorFact = { ...group[0].fact };
    const seenAnnotation = new Set();
    const unionAnnotations = [];
    for (const entry of group) {
      for (const ann of entry.fact.annotations ?? []) {
        const annKey = JSON.stringify(ann);
        if (seenAnnotation.has(annKey)) continue;
        seenAnnotation.add(annKey);
        unionAnnotations.push(ann);
      }
    }
    survivorFact.annotations = unionAnnotations;
    merged.push({ role: group[0].role, fact: survivorFact });
    mergedAnnotationCount += group.length - 1;
  }
  return { merged, mergedAnnotationCount };
}

/**
 * Self-heals the specific real duplicate-fact shape the `coreKey` subject-
 * normalization fix above was needed for — see that function's own doc
 * comment. Runs unconditionally, on every invocation, over a card's own
 * `source` array ONLY (never `sink` — a prior whole-pool grep for any two
 * existing facts sharing an identical `coreKey` found 79 dup-key groups, all
 * but a few of which are LEGITIMATELY-distinct `zone:'Battlefield'`-shaped
 * SINK facts no recognizer here has ever produced; blindly merging same-
 * `coreKey` SINK facts would silently destroy real, distinct data this fix
 * has no business touching).
 *
 * Deliberately conservative about WHICH groups it merges, not just "any two
 * facts sharing a coreKey" — TWO gates, both required:
 *
 *   1. **The group must be one the subject-normalization fix itself actually
 *      CREATED.** Computed via `coreKey(f, { normalizeSelfSubject: false })`
 *      (the PRE-fix key shape) alongside the normal (post-fix) key: if every
 *      member of a same-new-key group ALSO already shared an identical
 *      PRE-fix key, this group's collision predates this fix entirely and is
 *      NOT this pass's concern — a different, already-known ambiguity the
 *      main recognizer loop's own `candidates.length > 1` +
 *      exact-`annotations`-match logic already owns (see that loop's own
 *      comment; `qiqirn-merchant`'s 2 genuinely-different `drawCard` facts
 *      and `matoya-archon-elder`'s real-clause-vs-reminder-text `drawCard`
 *      pair are the confirmed real examples). A first, broader version of
 *      this function (no old-key gate) WRONGLY merged
 *      `matoya-archon-elder`'s reminder-text fact into its real one —
 *      caught via a direct before/after diff, reverted, this gate added
 *      specifically because of that real near-miss.
 *   2. **Shape check**: of the members that DO differ pre-fix, the group
 *      must reduce to exactly one fact with NO `provenance` (the original
 *      hand-authored fact) plus one or more that DO already carry
 *      `provenance` (a recognizer-appended duplicate from a run before this
 *      fix existed) — the exact, confirmed shape of the real bug (every one
 *      of the 12 real affected cards fit this precisely when checked
 *      directly). A group that clears gate 1 but not this one is left
 *      untouched and logged, not silently collapsed — merging facts nobody
 *      has confirmed are really the same claim would be exactly the kind of
 *      guess this whole recognizer catalog is built to avoid.
 */
function mergeDuplicateFacts(facts, slug) {
  const groups = new Map();
  for (const f of facts) {
    const key = `${f.face ?? 'front'}::${coreKey(f)}`;
    const list = groups.get(key);
    if (list) list.push(f);
    else groups.set(key, [f]);
  }
  const merged = [];
  let mergedCount = 0;
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    const preFixKeys = new Set(group.map((f) => coreKey(f, { normalizeSelfSubject: false })));
    if (preFixKeys.size < 2) {
      // This collision already existed before the subject-normalization fix
      // — out of scope for this pass (gate 1 above); leave every member
      // exactly as-is, no log spam for a pre-existing, already-handled-
      // elsewhere ambiguity.
      merged.push(...group);
      continue;
    }
    const unprovenanced = group.filter((f) => !f.provenance);
    const provenanced = group.filter((f) => f.provenance);
    if (unprovenanced.length !== 1 || provenanced.length === 0) {
      // Doesn't match the confirmed bug shape — leave every member alone and
      // flag for a human, rather than guessing which (if any) are real
      // duplicates.
      console.log(
        `${slug}: NOTE — ${group.length} facts collapse to one coreKey only after the subject-normalization fix, but don't match the known duplicate-bug shape (${unprovenanced.length} unprovenanced, ${provenanced.length} provenanced); left untouched, not auto-merged`,
      );
      merged.push(...group);
      continue;
    }
    // Survivor is the ORIGINAL hand-authored fact object (kept so any other
    // untouched field/reference stays put), but its `value`/`annotations`/
    // `provenance` are all taken from the donor — the donor's own fields ARE
    // the recognizer's freshly-computed output (it was appended fresh, on a
    // prior run, straight from a `RecognizedFact`), so this is the same
    // "coreKey match replaces value/annotations, bare provenance" rule the
    // main retag loop below now uniformly applies, not a special case.
    const survivor = unprovenanced[0];
    const donor = provenanced[0];
    survivor.value = donor.value;
    survivor.annotations = donor.annotations;
    survivor.provenance = { origin: donor.provenance.origin, rule: donor.provenance.rule };
    merged.push(survivor);
    mergedCount += group.length - 1;
  }
  return { merged, mergedCount };
}

/**
 * A second, narrower existing-facts self-heal (2026-09-13, same follow-up
 * pass that adds `mergeRecognizedFactsByIdentity` above) — closes the one
 * real gap that pass, on its own, can't reach: a card whose own
 * `source`/`sink` array ALREADY carries two-or-more facts that a PRIOR run
 * of this same script already retagged, individually, with the SAME
 * recognizer `rule` (i.e., before this pass's own annotation-merging
 * existed to catch them at the point of recognition). `mergeRecognizedFactsByIdentity`
 * only ever groups a FRESH run's own recognizer output before it's compared
 * against what's on disk — by design (a fresh run's own incoming merged
 * fact, now carrying more than one annotation, correctly does NOT
 * retag-match either of two existing single-annotation facts one at a time,
 * see the main retag loop's own comment) — so an already-retagged pool
 * needs this one additional, explicit pass to reach the same converged
 * state a from-scratch run would now produce directly.
 *
 * Deliberately narrow, same discipline `mergeDuplicateFacts` above already
 * establishes for its own, differently-shaped bug: a group only merges when
 * EVERY member already carries `provenance` AND every member's
 * `provenance.rule` is the exact SAME string — a group with even one
 * unprovenanced member, or members attributed to different rules, is left
 * completely untouched. This is what already keeps `matoya-archon-elder`'s
 * own real near-miss safe here too: its 2 existing `event:'drawCard'` facts
 * share a `coreKey`, but only ONE of them was ever retagged by
 * `drawCard-effect-structural` — the other (its own reminder-text
 * parenthetical) has NO `provenance` at all, so this group fails the
 * "every member provenanced" gate and is correctly left as 2 separate facts.
 * `qiqirn-merchant`'s own 2 existing `drawCard` facts, by contrast, were
 * BOTH already retagged `drawCard-effect-structural` in a prior run — this
 * pass merges them into ONE, annotations unioned, matching exactly what
 * `mergeRecognizedFactsByIdentity` would have produced for an unauthored
 * card hitting the identical real shape from scratch.
 *
 * Scoped to `source` only, same restraint `mergeDuplicateFacts` already
 * applies to `sink` for the same reason (no recognizer in this catalog has
 * ever produced a `role: 'sink'` fact, so this gate would almost never
 * legitimately fire there anyway — kept consistent with the established
 * precedent rather than assumed safe on a wider scope than it's been
 * checked against).
 */
function mergeSameRuleExistingFacts(facts, slug) {
  const groups = new Map();
  for (const f of facts) {
    const key = coreKey(f);
    const list = groups.get(key);
    if (list) list.push(f);
    else groups.set(key, [f]);
  }
  const merged = [];
  let mergedCount = 0;
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    const rules = new Set(group.map((f) => f.provenance?.rule));
    if (group.some((f) => !f.provenance) || rules.size !== 1) {
      // Doesn't match the confirmed "all independently reconciled by the
      // identical rule" shape — leave every member alone (this is the
      // matoya-archon-elder-style guard; not logged as a NOTE the way
      // `mergeDuplicateFacts` does for its own unmatched shape, since this
      // is the overwhelmingly common case — most same-coreKey groups in the
      // pool are legitimately-distinct facts with no provenance at all).
      merged.push(...group);
      continue;
    }
    const rule = [...rules][0];
    const survivor = { ...group[0] };
    const seenAnnotation = new Set();
    const unionAnnotations = [];
    for (const f of group) {
      for (const ann of f.annotations ?? []) {
        const annKey = JSON.stringify(ann);
        if (seenAnnotation.has(annKey)) continue;
        seenAnnotation.add(annKey);
        unionAnnotations.push(ann);
      }
    }
    survivor.annotations = unionAnnotations;
    merged.push(survivor);
    mergedCount += group.length - 1;
    console.log(`${slug}: merged ${group.length} existing facts (all already retagged '${rule}') sharing one coreKey into one fact, annotations unioned`);
  }
  return { merged, mergedCount };
}

async function main() {
  const requested = process.argv.slice(2);
  const allSlugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  const slugs = requested.length > 0 ? requested : allSlugs;
  const oracleByName = await loadOracleTextByName();

  let written = 0;
  let factsAdded = 0;
  let factsAlreadyPresent = 0;
  let factsRetagged = 0;
  let factsMerged = 0;
  // NEW counters (2026-09-13 follow-up) — three now-distinct merge tallies:
  //   - `factsMerged` (above): `mergeDuplicateFacts`'s own narrow
  //     existing-on-disk self-heal (the subject-normalization bug).
  //   - `factsMergedSameRule`: `mergeSameRuleExistingFacts`'s own narrow
  //     existing-on-disk self-heal (2+ facts already retagged by the
  //     identical rule, e.g. `qiqirn-merchant`).
  //   - `recognizerAnnotationsMerged`: `mergeRecognizedFactsByIdentity`'s own
  //     runner-level pass over each face's FRESH recognizer output this same
  //     run (annotations unioned into one fact before comparing against
  //     what's on disk — never touches anything already on disk itself).
  let factsMergedSameRule = 0;
  let recognizerAnnotationsMerged = 0;
  const retaggedByRule = {};
  let skippedNoSynergy = 0;
  let skippedNotV2 = 0;
  let skippedNoOracle = 0;
  // Collected across the WHOLE run (never aborts mid-run — see this script's
  // own header) — printed and hard-failed on at the very end, unless
  // suppressed by a matching `// recognizer-exception:` marker.
  const mismatches = [];
  const suppressedMismatches = [];

  for (const slug of slugs) {
    const synergyUrl = new URL(`${slug}/synergy.json`, cardsDir);
    let raw;
    try {
      raw = JSON.parse(await readFile(synergyUrl, 'utf8'));
    } catch {
      skippedNoSynergy++;
      continue;
    }
    if (!isV2Shaped(raw)) {
      skippedNotV2++;
      continue;
    }

    const definitionUrl = new URL(`${slug}/definition.ts`, cardsDir);
    let card;
    try {
      const mod = await import(definitionUrl.href);
      card = Object.values(mod)[0];
    } catch {
      continue;
    }
    if (!card?.name) continue;

    // Raw SOURCE TEXT (not the imported module — comments don't survive
    // import) of this card's own definition.ts, for the `// recognizer-
    // exception: <rule>` marker check below (see this script's own header).
    const rawDefinitionSource = await readFile(definitionUrl, 'utf8').catch(() => '');

    // Same two-faced "combined name" reconstruction `compute-annotations
    // .mjs` already established — see that script's own comment for why.
    const lookupName = card.backFace?.name ? `${card.name} // ${card.backFace.name}` : card.name;
    const oracle = oracleByName.get(lookupName);
    if (!oracle) {
      skippedNoOracle++;
      console.log(`skip ${slug}: no real oracle text found for "${lookupName}" in data/*/*_scryfall.json`);
      continue;
    }

    const faces = [
      {
        face: card.backFace ? 'front' : undefined,
        name: card.name,
        typeLine: card.typeLine,
        oracleText: oracle.front?.oracleText ?? '',
        effects: card.effects,
        triggers: card.triggers,
        abilities: card.abilities,
      },
    ];
    if (card.backFace) {
      faces.push({
        face: 'back',
        name: card.backFace.name,
        typeLine: card.backFace.typeLine,
        oracleText: oracle.back?.oracleText ?? '',
        effects: card.backFace.effects,
        triggers: card.backFace.triggers,
        abilities: card.backFace.abilities,
      });
    }

    // Self-heal any pre-existing same-face duplicate `source` facts the
    // pre-fix `coreKey` bug already wrote to disk (see `mergeDuplicateFacts`'s
    // own doc comment) — BEFORE building `existingByKey` below, so the
    // recognizer loop's own dedup/retag logic always sees the merged,
    // post-fix state as its baseline. Runs every time, not just once — a
    // no-op (0 merges) once the pool is clean, confirmed idempotent.
    const { merged: existingSourceStep1, mergedCount: mergedCountBug } = mergeDuplicateFacts(raw.source ?? [], slug);
    // Second self-heal, chained on the first's output (see
    // `mergeSameRuleExistingFacts`'s own doc comment) — closes the one real
    // gap `mergeRecognizedFactsByIdentity` can't reach on its own: a card
    // whose own `source` array already carries 2+ facts a PRIOR run already
    // retagged individually with the identical recognizer rule (the exact
    // `qiqirn-merchant` shape). Also runs every time, also idempotent (0
    // merges once nothing on disk still needs it).
    const { merged: existingSource, mergedCount: mergedCountSameRule } = mergeSameRuleExistingFacts(existingSourceStep1, slug);
    const existingSink = raw.sink ?? [];
    const mergedCount = mergedCountBug + mergedCountSameRule;
    factsMerged += mergedCountBug;
    factsMergedSameRule += mergedCountSameRule;
    // Map of coreKey -> Fact[] (not Fact, not a bare Set) — TWO real reasons:
    //   (1) a `coreKey` MATCH against an existing fact needs the real object
    //       reference so a dedup match can retag it in place (see this
    //       script's own header, "A `coreKey` match against an existing
    //       fact that has NO `provenance` yet").
    //   (2) **(2026-09-13, drawCard-effect-structural wiring) more than one
    //       existing fact can share an identical `coreKey`** — checked the
    //       whole real pool for this (79 dup-key groups found; almost all
    //       are bare `zone:'Battlefield'`-shaped SINK facts no recognizer
    //       here ever produces, so they were never actually at risk) but
    //       `qiqirn-merchant` is a real, concrete SOURCE-side hit this
    //       recognizer surfaces: its own `cantrip` ability ("Draw a card,
    //       then discard a card") and its own `bigDraw` ability ("Draw
    //       three cards") are two GENUINELY DIFFERENT real facts (different
    //       `annotations`, deliberately excluded from `coreKey` — see this
    //       function's own doc comment) that happen to reduce to the exact
    //       same bare `{"event":"drawCard"}` key. A single-value Map would
    //       silently let the second one's own lookup find the FIRST one
    //       already retagged by the first, and skip it as "already
    //       covered" — permanently leaving the second real fact
    //       unprovenanced. Storing an ARRAY per key and (see below, right
    //       where a match is picked) requiring an EXACT `annotations` match
    //       whenever more than one candidate shares a key correctly retags
    //       BOTH of qiqirn-merchant's real facts, one per recognized
    //       instance — while correctly, stably declining to guess for
    //       `matoya-archon-elder`'s own coincidental collision (2 existing
    //       `drawCard` facts sharing this bare key that are NOT the same
    //       real claim — one anchored to the real "draw a card" clause, one
    //       to this card's own reminder-text parenthesis — where only the
    //       first is ever independently re-derived by this recognizer).
    // Seeded from both arrays up front, then grown with every newly-
    // appended fact this same run (identical to the old Set's "dedupe
    // within this same run too" behavior) so a later face/recognizer
    // hitting the same claim sees it as already covered either way.
    // **Keyed by `role::coreKey`, not bare `coreKey` (2026-09-13, real bug
    // fix surfaced by this pass's own `dies`-event `to`/`from` normalization
    // above)** — a bare-`coreKey` map lets a SOURCE fact and a SINK fact
    // collide under the identical reduced key whenever `coreKey` doesn't
    // itself carry enough fields to tell them apart (concretely: any
    // `event:'dies'` pair sharing the same `target` — Aerith Gainsborough's
    // own real source-consequence + sink-precondition dies facts, a common,
    // expected shape for ANY "onDies" trigger with a self-referential
    // precondition, not a one-off — collided this way the moment `to`/`from`
    // were normalized out of `coreKey` for `dies` events, since neither role
    // has any OTHER field left to distinguish them). Once that happens, the
    // stricter "2+ candidates need an exact annotation match" branch below
    // can silently fail BOTH real facts at once: this recognizer's own
    // computed span (built by regex, "When Aerith Gainsborough dies") is a
    // few characters wider than the ORIGINAL hand-authored span (just
    // "Aerith Gainsborough dies," no leading "When ") for BOTH the source
    // and sink candidate, so neither ever exact-matches, and — since
    // `candidates.length > 0` — both get silently counted as
    // "already covered" instead of retagged OR appended fresh. Confirmed via
    // a real before/after run on this exact card before this fix. Role was
    // never part of `coreKey` itself (recognizers/`mergeRecognizedFactsByIdentity`
    // already prefix it separately, same convention followed here) since a
    // SOURCE and a SINK fact are always genuinely different real claims
    // (one asserts an occurrence, the other a want) — this fixes a latent
    // gap in matching, not a new restriction.
    const existingByKey = new Map();
    for (const f of existingSource) {
      const key = `source::${coreKey(f)}`;
      const list = existingByKey.get(key);
      if (list) list.push(f);
      else existingByKey.set(key, [f]);
    }
    for (const f of existingSink) {
      const key = `sink::${coreKey(f)}`;
      const list = existingByKey.get(key);
      if (list) list.push(f);
      else existingByKey.set(key, [f]);
    }

    let retaggedThisCard = 0;
    let recognizerAnnotationsMergedThisCard = 0;
    const toAppend = { source: [], sink: [] };
    for (const face of faces) {
      const input = {
        name: face.name,
        typeLine: face.typeLine,
        oracleText: face.oracleText,
        effects: face.effects,
        triggers: face.triggers,
        abilities: face.abilities,
        // See `recognizers/types.ts`'s own `RecognizerInput.isBackFace` doc
        // comment: only `permanent-enters-battlefield-normally` currently
        // reads this — every other recognizer here ignores it, same as they
        // already ignore any other field on this wider shared input object.
        isBackFace: face.face === 'back',
      };
      // Every recognizer's own raw verdict against THIS face, collected
      // before any dedup/retag decision — each structural recognizer used to
      // dedup its own per-face output inline (an identical-full-fact `seen`
      // Set); that's gone now (see each recognizer file's own updated module
      // doc comment), so a face with a genuinely repeated structural clause
      // (or, new as of this pass, the SAME real claim at two DIFFERENT real
      // annotation spans) now surfaces here naturally, for
      // `mergeRecognizedFactsByIdentity` below to resolve generically instead
      // of three near-identical bespoke copies.
      const rawFactsForFace = [];
      for (const { id: ruleId, recognize } of RECOGNIZERS) {
        const result = recognize(input);
        if (!result.matched) {
          const kind = result.kind ?? 'scope';
          if (kind === 'mismatch') {
            const entry = { slug, rule: ruleId, face: face.face ?? 'front', reason: result.reason };
            if (hasExceptionMarker(rawDefinitionSource, ruleId)) {
              suppressedMismatches.push(entry);
            } else {
              mismatches.push(entry);
            }
          }
          continue;
        }
        for (const rf of result.facts) {
          const fact = { ...rf.fact };
          if (face.face) fact.face = face.face;
          fact.provenance = rf.provenance;
          rawFactsForFace.push({ role: rf.role, fact });
        }
      }

      // NEW runner-level pass (2026-09-13 follow-up) — group THIS face's own
      // combined raw recognizer output by identity and merge any group of
      // more than one into a single fact carrying every member's own
      // `annotations` (union, deduped) — see `mergeRecognizedFactsByIdentity`'s
      // own doc comment. Deliberately BEFORE the existing
      // dedup-against-hand-authored-facts loop below (group-then-compare):
      // that loop's own `coreKey`/`existingByKey`/retag logic is unchanged,
      // it now simply receives already-merged candidates instead of raw,
      // possibly-duplicate ones.
      const { merged: mergedFactsForFace, mergedAnnotationCount } = mergeRecognizedFactsByIdentity(rawFactsForFace);
      recognizerAnnotationsMerged += mergedAnnotationCount;
      recognizerAnnotationsMergedThisCard += mergedAnnotationCount;

      for (const { role, fact } of mergedFactsForFace) {
        const key = `${role}::${coreKey(fact)}`;
        const candidates = existingByKey.get(key);
        // Which candidate (if any) this recognized fact retags — see this
        // script's own header on why >1 candidate can share one bare
        // `coreKey`. Two real, different shapes once that can happen:
        //   - Exactly ONE candidate (the overwhelmingly common case): always
        //     matches it, regardless of whether it already carries
        //     `provenance` (2026-09-14 — see below) or whether its own
        //     `annotations` happen to agree with this recognized fact's own
        //     (an existing fact's hand-authored annotation legitimately CAN
        //     differ from what a recognizer independently computes for the
        //     same real claim — `coreKey` already deliberately excludes
        //     `annotations` for exactly this reason, and a difference there
        //     is no longer treated as a conflict at all, see below).
        //   - More than one candidate: do NOT extend that same tolerance —
        //     require an EXACT `annotations` match to pick which specific
        //     candidate this recognized instance corresponds to. Real,
        //     necessary distinction found via `matoya-archon-elder`: its 2
        //     existing `event:'drawCard'` facts share one bare coreKey, but
        //     are genuinely DIFFERENT real facts — one anchored to the
        //     real "draw a card" clause, one anchored to the card's own
        //     reminder-text parenthetical ("(Draw after you scry or
        //     surveil.)") — while this recognizer only ever independently
        //     re-derives the FIRST. A "first candidate wins" policy (tried
        //     and reverted) would retag the SECOND (reminder-text) fact as
        //     "confirmed by drawCard-effect-structural" — genuinely wrong
        //     (this recognizer never matched that span at all). Requiring an
        //     annotation match when candidates.length > 1 means the
        //     reminder-text fact is correctly, stably, left alone forever
        //     (this recognizer never produces a fact whose annotation equals
        //     its span) — unaffected by no longer also requiring
        //     `!f.provenance` here (2026-09-14): once a real candidate has
        //     been matched/updated by a prior run, its own `annotations` are
        //     already the recognizer's own deterministic output, so the
        //     exact-match re-finds the SAME real candidate every subsequent
        //     run, not a different one. **2026-09-13 follow-up**: the
        //     incoming `fact` here may now itself be a MERGED fact (see
        //     `mergeRecognizedFactsByIdentity` above) carrying more than one
        //     annotation — e.g. qiqirn-merchant's own two draw abilities are
        //     now ONE incoming fact with both spans unioned. An exact
        //     `JSON.stringify` array-equality check against a single-
        //     annotation EXISTING candidate then correctly finds no match
        //     (an existing fact from before this pass still carries only
        //     ONE of the two spans) — this is expected, not a regression:
        //     see this script's own header + `mergeRecognizedFactsByIdentity`'s
        //     doc comment for why a genuinely pre-existing multi-fact split
        //     for the identical real claim is a separate, one-time on-disk
        //     cleanup, not something this per-run retag loop re-derives.
        let existingFact;
        if (candidates?.length === 1) {
          existingFact = candidates[0];
        } else if (candidates && candidates.length > 1) {
          const factAnnotationsJSON = JSON.stringify(fact.annotations);
          existingFact = candidates.find((f) => JSON.stringify(f.annotations) === factAnnotationsJSON);
        }
        if (existingFact) {
          // `coreKey` matched — replace `value`/`annotations` with the
          // recognizer's own freshly-computed ones and set a bare
          // `provenance` (2026-09-14: no distinction anymore between "first
          // time this recognizer produces this claim" and "re-confirming a
          // fact that used to be hand-authored" — see this script's own
          // header). A no-op (not counted as a retag, no write) when the
          // existing fact already has this exact `value`/`annotations`/
          // bare `provenance` — keeps this idempotent and keeps the run
          // stats meaningful (a re-run reports 0 further retags).
          const sameValue = existingFact.value === fact.value;
          const sameAnnotations = JSON.stringify(existingFact.annotations) === JSON.stringify(fact.annotations);
          const sameProvenance =
            existingFact.provenance?.origin === fact.provenance.origin &&
            existingFact.provenance?.rule === fact.provenance.rule &&
            existingFact.provenance?.note === undefined;
          if (sameValue && sameAnnotations && sameProvenance) {
            factsAlreadyPresent++;
            continue;
          }
          existingFact.value = fact.value;
          existingFact.annotations = fact.annotations;
          existingFact.provenance = { origin: fact.provenance.origin, rule: fact.provenance.rule };
          retaggedByRule[fact.provenance.rule] = (retaggedByRule[fact.provenance.rule] ?? 0) + 1;
          factsRetagged++;
          retaggedThisCard++;
          continue;
        }
        if (candidates && candidates.length > 0) {
          // No candidate matched by the disambiguation rule above (the
          // multi-candidate, exact-annotation-match branch) — genuinely
          // nothing new to say for this recognized instance.
          factsAlreadyPresent++;
          continue;
        }
        // `candidates` is guaranteed falsy here (both branches above
        // `continue` whenever it isn't) — a fresh key, never seen before.
        existingByKey.set(key, [fact]); // dedupe within this same run too (e.g. identical front/back claims)
        toAppend[role].push(fact);
        factsAdded++;
      }
    }

    if (toAppend.source.length === 0 && toAppend.sink.length === 0 && retaggedThisCard === 0 && mergedCount === 0) continue;

    // `existingSource`/`existingSink` are the SAME object references any
    // in-place retag (or duplicate-merge) above mutated directly, so
    // spreading them here already carries those mutations through to disk —
    // no separate write path needed for "retagged/merged only, nothing newly
    // appended" cards.
    const out = {
      source: [...existingSource, ...toAppend.source],
      sink: [...existingSink, ...toAppend.sink],
    };
    await writeFile(synergyUrl, JSON.stringify(out, null, 2) + '\n', 'utf8');
    written++;
    const retagNote = retaggedThisCard > 0 ? `, retagged ${retaggedThisCard} existing fact(s)` : '';
    const mergeNote = mergedCount > 0 ? `, merged ${mergedCount} duplicate fact(s)` : '';
    const recognizerMergeNote =
      recognizerAnnotationsMergedThisCard > 0
        ? `, merged ${recognizerAnnotationsMergedThisCard} freshly-recognized duplicate fact(s) by identity (annotations unioned)`
        : '';
    console.log(`${slug}: +${toAppend.source.length} source, +${toAppend.sink.length} sink parser fact(s)${retagNote}${mergeNote}${recognizerMergeNote}`);
  }

  const retagBreakdown = Object.entries(retaggedByRule)
    .map(([rule, n]) => `${rule}: ${n}`)
    .join(', ');
  console.log(
    `\nWrote ${written} synergy.json files. ${factsAdded} new parser-derived fact(s) added, ${factsRetagged} existing hand-authored fact(s) retagged with provenance (${retagBreakdown || 'none'}), ${factsAlreadyPresent} already covered/already-provenanced (skipped), ${factsMerged} duplicate fact(s) merged (existing-fact self-heal, subject-normalization bug), ${factsMergedSameRule} duplicate fact(s) merged (existing-fact self-heal, same-rule identity), ${recognizerAnnotationsMerged} recognizer annotation(s) merged into a shared fact (new runner-level identity grouping). ` +
      `${skippedNoSynergy} card(s) skipped (no synergy.json), ${skippedNotV2} skipped (not v2-shaped), ${skippedNoOracle} skipped (no real oracle text found).`,
  );

  if (suppressedMismatches.length > 0) {
    console.log(`\n${suppressedMismatches.length} recognizer mismatch decline(s) suppressed via a "// recognizer-exception:" marker:`);
    for (const m of suppressedMismatches) {
      console.log(`  - ${m.slug} [${m.face}] rule=${m.rule}: ${m.reason}`);
    }
  }

  if (mismatches.length > 0) {
    console.error(
      `\n${mismatches.length} unresolved recognizer MISMATCH decline(s) — a structural pattern was built from the card's own data but did not verbatim-match its real oracle text (0 or 2+ matches). Either this is a real recognizer bug (fix the recognizer), a real card whose structured Effect is a known, accepted approximation of its prose (add "// recognizer-exception: <rule> — <reason>" to that card's own definition.ts to suppress it), or a real card-data bug (fix the card):\n`,
    );
    for (const m of mismatches) {
      console.error(`  - ${m.slug} [${m.face}] rule=${m.rule}: ${m.reason}`);
    }
    process.exitCode = 1;
  }
}

main();
