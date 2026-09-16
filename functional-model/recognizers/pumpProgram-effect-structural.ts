// New recognizer (2026-09-16, recognizer-lane program-AST occurrence-support
// triage) — the `kind:'program'` sibling of `pumpTarget-effect-structural.ts`
// (that one only ever reads a plain `kind:'pumpTarget'` `Effect`; this one
// reads a `kind:'pump'` `EachAction` reached through `program-ast-walker.ts`'s
// general `Query`/`Filter`/`Each`/`SelectUpTo`/`ApplyToBound`/`Branch` walk —
// see that file's own header for the full "why a program-AST recognizer
// can't just be a fixed-shape check" reasoning, not repeated here).
//
// **Exactly ONE real, confirmed shape** — `you're-not-alone` (fin-44), the
// only real pool card whose `kind:'program'` Effect contains a `'pump'`
// `EachAction` at all (checked directly, `program-ast-walker.ts`'s own
// `'pump'`/`'dealDamage'` occurrence support was built specifically for this
// card and `slash-of-light`, see that file's own header): real Forge
// (`youre_not_alone.txt`) `SVar:X:Count$Compare Y GE3.4.2`/`SVar:Y:Count$
// Valid Creature.YouCtrl` — a genuine threshold dispatch (3+ creatures you
// control -> +4/+4, otherwise +2/+2), modeled as `Branch(compare(you.
// creaturesInPlay().count(), '>=', 3), [applyToBound('target', 0,
// pumpEach(4, 4, true))], [applyToBound('target', 0, pumpEach(2, 2, true))])`
// nested inside a `selectUpTo(anyPlayer.creaturesInPlay(), 1, 'target', ...)`
// — see `program-ast-walker.ts`'s own `case 'branch'` for why this walk
// produces EXACTLY 2 `PumpOccurrence`s (one per side, both always walked)
// sharing the same `pool`/`targeted`/`untilEndOfTurn`, differing only in
// `power`/`toughness` and in which one carries a real `guard` (the `then`
// side's own `readGuardCondition` resolution — see that function's own doc
// comment for why the `else` side never gets one).
//
// **Real, confirmed English shape, 2 sentences, genuinely different
// wording** (not a parameterized variant of one template):
//   - The UNGUARDED occurrence's own clause: "Target creature gets +2/+2
//     until end of turn." — same bare "target creature" subject word
//     `pumpTarget-effect-structural.ts`'s own `subjectCandidate` already
//     uses for an unrestricted-owner pool, same trailing "until end of
//     turn" tail vocabulary that recognizer's own module doc comment
//     establishes.
//   - The GUARDED occurrence's own clause: "If you control three or more
//     creatures, it gets +4/+4 until end of turn instead." — an anaphoric
//     "it" (not a fresh "target creature" noun phrase — the SAME creature
//     was already picked by the base clause) with a LEADING "If you control
//     <N+> <type>s," guard clause and a trailing "instead." No other real
//     pool card confirms either the anaphoric-"it"-with-leading-guard
//     wording or the "gets ±P/±T until end of turn instead" tail — this
//     recognizer's own vocabulary is scoped exactly to this one real
//     sentence shape, not generalized past it.
//
// **Only 2 Fact-level claims, not a magnitude-per-occurrence pair** — this
// pool's `Fact` schema has no field for a pump's own power/toughness
// MAGNITUDE at all (`pumpTarget-effect-structural.ts`'s own emitted Fact
// never carries `power`/`toughness` either — only the qualitative "a pump
// happens against this pool" claim), so the base and guarded occurrences
// collapse into the SAME real `event:'pump'` SOURCE claim (one Fact, two
// annotation spans, merged automatically by `apply-recognizers.mjs`'s own
// runner-level `mergeRecognizedFactsByIdentity` — same "same real claim, two
// real spans" precedent `qiqirn-merchant`'s own cantrip/bigDraw pair already
// established) and ONE "wants a legal target creature present" SINK. The
// guard's own real "wants 3+ creatures you control present" is a
// GENUINELY SEPARATE real claim (a magnitude precondition on the BONUS half
// only, not a re-statement of the base want) — modeled as its own SECOND
// sink fact, same `{to:'Battlefield', controller:'you', types:{...},
// amount:{min:N}}` shape `ptFormula-scalingPump-structural.ts`'s own
// `thresholdBonus` branch already establishes for the identical real
// "wants a controlled-permanent count >= min" claim (different structural
// gate — `CardDefinition.ptFormula`, not a program-AST `Branch` — same real
// Fact shape). **Required `apply-recognizers.mjs`'s own shared `coreKey` to
// gain `amount` as a real discriminating field** (see that file's own
// updated doc comment right above its `keys` array) — without it, this
// card's own bare "wants a creature present" sink and this magnitude sink
// reduce to the identical coreKey and would be wrongly collapsed into one by
// the runner's own same-recognizer-output merge pass.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit): both SOURCE facts used to reuse the SAME whole-clause span as
// their paired base SINK (including the "target creature"/guard-clause
// subject text, which is what the SINK actually claims must be present,
// not part of the pump action itself) -- narrowed to just "gets ±P/±T"
// (same convention `pumpTarget-effect-structural.ts`'s own module doc
// comment establishes for the direct non-program sibling). Both SINKS
// keep their WHOLE clause unchanged.
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { extractOccurrences, programEffects, type PumpOccurrence, type StructuralRecognizerInput } from './program-ast-walker';

export type { StructuralRecognizerInput };

const RULE = 'pumpProgram-effect-structural' as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSigned(n: number): string {
  return (n >= 0 ? '+' : '') + n;
}

const NUMBER_WORD: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' };
const PLURAL: Record<string, string> = { Creature: 'creatures' };

/** Literal `power`/`toughness` only — `undefined` (decline) for anything
 * else, same "opaque, can't build a real English template without
 * executing it" reasoning `pumpTarget-effect-structural.ts`'s own literal-
 * only gate already gives. */
function literalPT(occ: PumpOccurrence): { power: number; toughness: number } | undefined {
  if (occ.power.kind !== 'literal' || occ.toughness.kind !== 'literal') return undefined;
  return { power: occ.power.value, toughness: occ.toughness.value };
}

function poolsEqual(a: PumpOccurrence['pool'], b: PumpOccurrence['pool']): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function recognizePumpProgramEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const programs = programEffects(input);
  if (programs.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect on this face" };
  }

  const occurrences: PumpOccurrence[] = [];
  for (const effect of programs) {
    for (const occ of extractOccurrences(effect.program)) {
      if (occ.kind === 'pump') occurrences.push(occ);
    }
  }
  if (occurrences.length === 0) {
    return { matched: false, reason: "no recognized pump EachAction occurrence in this face's own program AST (see program-ast-walker.ts's own readPool/actionOccurrence doc comments for what's in/out of scope)" };
  }
  if (occurrences.length !== 2) {
    return { matched: false, reason: `expected exactly 2 pump occurrences (you're-not-alone's own confirmed base+conditional-bonus shape), found ${occurrences.length} — no other confirmed template` };
  }

  const [first, second] = occurrences as [PumpOccurrence, PumpOccurrence];
  const guarded = first.guard ? first : second.guard ? second : undefined;
  const base = guarded === first ? second : first;
  if (!guarded || base.guard) {
    return { matched: false, reason: 'expected exactly one guarded and one unguarded pump occurrence — no confirmed template for 2 guarded or 0 guarded occurrences' };
  }
  if (!guarded.targeted || !base.targeted) {
    return { matched: false, reason: 'expected both pump occurrences to be single resolution-time picks (targeted:true) — no confirmed template for a board-wide broadcast half' };
  }
  if (!poolsEqual(guarded.pool, base.pool)) {
    return { matched: false, reason: `expected both pump occurrences to share the same target pool (the same picked creature either way) — got ${JSON.stringify(guarded.pool)} vs ${JSON.stringify(base.pool)}` };
  }
  if (guarded.untilEndOfTurn !== base.untilEndOfTurn) {
    return { matched: false, reason: 'expected both pump occurrences to share the same untilEndOfTurn — no confirmed template for a mismatch' };
  }
  if (guarded.pool.owner !== 'any' || guarded.pool.types?.has?.length !== 1 || guarded.pool.types.has[0] !== 'Creature') {
    return { matched: false, reason: `no confirmed "target creature" template for target pool ${JSON.stringify(guarded.pool)} — only you're-not-alone's own real unrestricted-owner bare-Creature pool is confirmed` };
  }
  if (!guarded.untilEndOfTurn) {
    return { matched: false, reason: 'expected untilEndOfTurn:true — no confirmed template without it' };
  }

  const basePT = literalPT(base);
  const guardedPT = literalPT(guarded);
  if (!basePT || !guardedPT) {
    return { matched: false, reason: 'a pump occurrence on this face has non-literal (Computed) power/toughness — opaque, can\'t build a real English template without executing it' };
  }

  const guardType = guarded.guard!.pool.types?.has;
  if (guarded.guard!.pool.owner !== 'you' || !guardType || guardType.length !== 1 || !PLURAL[guardType[0]!] || !NUMBER_WORD[guarded.guard!.min]) {
    return { matched: false, reason: `no confirmed English template for guard condition ${JSON.stringify(guarded.guard)}` };
  }

  // Same "narrow SOURCE to just 'gets ±P/±T', whole-clause SINK" convention
  // `pumpTarget-effect-structural.ts`'s own module doc comment establishes
  // (this recognizer's own header names that file as the direct sibling) —
  // group 1 in each pattern below is the "gets ±P/±T" sub-phrase.
  const baseNumbers = `${escapeRegExp(formatSigned(basePT.power))}\\/${escapeRegExp(formatSigned(basePT.toughness))}`;
  const basePattern = new RegExp(`\\btarget creature (gets ${baseNumbers}) until end of turn\\b`, 'id');
  const baseMatches = [...input.oracleText.matchAll(new RegExp(basePattern.source, basePattern.flags + 'g'))] as Array<
    RegExpMatchArray & { indices: Array<[number, number] | undefined> }
  >;
  if (baseMatches.length !== 1) {
    return { matched: false, kind: 'mismatch', reason: `expected clause /${basePattern.source}/ matched ${baseMatches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
  }

  const guardedNumbers = `${escapeRegExp(formatSigned(guardedPT.power))}\\/${escapeRegExp(formatSigned(guardedPT.toughness))}`;
  const guardWord = NUMBER_WORD[guarded.guard!.min]!;
  const guardTypeWord = PLURAL[guardType[0]!]!;
  const guardedPattern = new RegExp(`\\bIf you control ${guardWord} or more ${guardTypeWord}, it (gets ${guardedNumbers}) until end of turn instead\\b`, 'id');
  const guardedMatches = [...input.oracleText.matchAll(new RegExp(guardedPattern.source, guardedPattern.flags + 'g'))] as Array<
    RegExpMatchArray & { indices: Array<[number, number] | undefined> }
  >;
  if (guardedMatches.length !== 1) {
    return { matched: false, kind: 'mismatch', reason: `expected clause /${guardedPattern.source}/ matched ${guardedMatches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
  }

  const baseM = baseMatches[0]!;
  const baseFullAnnotation = toLineOffset(input.oracleText, baseM.index!, baseM.index! + baseM[0]!.length);
  const [baseGetsStart, baseGetsEnd] = baseM.indices[1]!;
  const baseSourceAnnotation = toLineOffset(input.oracleText, baseGetsStart, baseGetsEnd);
  const guardedM = guardedMatches[0]!;
  const guardedFullAnnotation = toLineOffset(input.oracleText, guardedM.index!, guardedM.index! + guardedM[0]!.length);
  const [guardedGetsStart, guardedGetsEnd] = guardedM.indices[1]!;
  const guardedSourceAnnotation = toLineOffset(input.oracleText, guardedGetsStart, guardedGetsEnd);
  if (!baseFullAnnotation || !baseSourceAnnotation || !guardedFullAnnotation || !guardedSourceAnnotation) {
    return { matched: false, reason: 'a matched span did not resolve to a single real oracle-text line' };
  }

  const target: Constraints = base.pool.types ? { types: base.pool.types } : {};

  const facts: RecognizedFact[] = [
    { role: 'source', fact: { event: 'pump', target, targeted: true, untilEndOfTurn: true, annotations: [baseSourceAnnotation] }, provenance: { origin: 'parser', rule: RULE } },
    { role: 'source', fact: { event: 'pump', target, targeted: true, untilEndOfTurn: true, annotations: [guardedSourceAnnotation] }, provenance: { origin: 'parser', rule: RULE } },
    { role: 'sink', fact: { to: 'Battlefield', ...target, annotations: [baseFullAnnotation] }, provenance: { origin: 'parser', rule: RULE } },
    {
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', types: guarded.guard!.pool.types!, amount: { min: guarded.guard!.min }, annotations: [guardedFullAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];

  return { matched: true, facts };
}
