// New recognizer (2026-09-15, fin/11-15 audit follow-up — Delivery
// Moogle's own real two-zone tutor, the one card that forced `move`'s own
// `from` field to widen to `ZoneType | ZoneType[]` and gain a new
// `maxCmc` field, card.ts). Structural — sibling of `moveSearchLibrary-
// effect-structural.ts` (that file covers the single-zone `from:'Library'`
// template; this one covers the real, DIFFERENT "search your library
// AND/OR GRAVEYARD for a[n] <type> card with mana value N or less"
// template Delivery Moogle alone needs — real Forge dual-`Origin` shape,
// `Origin$ Library | OriginAlternative$ Graveyard`, `card.ts`'s own
// `move.from` doc comment).
//
// **Real, whole-pool check**: Delivery Moogle is the ONLY real card in
// this pool whose own `kind:'move'` effect sets a real `ZoneType[]`
// `from` (grepped directly) — this recognizer's own template is scoped to
// exactly that one confirmed real shape (`from` is an array containing
// EXACTLY `'Library'` and `'Graveyard'`, in either order — CR 701.19 makes
// no distinction between the two once both are eligible, so this
// recognizer doesn't care which order the array lists them in, only that
// both are present and nothing else is). A future card combining a
// DIFFERENT zone pair needs its own template, not a silent stretch of
// this one.
//
// **Two facts PER ZONE, four total, each zone's own pair sharing that
// zone's own real annotation span** — same "one fact per real sub-clause"
// discipline `flashback-alternateCost-structural.ts`'s own two-fact split
// already establishes for a different two-clause reminder-text template.
// Confirmed directly against Delivery Moogle's own real, pre-existing
// hand-authored facts (all 4 byte-matched here): the Library-side pair is
// anchored to the literal substring "your library" alone (never the whole
// clause), the Graveyard-side pair to the literal substring "graveyard"
// alone — NOT the full "search ... with mana value N or less" clause,
// which is used only to STRUCTURALLY CONFIRM this is genuinely the real
// two-zone/maxCmc template before annotating either zone word (same
// "confirm broadly, annotate narrowly" split `pumpSelf-effect-
// structural.ts`'s own "gets ±P/±T"-only annotation already establishes
// for a different recognizer).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'moveSearchLibraryOrGraveyard-effect-structural' as const;

type MoveEffect = Extract<Effect, { kind: 'move' }>;

function isLibraryOrGraveyardSearch(e: Effect): e is MoveEffect {
  if (e.kind !== 'move' || e.target || e.to !== 'Hand' || e.owner !== 'you') return false;
  if (!Array.isArray(e.from) || e.from.length !== 2) return false;
  const zones = new Set(e.from);
  return zones.has('Library') && zones.has('Graveyard') && e.maxCmc !== undefined;
}

/** Same TitleCase mapping `move-effect-structural.ts`'s own
 * `buildTargetConstraint` already establishes for the identical
 * `validType` vocabulary — kept as its own small copy here (this
 * recognizer family's own "duplicate a small helper per file, never
 * extract" convention, same as every `selfSubjectAlternation` copy). */
function typeWordFor(effect: MoveEffect): string | undefined {
  if (typeof effect.qty !== 'number' || effect.qty !== 1) return undefined;
  if (effect.subtype) return effect.subtype;
  if (effect.validType === 'creature') return 'creature';
  if (effect.validType === 'artifact') return 'artifact';
  if (effect.validType === 'land') return 'land';
  return undefined;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function recognizeMoveSearchLibraryOrGraveyardEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).filter(isLibraryOrGraveyardSearch);
  if (effects.length === 0) {
    return { matched: false, reason: "no untargeted, owner:'you', to:'Hand', from:['Library','Graveyard'] kind:'move' Effect (with maxCmc set) on this face" };
  }

  const facts: RecognizedFact[] = [];

  for (const effect of effects) {
    const typeWord = typeWordFor(effect);
    if (!typeWord) {
      return {
        matched: false,
        reason: `a Library-or-Graveyard search move effect on this face (${JSON.stringify(effect)}) has no confirmed single-word type template (see module doc comment)`,
      };
    }
    const phrase = `search your library and/or graveyard for ${article(typeWord)} ${escapeRegExp(typeWord)} card with mana value ${effect.maxCmc} or less`;
    const pattern = new RegExp(`\\b${phrase}\\b`, 'i');
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(globalPattern)];
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    const clauseStart = m.index!;
    const clauseEnd = clauseStart + m[0]!.length;
    const clauseText = input.oracleText.slice(clauseStart, clauseEnd);

    const libraryOffset = clauseText.indexOf('your library');
    const graveyardOffset = clauseText.indexOf('graveyard');
    if (libraryOffset === -1 || graveyardOffset === -1) {
      return { matched: false, reason: 'matched clause did not contain both "your library" and "graveyard" substrings to anchor separate annotations to — unreachable given the pattern above, defensive only' };
    }
    const libraryStart = clauseStart + libraryOffset;
    const libraryEnd = libraryStart + 'your library'.length;
    const graveyardStart = clauseStart + graveyardOffset;
    const graveyardEnd = graveyardStart + 'graveyard'.length;

    const libraryAnnotation = toLineOffset(input.oracleText, libraryStart, libraryEnd);
    const graveyardAnnotation = toLineOffset(input.oracleText, graveyardStart, graveyardEnd);
    if (!libraryAnnotation || !graveyardAnnotation) {
      return { matched: false, reason: 'matched "your library"/"graveyard" span did not resolve to a single real oracle-text line' };
    }

    const typeConstraint = { has: [titleCase(typeWord)] };
    const cmcConstraint = { max: effect.maxCmc };

    facts.push({
      role: 'source',
      fact: { from: 'Library', to: 'Hand', controller: 'you', types: typeConstraint, cmc: cmcConstraint, annotations: [libraryAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'source',
      fact: { from: 'Graveyard', to: 'Hand', controller: 'you', types: typeConstraint, cmc: cmcConstraint, annotations: [graveyardAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Library', controller: 'you', types: typeConstraint, cmc: cmcConstraint, annotations: [libraryAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Graveyard', controller: 'you', types: typeConstraint, cmc: cmcConstraint, annotations: [graveyardAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
