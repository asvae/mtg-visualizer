// New recognizer (2026-09-16, recognizer-lane program-AST occurrence-support
// triage) — the `kind:'program'` sibling of `dealDamageTarget-effect-
// structural.ts` for a SUMMED (`AddValue`) magnitude specifically. Reads a
// `kind:'dealDamage'` `EachAction` reached through `program-ast-walker.ts`'s
// general walk (see that file's own header for the shared "why a program-AST
// recognizer can't just be a fixed-shape check" reasoning, not repeated
// here) whose own `amount` is a real `AddValue` of two `Aggregate{op:
// 'count'}` terms, and derives one magnitude "wants X present" SINK per
// summed term — same "one sink per summed term" shape `ptFormula-
// scalingPump-structural.ts`'s own module doc comment already establishes
// for a DIFFERENT structural gate (`CardDefinition.ptFormula`, a single
// literal `power`/`toughness` pair, never a genuine two-`ValueRef` sum);
// this file is the program-AST-walker equivalent for a `dealDamage` action
// whose own amount is a real sum.
//
// **Exactly ONE real, confirmed shape** — `slash-of-light` (fin-32), the
// only real pool card whose `kind:'program'` Effect contains a `'dealDamage'`
// `EachAction` at all (checked directly, `program-ast-walker.ts`'s own
// `'pump'`/`'dealDamage'` occurrence support was built specifically for this
// card and `you're-not-alone`, see that file's own header). Real Forge
// (`slash_of_light.txt`): `SVar:X:Count$Valid Creature.YouCtrl/Plus.Y` /
// `SVar:Y:Count$Valid Equipment.YouCtrl` — a literal SUM of two INDEPENDENT
// counts (a permanent that's both a creature AND an Equipment double-counts
// under this real, literal semantics — confirmed against the real script,
// not assumed, same note this card's own `definition.ts` comment already
// makes). Modeled as `applyToBound('target', 0, dealDamageEach(add(you.
// creaturesInPlay().count(), you.permanentsInPlay().filter('subtype',
// 'Equipment').count())))` inside `selectUpTo(anyPlayer.creaturesInPlay(),
// 1, 'target', [...])`.
//
// **NOTE — this card used to be `kind:'dealDamageTarget'`, covered (partly)
// by `dealDamageTarget-effect-structural.ts`'s own tier-2 `BUCKET_TO_SINK`
// probe** (that file's own module doc comment still names Slash of Light by
// example — now stale, since this card no longer has any `kind:
// 'dealDamageTarget'` Effect at all after its 2026-09-16 migration onto
// `kind:'program'`/`AddValue`; not edited here beyond this note, since that
// recognizer's own narrative is otherwise still accurate for its 5 other
// real users) — that recognizer's own `probeComputedNumber` runtime-trace
// probe could only ever classify a SINGLE collection root as one opaque
// "compound" bucket with no `BUCKET_TO_SINK` entry (a real, permanent
// structural blind spot for a genuinely two-term sum, per that file's own
// doc comment), so it always honestly declined both magnitude sinks for
// this card even before the migration. This recognizer closes that same
// real gap for real, now that the sum is real inspectable DATA
// (`combinator.ts`'s own `AddValue`) instead of an opaque closure trace.
//
// **Real, confirmed English shape, ONE sentence** (not a parameterized
// variant of a smaller template — no other real pool card confirms this
// exact "deals damage equal to the number of X you control plus the number
// of Y you control to target creature" shape): "Slash of Light deals damage
// equal to the number of creatures you control plus the number of Equipment
// you control to target creature." Both summed terms must independently
// resolve to a real, `you`-owned, single-type-word pool (same closed
// `readPool` vocabulary `program-ast-walker.ts` already establishes) — any
// other real card whose own `AddValue` terms don't fit this exact shape (a
// non-`you` owner, a multi-type pool, a nested `AddValue`/`selfCounters`
// term) has no confirmed template and declines outright, same "never guess
// past what a real card has confirmed" discipline every recognizer in this
// catalog already follows.
//
// **Real, confirmed tooling gap found running this recognizer through
// `apply-recognizers.mjs` — hand-patched around, not fixed at the shared-
// tooling level**: this recognizer's own "creatures you control" magnitude
// sink (`{to:'Battlefield', controller:'you', types:{has:['Creature']}}`)
// and the paired RECIPIENT sink (`{to:'Battlefield', types:{has:
// ['Creature']}}`, no `controller`) reduce to the IDENTICAL `coreKey` —
// `controller` is deliberately excluded from that shared key (see
// `apply-recognizers.mjs`'s own `coreKey` doc comment: a pool-wide dry run
// found `controller` authored inconsistently for the identical real claim
// elsewhere, so including it broadly was tried and reverted). Unlike the
// `amount` collision `pumpProgram-effect-structural.ts`'s own module doc
// comment describes (fixed by adding `amount` to the shared key list —
// safe there since `amount`'s presence is unconditionally tied to a real,
// distinct claim), THIS collision can't be fixed the same way without
// re-opening the exact inconsistent-authoring risk `controller`'s exclusion
// was already found unsafe for pool-wide — so it wasn't attempted here.
// Real, confirmed effect: `mergeRecognizedFactsByIdentity` (this script's
// own runner-level pass, scoped to ONE recognizer's OWN freshly-computed
// output, BEFORE ever comparing against on-disk facts) silently merges
// these two genuinely different real claims into one (annotations unioned,
// `controller` from whichever survived as `group[0]`), which then fails
// the on-disk exact-annotation-match retag (the merged fact's own 2-span
// `annotations` array matches neither existing single-span candidate) and
// is silently skipped — `slash-of-light`'s own real term1-creature-sink and
// recipient-sink were BOTH left unprovenanced by a real
// `apply-recognizers.mjs` run for exactly this reason, hand-patched
// (`provenance` added directly) rather than left broken or worked around
// with a wrong fix.
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { extractOccurrences, programEffects, readPool, type DealDamageOccurrence, type PoolDescriptor, type StructuralRecognizerInput } from './program-ast-walker';

export type { StructuralRecognizerInput };

const RULE = 'dealDamageEachMagnitude-effect-structural' as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PLURAL: Record<string, string> = { Creature: 'creatures', Equipment: 'Equipment', Artifact: 'artifacts', Land: 'lands', Enchantment: 'enchantments' };

/** `undefined` (decline) for anything outside the one confirmed real shape
 * — a `you`-owned, single-word pool (see module doc comment). */
function termPhrase(pool: PoolDescriptor): string | undefined {
  if (pool.owner !== 'you') return undefined; // no confirmed "the number of X an opponent controls" (etc.) template
  const word = pool.types?.has;
  if (!word || word.length !== 1 || !PLURAL[word[0]!]) return undefined;
  return `the number of ${PLURAL[word[0]!]} you control`;
}

export function recognizeDealDamageEachMagnitudeEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const programs = programEffects(input);
  if (programs.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect on this face" };
  }

  const occurrences: DealDamageOccurrence[] = [];
  for (const effect of programs) {
    for (const occ of extractOccurrences(effect.program)) {
      if (occ.kind === 'dealDamage') occurrences.push(occ);
    }
  }
  if (occurrences.length === 0) {
    return { matched: false, reason: "no recognized dealDamage EachAction occurrence in this face's own program AST (see program-ast-walker.ts's own readPool/actionOccurrence doc comments for what's in/out of scope)" };
  }
  if (occurrences.length !== 1) {
    return { matched: false, reason: `expected exactly 1 dealDamage occurrence (slash-of-light's own confirmed shape), found ${occurrences.length} — no other confirmed template` };
  }

  const occ = occurrences[0]!;
  if (!occ.targeted) {
    return { matched: false, reason: 'expected a single resolution-time pick (targeted:true) — no confirmed template for a board-wide broadcast' };
  }
  if (occ.pool.owner !== 'any' || occ.pool.types?.has?.length !== 1 || occ.pool.types.has[0] !== 'Creature') {
    return { matched: false, reason: `no confirmed "target creature" template for target pool ${JSON.stringify(occ.pool)} — only slash-of-light's own real unrestricted-owner bare-Creature pool is confirmed` };
  }
  if (occ.amount.kind !== 'add') {
    return { matched: false, reason: `expected a real AddValue sum amount — no confirmed template for ${JSON.stringify(occ.amount)}` };
  }
  const { left, right } = occ.amount;
  if (left.kind !== 'aggregate' || left.op !== 'count' || right.kind !== 'aggregate' || right.op !== 'count') {
    return { matched: false, reason: `expected both AddValue terms to be plain Aggregate{op:'count'} reads — no confirmed template for ${JSON.stringify(occ.amount)}` };
  }
  const leftPool = readPool(left.input);
  const rightPool = readPool(right.input);
  if (!leftPool || !rightPool) {
    return { matched: false, reason: 'one of the two AddValue terms has an unrecognized Query/Filter pool shape (see program-ast-walker.ts\'s own readPool doc comment for what\'s in/out of scope)' };
  }
  const term1 = termPhrase(leftPool);
  const term2 = termPhrase(rightPool);
  if (!term1 || !term2) {
    return { matched: false, reason: `no confirmed English template for AddValue terms ${JSON.stringify({ leftPool, rightPool })}` };
  }

  const pattern = new RegExp(
    `\\b(deals\\b[^\\n]*?\\bdamage) equal to (${escapeRegExp(term1)}) plus (${escapeRegExp(term2)}) to (target creature)\\b`,
    'id',
  );
  const global = new RegExp(pattern.source, pattern.flags + 'g');
  const matches = [...input.oracleText.matchAll(global)] as (RegExpMatchArray & { indices: Array<[number, number]> })[];
  if (matches.length !== 1) {
    return { matched: false, kind: 'mismatch', reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
  }

  const m = matches[0]!;
  const dealsAnnotation = toLineOffset(input.oracleText, ...m.indices[1]!);
  const term1Annotation = toLineOffset(input.oracleText, ...m.indices[2]!);
  const term2Annotation = toLineOffset(input.oracleText, ...m.indices[3]!);
  const recipientAnnotation = toLineOffset(input.oracleText, ...m.indices[4]!);
  if (!dealsAnnotation || !term1Annotation || !term2Annotation || !recipientAnnotation) {
    return { matched: false, reason: 'a matched span did not resolve to a single real oracle-text line' };
  }

  const target: Constraints = { types: occ.pool.types! };

  const facts: RecognizedFact[] = [
    { role: 'source', fact: { event: 'damage', controller: 'you', target, targeted: true, annotations: [dealsAnnotation] }, provenance: { origin: 'parser', rule: RULE } },
    { role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: leftPool.types!, annotations: [term1Annotation] }, provenance: { origin: 'parser', rule: RULE } },
    { role: 'sink', fact: { to: 'Battlefield', controller: 'you', types: rightPool.types!, annotations: [term2Annotation] }, provenance: { origin: 'parser', rule: RULE } },
    { role: 'sink', fact: { to: 'Battlefield', ...target, annotations: [recipientAnnotation] }, provenance: { origin: 'parser', rule: RULE } },
  ];

  return { matched: true, facts };
}
