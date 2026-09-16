// New recognizer (2026-09-15, fin/16-25 AI-fact-elimination pass) —
// structural (`Effect[]`-reading, same family as `destroy-effect-
// structural.ts`/`drawCard-effect-structural.ts`), covering `kind:
// 'grantKeywordAll'` — a board-wide, untargeted keyword grant (as opposed to
// `continuousKeywordGrants-*` above, which is a card-DEFINITION-level static
// grant from a permanent that's still on the battlefield; this is a
// one-shot resolved EFFECT, e.g. a Saga chapter or a spell).
//
// **Real, whole-pool check (9 real cards) done first, only "gain <kw...>
// until end of turn" templates are covered — every OTHER real shape found
// declines, by name, for a real reason**:
//   - `dion-bahamut-s-dominant-...`'s own back face (chapters I/II,
//     `notSelf:true`): "Those creatures gain flying until end of turn" — the
//     "Those creatures" wording is anaphoric (refers back to the SAME
//     chapter's own preceding "each other creature you control" clause from
//     its paired `putCounter` effect), so the subject-phrase candidates for
//     `notSelf:true` include BOTH "Those creatures" and the more literal
//     "other creature(s) you control" (see `esper-origins-summon-esper-
//     maduin` below) — tried, requiring exactly one to match, same
//     two-candidate discipline `putCounter-broadcast-structural.ts`'s own
//     "other"/plain wording already establishes for a different Effect kind.
//   - `esper-origins-summon-esper-maduin`'s own back face (chapter III,
//     `notSelf:true`, no subtype): "Other creatures you control get +2/+2
//     AND gain trample until end of turn" — a real combined pump+keyword
//     sentence; this recognizer tolerates (but doesn't assert anything
//     about) an optional "get ±P/±T and " connector immediately before
//     "gain" for exactly this reason — a SEPARATE, still-open recognizer for
//     the paired `pumpAll` magnitude itself is out of this file's own scope.
//   - `circle-of-power` (`subtype:'Wizard'`, no `notSelf`): "Wizards you
//     control get +1/+0 and gain lifelink until end of turn."
//   - `summon-fat-chocobo` (no subtype/notSelf, 3 identical chapters):
//     "Creatures you control gain trample until end of turn."
//   - `moogles-valor` (no subtype/notSelf): "creatures you control gain
//     indestructible until end of turn." (mid-sentence, lowercase "c").
//   - `the-wind-crystal` (2 separate effects, same group, no
//     subtype/notSelf): "Creatures you control gain flying and lifelink
//     until end of turn." — 2 keywords joined by "and", each effect's own
//     fact narrows to just its own keyword WORD's span (see below).
//   - `restoration-magic` (`predicate:'permanents-you-control'`, 2 separate
//     effects, same group): "Permanents you control gain hexproof and
//     indestructible until end of turn."
//   - **`circle-of-power`/`summon-fat-chocobo` REAL BUG FIXED (2026-09-15,
//     same pass this recognizer was built)**: both cards' own
//     `grantKeywordAll` effects were missing `untilEndOfTurn: true` entirely
//     — `card.ts`'s own doc comment says an omitted `untilEndOfTurn`
//     defaults to a PERMANENT-within-scenario grant, but both real cards'
//     own printed text explicitly says "until end of turn." A genuine,
//     silent modeling bug (same class as the Auron's Inspiration/Dion
//     chapter I-II "until end of turn" fixes earlier in this same
//     PRD_AUTOMATED_AUTHORING.md body of work), fixed directly in both
//     `definition.ts` files, not worked around here.
//   - **Declined, permanently, real reasons named**: `crystal-fragments-
//     summon-alexander`'s own `DamagePrevention` grant ("Prevent all damage
//     that would be dealt to creatures you control this turn" — a
//     completely different verb phrase, "prevent," not "gain/have," no
//     confirmed template) and `craterhoof-behemoth` (no real oracle text at
//     all in this checked-in corpus — a cross-set reference card, same
//     "20 real cards have no oracle text available" class this whole
//     recognizer catalog already accepts as an unfixable gap).
//
// **Per-keyword annotation is the bare keyword WORD**, matching the already
// hand-authored real convention on `the-wind-crystal`/`moogles-valor` (a
// keyword-only span, not the whole clause) — each grantKeywordAll effect in
// a shared group gets its OWN fact, independently anchored within the one
// real matched clause.
//
// **Paired SINK, one per GROUP, added 2026-09-16 (fin/26-50 follow-up)** —
// a real, permanent gap this recognizer left open since its own original
// build: every OTHER sibling recognizer in this family (`pumpAllCreaturesYou
// Control-effect-structural.ts`, `putCounterAll-effect-structural.ts`)
// already emits a paired "wants a creature[/subtype] you control present"
// SINK alongside its own SOURCE — this file never did, silently leaving
// `the-wind-crystal`'s/`moogles-valor`'s own real pre-existing hand-
// authored sink facts unprovenanced forever. Reuses `buildTarget` (already
// computed for the SOURCE side) directly — the WANT is identical to what
// the grant itself targets.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix, same day** (systemic-
// annotation-bug audit): the sink used to be annotated with the WHOLE
// matched clause ("<subject> gain(s) <keyword list> until end of turn") —
// this module doc comment used to (wrongly) justify that as matching
// `putCounterAll-effect-structural.ts`'s own convention, but that file's
// own sink span got narrowed the same day (see that recognizer's own
// module doc comment) and this one just hadn't caught up yet. The
// SUBJECT phrase itself ("Creatures you control"/"Wizards you control"/
// etc.) IS a real, always-separable sub-span regardless of which/how many
// keywords share the clause — the pattern now captures it in its own
// group and the sink anchors to THAT, not the trailing "gain(s) ...
// until end of turn" portion (which belongs to the SOURCE side's own
// per-keyword claim).
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'grantKeywordAll-effect-structural' as const;

// `Exclude<..., {predicate:'attacking-creatures'}>` (2026-09-16, found and
// fixed opportunistically while retrofitting this file for the
// `allEffects()` causal-links plumbing, unrelated to that retrofit itself
// — a real, pre-existing, standing TS error): the runtime exclusion in
// `isGrantKeywordAllEffect` below (`e.predicate !== 'attacking-creatures'`)
// only narrows at the VALUE level; the TYPE `GrantKeywordAllEffect` still
// included `'attacking-creatures'` as a possible `predicate` until now,
// which `Group.predicate`'s own narrower, deliberately-2-value type below
// then rejected as a real assignability error the moment `card.ts`'s own
// `grantKeywordAll.predicate` union grew a third value (Cecil, Redeemed
// Paladin's own `'attacking-creatures'` fix, same day).
type RawGrantKeywordAllEffect = Extract<Effect, { kind: 'grantKeywordAll' }>;
// `Exclude` alone doesn't narrow a single object type's own union-valued
// FIELD (it only drops whole members from a top-level union) — this
// `Omit`+re-intersect is the real fix: rebuild `predicate`'s own type
// with `'attacking-creatures'` removed, keeping every other field as-is.
type GrantKeywordAllEffect = Omit<RawGrantKeywordAllEffect, 'predicate'> & { predicate: Exclude<RawGrantKeywordAllEffect['predicate'], 'attacking-creatures'> };

// `predicate: 'attacking-creatures'` is exclusively owned by the sibling
// `grantKeywordAllAttacking-effect-structural.ts` (real, confirmed subject
// wording — "(other) attacking creatures" — is a different English template
// than this file's own `subjectCandidates` covers). Excluding it here
// (2026-09-16, definition-lane `on:'enter'` sweep — found as a hard-fail
// blocker: `cecil-dark-knight-cecil-redeemed-paladin`'s back face carries
// this predicate, and before this exclusion `isGrantKeywordAllEffect`
// accepted it too, so THIS file's own `subjectCandidates` — which has no
// case for this predicate at all — fell through to its bare `notSelf`
// branch ("Other creatures you control"/"Those creatures") and produced a
// spurious MISMATCH decline against real text that the sibling recognizer
// already matches correctly on its own).
function isGrantKeywordAllEffect(e: Effect): e is GrantKeywordAllEffect {
  return e.kind === 'grantKeywordAll' && e.predicate !== 'attacking-creatures';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KEYWORD_WORD: Partial<Record<string, string>> = {
  Flying: 'flying',
  Trample: 'trample',
  Lifelink: 'lifelink',
  Indestructible: 'indestructible',
  Hexproof: 'hexproof',
  Vigilance: 'vigilance',
  Reach: 'reach',
  Menace: 'menace',
  Deathtouch: 'deathtouch',
  Haste: 'haste',
};

interface Group {
  predicate: 'creatures-you-control' | 'permanents-you-control';
  subtype?: string;
  notSelf?: boolean;
  untilEndOfTurn?: boolean;
  effects: GrantKeywordAllEffect[];
}

function groupKeyOf(e: GrantKeywordAllEffect): string {
  return JSON.stringify([e.predicate, e.subtype, e.notSelf, e.untilEndOfTurn]);
}

function subjectCandidates(g: Group): string[] | undefined {
  if (g.predicate === 'permanents-you-control') return ['Permanents you control'];
  if (g.subtype && g.notSelf) return undefined; // no real card combines both — unconfirmed template
  if (g.subtype) return [`${escapeRegExp(g.subtype)}s you control`];
  if (g.notSelf) return ['Other creatures you control', 'Those creatures'];
  return ['Creatures you control'];
}

function buildTarget(g: Group): Constraints {
  if (g.predicate === 'permanents-you-control') return {};
  const types = { has: g.subtype ? ['Creature', g.subtype] : ['Creature'] };
  const target: Constraints = { types };
  if (g.notSelf) (target as Constraints & { excludeSelf?: boolean }).excludeSelf = true;
  return target;
}

export function recognizeGrantKeywordAllEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isGrantKeywordAllEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no kind:'grantKeywordAll' Effect on this face" };
  }

  const groups = new Map<string, Group>();
  for (const e of effects) {
    const key = groupKeyOf(e);
    const g = groups.get(key);
    if (g) g.effects.push(e);
    else groups.set(key, { predicate: e.predicate, subtype: e.subtype, notSelf: e.notSelf, untilEndOfTurn: e.untilEndOfTurn, effects: [e] });
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass;
  // SOURCE-only, per the same-day sink/triggeredBy architecture correction
  // — see `Fact.triggeredBy`'s own doc comment, synergy.ts) — this
  // recognizer groups/dedups effects by SHAPE and by keyword (see the
  // module's own comments above), so an individual `uniqueEffects[i]` can
  // legitimately span more than one real container (`summon-fat-chocobo`'s
  // own 3 repeated Saga chapters, same "repeats, not a typo" pattern
  // flagged elsewhere in this pass) — per KEYWORD, this uses whichever
  // single representative effect the existing `uniqueEffects` dedup already
  // kept (same "first-wins" precedent that dedup itself already
  // established). The paired SINK below never carries `triggeredBy` at
  // all — it's the structural "want," not a caused effect.
  const effectSource = effectSourceMap(input);

  for (const group of groups.values()) {
    if (!group.untilEndOfTurn) {
      return { matched: false, reason: 'a grantKeywordAll group on this face has no untilEndOfTurn:true — no confirmed permanent-grant English template' };
    }
    // Dedup by KEYWORD first — a repeating Saga's own identical chapters
    // (`summon-fat-chocobo`'s own 3 literal "II, III, IV — ... gain trample
    // until end of turn" duplicates, one shared real clause) collapse to one
    // real keyword before any list-length check, same as `destroy-effect-
    // structural.ts`'s own "no dedup here, the runner's own
    // mergeRecognizedFactsByIdentity handles literal duplicates" precedent —
    // this dedup is about correctly counting REAL DISTINCT keywords in one
    // clause (never more than the runner-level identity merge alone could
    // fix), not a substitute for that shared pass.
    const uniqueEffects = [...new Map(group.effects.map((e) => [e.keyword, e])).values()];
    if (uniqueEffects.length > 2) {
      return { matched: false, reason: `${uniqueEffects.length} distinct keywords share one grantKeywordAll group — no confirmed real English list template beyond 2` };
    }
    const words = uniqueEffects.map((e) => KEYWORD_WORD[e.keyword]);
    if (words.some((w) => w === undefined)) {
      return { matched: false, reason: `one of [${uniqueEffects.map((e) => e.keyword).join(', ')}] has no confirmed English keyword word` };
    }
    const subjects = subjectCandidates(group);
    if (!subjects) {
      return { matched: false, reason: 'subtype + notSelf combined — no confirmed real English template for this combination' };
    }

    const listPhrases =
      words.length === 1
        ? [escapeRegExp(words[0]!)]
        : [`${escapeRegExp(words[0]!)} and ${escapeRegExp(words[1]!)}`, `${escapeRegExp(words[1]!)} and ${escapeRegExp(words[0]!)}`];

    let clauseMatch: (RegExpMatchArray & { indices: Array<[number, number] | undefined> }) | undefined;
    for (const subject of subjects) {
      for (const listPhrase of listPhrases) {
        // Non-greedy same-sentence gap between subject and "gain(s)" —
        // covers BOTH the direct-adjacent case (just a space, e.g. "Creatures
        // you control gain trample...") and the combined pump-prefix case
        // (e.g. "...you control get +2/+2 and gain trample..."), same
        // "tolerate everything unconfirmed in between, verify only the real
        // closed anchor" discipline `token-creation-structural.ts` already
        // establishes for its own adjective gaps — this recognizer makes no
        // claim about what (if anything) sits in that gap. Group 1 (the
        // subject phrase alone) anchors the SINK — see module doc comment's
        // own "SOURCE/SINK span-narrowing fix" section.
        const pattern = new RegExp(`\\b(${subject})\\b[^.\\n]*?\\bgains? ${listPhrase} until end of turn\\b`, 'id');
        const global = new RegExp(pattern.source, pattern.flags + 'g');
        const matches = [...input.oracleText.matchAll(global)] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
        if (matches.length > 1) {
          return { matched: false, kind: 'mismatch', reason: `expected clause /${pattern.source}/ matched ${matches.length} times — ambiguous` };
        }
        if (matches.length === 1) {
          if (clauseMatch) {
            return { matched: false, kind: 'mismatch', reason: '2 different subject/list-order candidates both matched — ambiguous, declining rather than guessing which' };
          }
          clauseMatch = matches[0];
        }
      }
    }
    if (!clauseMatch) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `no candidate "<subject> gain <keyword list> until end of turn" clause found in oracle text "${input.oracleText}" for keywords [${words.join(', ')}]`,
      };
    }

    const clauseStart = clauseMatch.index!;
    const clauseText = clauseMatch[0]!;
    const [subjectStart, subjectEnd] = clauseMatch.indices[1]!;
    const target = buildTarget(group);

    for (let i = 0; i < uniqueEffects.length; i++) {
      const word = words[i]!;
      const wordMatch = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').exec(clauseText);
      if (!wordMatch) {
        return { matched: false, reason: `internal: keyword word "${word}" not found within its own already-matched clause "${clauseText}"` };
      }
      const start = clauseStart + wordMatch.index;
      const end = start + wordMatch[0].length;
      const annotation = toLineOffset(input.oracleText, start, end);
      if (!annotation) {
        return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
      }
      const keywordTriggeredBy = triggeredByOf(effectSource.get(uniqueEffects[i]!));
      facts.push({
        role: 'source',
        fact: {
          event: 'grantKeyword',
          keyword: uniqueEffects[i]!.keyword,
          controller: 'you',
          target,
          targeted: false,
          untilEndOfTurn: true,
          annotations: [annotation],
          ...(keywordTriggeredBy ? { triggeredBy: keywordTriggeredBy } : {}),
        },
        provenance: { origin: 'parser', rule: RULE },
      });
    }

    const subjectAnnotation = toLineOffset(input.oracleText, subjectStart, subjectEnd);
    if (!subjectAnnotation) {
      return { matched: false, reason: `matched subject span [${subjectStart},${subjectEnd}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', ...target, annotations: [subjectAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
