// New recognizer (2026-09-16, fin/26-50 pass) — structural, `grantKeywordTarget`'s
// own direct sibling of `grantKeywordAll-effect-structural.ts` (same
// group-then-verify architecture, same 2-keyword-list support) and of
// `pumpTarget-effect-structural.ts` (same single-CHOSEN-target shape,
// same real "the sentence also carries a pump clause" gap tolerance).
// Reads `kind:'grantKeywordTarget'` `Effect`s, derives the `event:
// 'grantKeyword', targeted:true` SOURCE fact plus a paired "wants a target
// [creature] present" SINK fact.
//
// **Real, whole-pool check (13 real cards using `kind:'grantKeywordTarget'`)
// done first — only the confirmed "target ... gains <keyword>" shapes are
// in scope, everything else declines by name for a real, checked reason**:
//   - **`owner` omitted/`'each'`, `validType:'creature'`/omitted**:
//     `blitzball-shot`/`haste-magic` ("Target creature gets ±P/±T and gains
//     <keyword> until end of turn" — same combined pump+keyword sentence
//     `pumpTarget-effect-structural.ts` already covers the OTHER half of).
//   - **`owner` omitted/`'each'`, `validType:'any'`**: `restoration-magic`
//     (Cure/Cura tiers — "Target permanent gains hexproof and
//     indestructible until end of turn"; Cure's and Cura's own clauses are
//     REAL, BYTE-IDENTICAL duplicate text on two different lines — same
//     "one real repeated clause, take the first occurrence" treatment
//     `grantKeywordAll-effect-structural.ts`'s own module doc comment
//     documents for a Saga's repeated chapters, just across 2 modal tiers
//     instead of 4 chapters here).
//   - **`owner:'you'`, no `notSelf`, `validType:'creature'`/omitted**:
//     `summon-titan`/`magic-damper` ("(another )?target creature you
//     control gets/gains ... and gains <keyword>").
//   - **`owner:'you'`, `notSelf:true`**: `gladiolus-amicitia`/`summon-
//     primal-garuda` ("ANOTHER target creature you control gets ... and
//     gains <keyword>").
//   - **Widened 2026-09-16 (card-results/fin-51-75 triage backlog item
//     #9)**: `jill-shiva-s-dominant-shiva-warden-of-ice` (`keyword:
//     'Unblockable'`, Saga chapters I/II) — "Target creature CAN'T BE
//     BLOCKED this turn" is its own real, confirmed idiom, genuinely
//     different from the "gains X until end of turn" family every other
//     keyword here uses (no "gains," no "until end of turn" at all — "this
//     turn" instead) — handled as its own single-keyword-group-only
//     special case (never combined with the multi-keyword list builder),
//     see `recognize`'s own body for the literal template.
//   - **Declined, permanently, real reasons named**: `magitek-scythe`/
//     `coral-sword` ("THAT creature gains first strike" — anaphoric,
//     referring back to an Equipment's own separate attach-target, never
//     the word "target" itself); `rosa-resolute-white-mage` ("IT gains
//     lifelink" — anaphoric, referring back to a separate `putCounterTarget`
//     effect's own chosen target); `seifer-almasy`/`squall-seed-mercenary`
//     ("IT/CARDNAME gains double strike" — a triggered consequence on a
//     FIXED reference, e.g. "a creature you control [that] attacks alone,"
//     never a genuinely CHOSEN target at all, despite the `Effect`'s own
//     `kind:'grantKeywordTarget'` shape) — all 5 share the same real
//     "anaphoric/fixed reference, not literally the word 'target'" reason,
//     not a blanket catch-all.
//
// **`untilEndOfTurn` required on every group** — every real qualifying case
// above has it; same "no confirmed permanent-grant template" reasoning
// `grantKeywordAll-effect-structural.ts`'s own module doc comment
// establishes for the identical field on a sibling recognizer.
import type { Effect } from '../card';
import type { AnnotationRef, Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'grantKeywordTarget-effect-structural' as const;

type GrantKeywordTargetEffect = Extract<Effect, { kind: 'grantKeywordTarget' }>;

function isGrantKeywordTargetEffect(e: Effect): e is GrantKeywordTargetEffect {
  return e.kind === 'grantKeywordTarget';
}

const KEYWORD_WORD: Partial<Record<string, string>> = {
  Trample: 'trample',
  Lifelink: 'lifelink',
  Indestructible: 'indestructible',
  Hexproof: 'hexproof',
  Vigilance: 'vigilance',
  Reach: 'reach',
  Menace: 'menace',
  Deathtouch: 'deathtouch',
  Haste: 'haste',
  FirstStrike: 'first strike',
  DoubleStrike: 'double strike',
  Flying: 'flying',
};

interface Group {
  validType?: 'creature' | 'any';
  owner?: 'you' | 'opponents' | 'each';
  notSelf?: boolean;
  untilEndOfTurn?: boolean;
  effects: GrantKeywordTargetEffect[];
}

function groupKeyOf(e: GrantKeywordTargetEffect): string {
  return JSON.stringify([e.validType, e.owner, e.notSelf, e.untilEndOfTurn]);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The real, closed subject phrase — see module doc comment for exactly
 * which combinations are confirmed. `undefined` for anything else
 * (`owner:'opponents'`, or `validType:'any'` combined with `owner:'you'` —
 * neither has a real confirmed card in this pool). */
function subjectCandidate(g: Group): string | undefined {
  if (g.owner !== undefined && g.owner !== 'you' && g.owner !== 'each') return undefined;
  const typeWord = g.validType === 'any' ? 'permanent' : 'creature';
  if (g.owner === 'you') {
    if (g.validType === 'any') return undefined; // no confirmed "target permanent you control" card
    return g.notSelf ? `another target ${typeWord} you control` : `target ${typeWord} you control`;
  }
  if (g.notSelf) return undefined; // no confirmed notSelf combination without owner:'you'
  return `target ${typeWord}`;
}

function buildTarget(g: Group): Constraints {
  if (g.validType === 'any') return {};
  const target: Constraints = { types: { has: ['Creature'] } };
  if (g.notSelf) (target as Constraints & { excludeSelf?: boolean }).excludeSelf = true;
  return target;
}

export function recognizeGrantKeywordTargetEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isGrantKeywordTargetEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no kind:'grantKeywordTarget' Effect on this face" };
  }

  const groups = new Map<string, Group>();
  for (const e of effects) {
    const key = groupKeyOf(e);
    const g = groups.get(key);
    if (g) g.effects.push(e);
    else groups.set(key, { validType: e.validType, owner: e.owner, notSelf: e.notSelf, untilEndOfTurn: e.untilEndOfTurn, effects: [e] });
  }
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // this recognizer groups effects by SHAPE (`groupKeyOf`), not by container,
  // so a group could in principle mix effects from two different containers
  // (no real pool card does today — every real group's own effects share one
  // container — but this stays honest rather than assuming so): only set
  // when every effect in the group agrees on the SAME trigger name (or all
  // have none), never picking one arbitrarily when they'd disagree.
  const effectSource = effectSourceMap(input);
  function groupTriggeredBy(g: Group): string | undefined {
    const names = new Set(g.effects.map((e) => triggeredByOf(effectSource.get(e))));
    if (names.size !== 1) return undefined;
    return [...names][0];
  }

  const facts: RecognizedFact[] = [];

  for (const group of groups.values()) {
    const triggeredBy = groupTriggeredBy(group);
    const subject = subjectCandidate(group);
    if (!subject) {
      return { matched: false, reason: `no confirmed real English template for this group's own owner/validType/notSelf combination (${JSON.stringify({ owner: group.owner, validType: group.validType, notSelf: group.notSelf })})` };
    }

    const uniqueEffects = [...new Map(group.effects.map((e) => [e.keyword, e])).values()];

    // **Widened 2026-09-16 (card-results/fin-51-75 triage backlog item
    // #9)**: `Unblockable` renders as its own real idiom ("can't be
    // blocked THIS TURN," not "gains unblockable until end of turn") —
    // `jill-shiva-s-dominant-shiva-warden-of-ice`'s own real text, the
    // ONLY real pool card granting Unblockable via `grantKeywordTarget`
    // (checked: no other real card shares a group with it, so this is
    // safe as a single-keyword-group-only special case, never combined
    // with the generic multi-keyword list builder below). Bypasses the
    // `untilEndOfTurn:true` requirement entirely — this card's own real
    // Effect has no `untilEndOfTurn` field set at all (its own real
    // duration is "this turn," a genuinely different real phrase from
    // "until end of turn," not an omission).
    if (uniqueEffects.length === 1 && uniqueEffects[0]!.keyword === 'Unblockable') {
      // **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-
      // bug audit): both facts used to reuse the SAME whole-clause span
      // ("<subject> ... can't be blocked this turn") — group 1 (the
      // subject phrase, e.g. "Target creature") now anchors SINK, group 2
      // ("can't be blocked this turn," the action) anchors SOURCE. NOT the
      // same fix as the generic multi-keyword branch below (that one's own
      // SINK is a deliberate, documented WIDENING to the whole clause for a
      // text-coverage reason, a different real tradeoff, left untouched).
      const pattern = new RegExp(`\\b(${subject})\\b[^.\\n]*?\\b(can't be blocked this turn)\\b`, 'id');
      const global = new RegExp(pattern.source, pattern.flags + 'g');
      const matches = [...input.oracleText.matchAll(global)] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
      if (matches.length === 0) {
        return { matched: false, kind: 'mismatch', reason: `no candidate "${subject} ... can't be blocked this turn" clause found in oracle text "${input.oracleText}"` };
      }
      const m = matches[0]!;
      const [sinkStart, sinkEnd] = m.indices[1]!;
      const [sourceStart, sourceEnd] = m.indices[2]!;
      const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
      const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
      if (!sourceAnnotation || !sinkAnnotation) {
        return { matched: false, reason: `matched span [${sinkStart},${sourceEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line` };
      }
      const target = buildTarget(group);
      facts.push({
        role: 'source',
        fact: { event: 'grantKeyword', keyword: 'Unblockable', target, targeted: true, annotations: [sourceAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
        provenance: { origin: 'parser', rule: RULE },
      });
      facts.push({
        role: 'sink',
        fact: { to: 'Battlefield', ...target, annotations: [sinkAnnotation] },
        provenance: { origin: 'parser', rule: RULE },
      });
      continue;
    }

    if (!group.untilEndOfTurn) {
      return { matched: false, reason: 'a grantKeywordTarget group on this face has no untilEndOfTurn:true — no confirmed permanent-grant English template' };
    }
    if (uniqueEffects.length > 2) {
      return { matched: false, reason: `${uniqueEffects.length} distinct keywords share one grantKeywordTarget group — no confirmed real English list template beyond 2` };
    }
    const words = uniqueEffects.map((e) => KEYWORD_WORD[e.keyword]);
    if (words.some((w) => w === undefined)) {
      return { matched: false, reason: `one of [${uniqueEffects.map((e) => e.keyword).join(', ')}] has no confirmed English keyword word` };
    }
    const listPhrases =
      words.length === 1
        ? [escapeRegExp(words[0]!)]
        : [`${escapeRegExp(words[0]!)} and ${escapeRegExp(words[1]!)}`, `${escapeRegExp(words[1]!)} and ${escapeRegExp(words[0]!)}`];

    // Collects EVERY real occurrence of the matched clause, not just the
    // first — `restoration-magic`'s own Cure/Cura tiers are 2 REAL,
    // byte-identical duplicate clauses on 2 different lines (see module doc
    // comment), the same "one real repeated clause" shape `grantKeywordAll-
    // effect-structural.ts` already grants a Saga's repeated chapters. Kept
    // ALL matches (not just the first) so every real occurrence's own WHOLE
    // sentence can be marked covered below, not just the one this
    // recognizer happens to anchor its per-keyword word spans to.
    let clauseMatches: RegExpMatchArray[] | undefined;
    for (const listPhrase of listPhrases) {
      // Same non-greedy same-sentence gap `grantKeywordAll-effect-
      // structural.ts`'s own pattern comment documents (tolerates a
      // combined pump-prefix, e.g. "gets +3/+3 and ").
      const pattern = new RegExp(`\\b${subject}\\b[^.\\n]*?\\bgains? ${listPhrase} until end of turn\\b`, 'i');
      const global = new RegExp(pattern.source, pattern.flags + 'g');
      const matches = [...input.oracleText.matchAll(global)];
      if (matches.length >= 1) {
        clauseMatches = matches;
        break;
      }
    }
    if (!clauseMatches) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `no candidate "${subject} ... gain(s) <keyword list> until end of turn" clause found in oracle text "${input.oracleText}" for keywords [${words.join(', ')}]`,
      };
    }

    const clauseMatch = clauseMatches[0]!;
    const clauseStart = clauseMatch.index!;
    const clauseText = clauseMatch[0]!;
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
      facts.push({
        role: 'source',
        fact: {
          event: 'grantKeyword',
          keyword: uniqueEffects[i]!.keyword,
          ...(group.owner === 'you' ? { controller: 'you' as const } : {}),
          target,
          targeted: true,
          untilEndOfTurn: true,
          annotations: [annotation],
          ...(triggeredBy ? { triggeredBy } : {}),
        },
        provenance: { origin: 'parser', rule: RULE },
      });
    }

    // Paired SINK, one per GROUP (not per keyword) — annotated with the
    // WHOLE matched clause, once per REAL occurrence (2026-09-16, fin/20-47
    // pass: closes a real text-coverage gap `verify-text-coverage.mjs`
    // flagged — the bare per-keyword word spans above never covered the
    // "<subject> gains " prefix or Cura's own separate duplicate-clause
    // line at all). Same "SINK gets the whole clause, SOURCE gets the bare
    // word" convention `grantKeywordAll-effect-structural.ts`'s own sibling
    // sink already established.
    const clauseAnnotations: AnnotationRef[] = [];
    for (const cm of clauseMatches) {
      const s = cm.index!;
      const e = s + cm[0]!.length;
      const ann = toLineOffset(input.oracleText, s, e);
      if (!ann) {
        return { matched: false, reason: `matched span [${s},${e}) did not resolve to a single real oracle-text line` };
      }
      clauseAnnotations.push(ann);
    }
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', ...(group.owner === 'you' ? { controller: 'you' as const } : {}), ...target, annotations: clauseAnnotations },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
