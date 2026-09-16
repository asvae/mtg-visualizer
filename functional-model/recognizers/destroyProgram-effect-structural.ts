// New recognizer (2026-09-16, program-AST generalization pass) — the
// `kind:'program'` sibling of `destroy-effect-structural.ts` (that one only
// ever reads a plain `kind:'destroy'` `Effect`; this one reads a `kind:
// 'destroy'` `EachAction` reached through `program-ast-walker.ts`'s general
// `Query`/`Filter`/`Each`/`SelectUpTo`/`ApplyToBound` walk — see that file's
// own header for the full "why a program-AST recognizer can't just be a
// fixed-shape check" reasoning, not repeated here).
//
// **Two real, confirmed shapes** (both real pool cards migrated onto
// `kind:'program'` today, 2026-09-16, off a `kind:'custom'` closure — see
// each card's own `definition.ts` comment):
//   - `ultima` (fin-38): `anyPlayer.permanentsInPlay().filter('cardType',
//     ['artifact','creature']).each(destroyEach())` — a board-wide, UNTARGETED
//     broadcast (`walker`'s own `DestroyOccurrence.targeted: false`) over a
//     `hasAny` two-type pool. Real clause: "Destroy all artifacts and
//     creatures." (`all` quantifier, `and`-joined).
//   - `coliseum-behemoth`: `selectUpTo(anyPlayer.permanentsInPlay().filter(
//     'cardType', ['artifact','enchantment']), 1, 'target',
//     [applyToBound('target', 0, destroyEach())])` — a single resolution-time
//     PICK (`targeted: true`) over a different `hasAny` two-type pool. Real
//     clause: "Destroy target artifact or enchantment." (`target` quantifier,
//     `or`-joined).
//
// **The `has` (single-type) branches below are NOT independently confirmed
// by a real `kind:'program'` card** — they mirror `destroy-effect-
// structural.ts`'s own already-confirmed "target creature"/"Destroy all
// creatures" templates exactly (same word, same singular/plural form, same
// boundary check), just reached through this walker instead of a plain
// `kind:'destroy'` Effect. Included since it's the identical closed
// vocabulary that recognizer already trusts, not a new guess — but flagged
// here explicitly since "confirmed via a program-AST card" and "confirmed via
// a declarative-Effect card, reused here by symmetry" are genuinely different
// evidence bars.
//
// **2+ type words has no confirmed join template** — Magic's own "X, Y, and
// Z" three-way list templating isn't confirmed anywhere in this pool for
// either quantifier; `joinTypeWords` below declines (returns `undefined`)
// above 2 words rather than guess at Oxford-comma conventions.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, same class as the sibling fix in `destroy-effect-structural.ts`
// itself, same day — see that file's own module doc comment): the sink
// used to reuse the SAME whole-clause span as the paired SOURCE/`dies`
// facts ("Destroy all artifacts and creatures"/"Destroy target artifact or
// enchantment," verb included). `expectedClausePattern` now wraps the
// object phrase ("all <word> and <word>"/"target <word> or <word>") in its
// own capturing group; the SOURCE and `dies` facts keep the WHOLE clause
// (unchanged), only the SINK narrows to the object-phrase group.
//
// **No more companion `dies` consequence fact (removed 2026-09-16, later
// same day)** — same real user-reported authoring-time redundancy fix as
// `destroy-effect-structural.ts`'s own identical removal (see that file's
// own module doc comment for the full reasoning) — this recognizer used to
// ALSO emit a paired CR 700.4 `dies` fact at the IDENTICAL annotation span
// as the `destroy` fact above. Removed in favor of `synergy.ts`'s
// match-time `satisfiesDestroyImpliesDies`/`isGraveyardArrivalWant`, which
// makes the `destroy` fact satisfy the same graveyard-arrival wants
// directly. Verified via the same real full-pool `find-synergies.mjs`
// before/after diff (covering both this recognizer's own real cards,
// Ultima and Coliseum Behemoth, and `destroy-effect-structural.ts`'s own):
// zero real (producer, wanter) card-pairs lost any edge.
import type { Constraints, TypeConstraint } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { extractOccurrences, programEffects, type DestroyOccurrence, type StructuralRecognizerInput } from './program-ast-walker';

export type { StructuralRecognizerInput };

const RULE = 'destroyProgram-effect-structural' as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PLURAL: Record<string, string> = { Creature: 'creatures', Artifact: 'artifacts', Land: 'lands', Enchantment: 'enchantments' };
const SINGULAR: Record<string, string> = { Creature: 'creature', Artifact: 'artifact', Land: 'land', Enchantment: 'enchantment' };

/** `undefined` (decline) above 2 words — see module doc comment. */
function joinTypeWords(words: string[], form: Record<string, string>, conjunction: 'and' | 'or'): string | undefined {
  const mapped = words.map((w) => form[w]);
  if (mapped.some((w) => w === undefined)) return undefined;
  if (mapped.length === 1) return mapped[0];
  if (mapped.length === 2) return `${mapped[0]} ${conjunction} ${mapped[1]}`;
  return undefined;
}

function typeWords(types: TypeConstraint | undefined): string[] | undefined {
  if (!types) return undefined;
  return types.hasAny ?? types.has;
}

/** Builds the expected literal English clause for one `DestroyOccurrence` —
 * `undefined` (never guessed) for anything outside the confirmed vocabulary
 * above (this module's own doc comment). */
function expectedClausePattern(occ: DestroyOccurrence): RegExp | undefined {
  const words = typeWords(occ.pool.types);
  let phrase: string;
  if (occ.targeted) {
    if (!words) return undefined; // no real "Destroy target permanent" program-AST card to confirm the fully-unrestricted case against
    const joined = joinTypeWords(words, SINGULAR, 'or');
    if (!joined) return undefined;
    phrase = `target ${joined}`;
  } else {
    if (!words) return undefined; // no real "Destroy all permanents" program-AST card either
    const joined = joinTypeWords(words, PLURAL, 'and');
    if (!joined) return undefined;
    phrase = `all ${joined}`;
  }
  return new RegExp(`\\bDestroy (${escapeRegExp(phrase)})(?=[.\\n]|$)`, 'i');
}

function buildTargetConstraint(occ: DestroyOccurrence): Constraints | undefined {
  return occ.pool.types ? { types: occ.pool.types } : undefined;
}

/**
 * Reads every `kind:'program'` effect's own AST directly (oracle text is
 * read ONLY to anchor the derived facts' annotation, never to derive their
 * content) and derives the `event:'destroy'` Fact (+ paired "wants a legal
 * target present" sink) implied by every recognized `DestroyOccurrence`
 * this recognizer can confidently resolve — same "companion sink fact"/
 * "all-or-nothing per face" discipline `destroy-effect-structural.ts`'s own
 * module doc comment already documents, reused here rather than re-argued.
 */
export function recognizeDestroyProgramEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const programs = programEffects(input);
  if (programs.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect on this face" };
  }

  const occurrences: DestroyOccurrence[] = [];
  for (const effect of programs) {
    for (const occ of extractOccurrences(effect.program)) {
      if (occ.kind === 'destroy') occurrences.push(occ);
    }
  }
  if (occurrences.length === 0) {
    return { matched: false, reason: "no recognized destroy EachAction occurrence in this face's own program AST (see program-ast-walker.ts's own readPool/actionOccurrence doc comments for what's in/out of scope)" };
  }

  const facts: RecognizedFact[] = [];

  for (const occ of occurrences) {
    const pattern = expectedClausePattern(occ);
    if (!pattern) {
      return {
        matched: false,
        reason: `a program-AST destroy occurrence on this face (${JSON.stringify(occ)}) has no confirmed structural->text template (see module doc comment for the exact 2-shape/2-word-max vocabulary this recognizer supports)`,
      };
    }

    const global = new RegExp(pattern.source, pattern.flags + 'gd');
    const matches = [...input.oracleText.matchAll(global)] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
    if (matches.length === 0) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ not found (verbatim, with a real clause boundary right after) in oracle text "${input.oracleText}"`,
      };
    }
    if (matches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times — ambiguous, declining rather than guessing which`,
      };
    }

    const m = matches[0]!;
    const start = m.index!;
    const end = start + m[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    const [objectStart, objectEnd] = m.indices[1]!;
    const objectAnnotation = toLineOffset(input.oracleText, objectStart, objectEnd);
    if (!annotation || !objectAnnotation) {
      return { matched: false, reason: `matched span [${start},${end}) (or its own inner object-phrase span) did not resolve to a single real oracle-text line` };
    }

    const target = buildTargetConstraint(occ);

    facts.push({
      role: 'source',
      fact: { event: 'destroy', ...(target ? { target } : {}), targeted: occ.targeted, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });

    // No companion `dies` CONSEQUENCE fact here anymore — see module doc
    // comment ("No more companion `dies` consequence fact"). The `destroy`
    // fact above now satisfies a graveyard-arrival want directly, at MATCH
    // time (`synergy.ts`'s `satisfiesDestroyImpliesDies`).

    // Companion SINK fact — "wants a legal target/victim present," same
    // convention `destroy-effect-structural.ts`'s own module doc comment
    // documents for the identical real claim. Narrowed to just the object
    // phrase (2026-09-16 fix, see module doc comment).
    const sinkFact: Record<string, unknown> = { to: 'Battlefield', annotations: [objectAnnotation] };
    if (target?.types) sinkFact.types = target.types;
    facts.push({ role: 'sink', fact: sinkFact as RecognizedFact['fact'], provenance: { origin: 'parser', rule: RULE } });
  }

  return { matched: true, facts };
}
