// New recognizer (2026-09-16, card-results/fin-51-75 triage backlog item #1
// — "biggest win", 17 real pool cards). Structural — reads a face's own
// `kind:'sacrifice'` `Effect[]` directly (never oracle text for STRUCTURE),
// same family as `destroy-effect-structural.ts`. Distinct from
// `sacrificeCostNamedType-structural.ts` (which reads `activationCost`
// TEXT for a "Sacrifice a/an <NamedType>" cost clause) — this one reads
// the RESOLUTION `Effect` shape (`owner`/`validType`/`notSelf`/`qty`/
// `optional`), even when that effect happens to be modeled purely for
// trace visibility alongside a colon-activated cost (same convention
// `phantom-train`'s own module doc comment documents: "Sac cost modeled as
// the first effect purely so the trace shows it happening").
//
// **`owner` restricted to `'you'` — same unconfirmed-shape decline
// `destroy-effect-structural.ts`'s own module doc comment already
// establishes for its identically-named field.** Checked directly: NO
// real hand-authored `event:'sacrifice'` ACT fact anywhere in this pool
// combines a non-`'you'` owner with a `controller`/no-controller shape
// today (grepped every real `"event": "sacrifice"` fact pool-wide before
// writing this recognizer at all). `cornered-by-black-mages`
// (`'opponents'`), `gaius-van-baelsar` (`'each'`, 3 modes), `jecht-
// reluctant-guardian-braska-s-final-aeon`'s own back face chapterIII
// (`'opponents'`), `kefka-court-mage-kefka-ruler-of-ruin`'s own activated
// ability (`'opponents'`), `summon-anima`'s own chapterIV (`'opponents'`),
// and `zodiark-umbral-god` (`'each'`, also a non-literal `Computed<number>`
// qty) all decline via `'scope'` for this reason — a real, useful future
// win (this is exactly the "Each opponent/player sacrifices N <type> of
// their choice" template), just not one with a confirmed Fact convention
// to build toward yet.
//
// **Real, whole-pool check, every `owner:'you'` occurrence** (11 real
// cards/effects; grepped `functional-model/cards/*/definition.ts` first,
// then read each one's own real Scryfall oracle text directly):
//   - **TEMPLATE 1 — "Sacrifice (a|an|another) <TypeWord>[ or <TypeWord2>]"
//     (unconditional; `optional` absent) or "[Yy]ou may sacrifice (a|an|
//     another) <TypeWord>[ or <TypeWord2>]. If you do,"** (`optional:
//     true`) — `notSelf:true` maps to the word "another"; `notSelf`
//     absent maps to a bare `(?:a|an)` article (checked: every real
//     `notSelf:true` card's own text uses "another," every real card
//     without it uses "a"/"an," confirmed, never guessed either way).
//     `validType:'creature-or-artifact'` is a real, closed 2-word
//     compound whose PRINTED WORD ORDER genuinely varies card to card —
//     checked both orders directly rather than assuming one:
//       - "creature or artifact": `ahriman` (another, cost-embedded, no
//         optional — "{3}, Sacrifice another creature or artifact: Draw a
//         card."), `namazu-trader` (another, optional — "you may sacrifice
//         another creature or artifact. If you do, surveil 2."),
//         `reno-and-rude` (another, optional), `sidequest-hunt-the-mark-
//         yiazmat-ultimate-mark`'s own back face (another, cost-embedded,
//         no optional).
//       - "artifact or creature": `phantom-train` (another, cost-embedded
//         — "Sacrifice another artifact or creature: Put a +1/+1
//         counter..."), `midgar-city-of-mako-reactor-raid`'s own back
//         face (no notSelf, optional — "You may sacrifice an artifact or
//         creature. If you do, draw two cards."), `vayne-s-treachery`
//         (no notSelf, no optional, embedded after "Kicker—": "Kicker—
//         Sacrifice an artifact or creature.").
//     Single-type `validType:'creature'`: `sephiroth-fabled-soldier-
//     sephiroth-one-winged-angel`'s own front face (another, optional —
//     "you may sacrifice another creature. If you do, draw a card.").
//   - **TEMPLATE 2 — self-subtype, "sacrifice this <SubtypeWord>"** (no
//     target CHOICE at all — the printed subtype word from this face's own
//     type line, same closed real-Magic self-reference vocabulary "this
//     Aura"/"this Equipment"/"this Vehicle" already established elsewhere
//     in this pool, e.g. `phantom-train`'s own definition.ts comment on
//     why `sacrificeCostNamedType-structural.ts` declines "Sacrifice this
//     <type>" rather than trying to generalize it): `sleep-magic`
//     (`validType:'enchantment'`, its own type line's subtype is "Aura" —
//     real text: "When enchanted creature is dealt damage, sacrifice this
//     Aura." — matches this card's own PRE-EXISTING hand-authored
//     `{event:'sacrifice', subject:'self', target:'self'}` fact exactly).
//     Tried only when TEMPLATE 1 doesn't match (TEMPLATE 2 requires a
//     face-typeLine subtype word, which most `owner:'you'` cards using a
//     generic `validType` don't have any special reason to reference by
//     itself) — see `buildCandidates` below for the exact trial order.
//   - **Declined, real, checked-not-guessed reasons**:
//     - `louisoix-s-sacrifice`: `validType:'creature'`, real text is
//       "sacrifice A LEGENDARY CREATURE" — the built phrase "sacrifice a
//       creature" is a real prefix but the very next word is "legendary,"
//       not "creature," so this correctly declines via `kind:'mismatch'`
//       (this card's own PRE-EXISTING hand-authored fact already
//       documents the narrower `types:{has:['Legendary','Creature']}`
//       claim — a genuine, accepted, already-known structural
//       under-approximation, same class `destroy-effect-structural.ts`'s
//       own `minPower`/`validType` combinations document). Suppressed via
//       `// recognizer-exception: sacrifice-effect-structural`.
//     - `quina-qu-gourmet`: `validType:'creature'`, `notSelf:true` — but
//       the real cost text is "Sacrifice A FROG" (a NAMED creature type,
//       not the generic word "creature"), already fully covered by
//       `sacrificeCostNamedType-structural.ts`. Both the "another
//       creature" and "a/an creature" candidates correctly fail to match
//       verbatim, so this declines via `kind:'mismatch'`. Suppressed via
//       its own `// recognizer-exception:` marker.
//     - `sephiroth-fabled-soldier-sephiroth-one-winged-angel`'s own back
//       face: `qty` is a `Computed<number>` closure
//       (`ctx.triggerInput?.sacCount`) — declines via `'scope'`, no
//       template ever built, no marker needed.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, TEMPLATE 1 only — TEMPLATE 2's self-subtype branch never builds a
// sink at all, nothing to split there): the sink used to reuse the SAME
// whole-clause span as the paired SOURCE fact ("Sacrifice another creature
// or artifact," verb included, or the "You may ... . If you do," wrapper
// for the optional shape) — the sink only actually claims "a permanent of
// this type exists," not the sacrifice action itself. `template1Candidates`
// now wraps `[Ss]acrifice`/`sacrifice` (the bare verb) in its own capturing
// group (source) and the object phrase ("another creature or artifact"/
// "a/an <type>") in a second, separate one (sink) — same split
// `sacrificeCostNamedType-structural.ts`'s own confirmed fix already
// establishes for a different (cost-text, not resolution-Effect) real
// clause shape.
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'sacrifice-effect-structural' as const;

type SacrificeEffect = Extract<Effect, { kind: 'sacrifice' }>;

function isSacrificeEffect(e: Effect): e is SacrificeEffect {
  return e.kind === 'sacrifice';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TYPE_WORD: Partial<Record<SacrificeEffect['validType'], string>> = {
  creature: 'creature',
  artifact: 'artifact',
  enchantment: 'enchantment',
};

/** The closed set of real object-phrase candidates this effect's own
 * `validType` implies — `'creature-or-artifact'` genuinely varies in
 * printed word order card to card (see module doc comment), so BOTH
 * orders are always offered as separate candidates rather than picking
 * one; every other `validType` has exactly one real word. `undefined`
 * (never guessed) for `'any'`/`'creature-or-artifact-or-...'` shapes with
 * no confirmed real card in this pool. */
function objectPhraseCandidates(effect: SacrificeEffect): string[] | undefined {
  if (effect.validType === 'creature-or-artifact') return ['creature or artifact', 'artifact or creature'];
  const word = TYPE_WORD[effect.validType];
  return word ? [word] : undefined;
}

/** TEMPLATE 1 candidate patterns — see module doc comment. `notSelf:true`
 * requires the word "another"; otherwise a bare `(?:a|an)` article
 * (checked directly against every real card either way, never assumed).
 * `optional:true` requires the "[Yy]ou may ... . If you do," wrapper. */
function template1Candidates(effect: SacrificeEffect): RegExp[] {
  const phrases = objectPhraseCandidates(effect);
  if (!phrases) return [];
  const article = effect.notSelf ? 'another' : '(?:a|an)';
  return phrases.map((phrase) => {
    // 2 capturing groups — group 1 the bare "Sacrifice"/"sacrifice" verb
    // (anchors the SOURCE fact), group 2 the object phrase ("another
    // creature or artifact"/"a/an <type>", anchors the SINK fact) — see
    // module doc comment's own "2026-09-16 SOURCE/SINK span-narrowing fix"
    // section.
    const clause = `([Ss]acrifice) (${article} ${escapeRegExp(phrase)})`;
    if (effect.optional) {
      // Boundary: a period immediately after the object phrase, then "If
      // you do," (case-insensitive) — a tight, high-confidence anchor, not
      // just "may" appearing somewhere nearby.
      return new RegExp(`\\b(?:Y|y)ou may ${clause}\\. If you do,`, 'd');
    }
    // Non-optional (often cost-embedded): a colon, comma, period, newline,
    // end-of-string, or the coordinating " and " conjunction (same
    // accepted-boundary set `drawCard-effect-structural.ts`/`discard-
    // effect-structural.ts` already establish for this exact family of
    // clause).
    return new RegExp(`\\b${clause}\\b(?=[.\\n:,]| and |$)`, 'd');
  });
}

/** TEMPLATE 2 — self-subtype "sacrifice this <SubtypeWord>" (see module
 * doc comment). Only tried when this face's own type line has at least
 * one real printed subtype word (after the em dash). */
function template2Candidates(typeLine: string): RegExp[] {
  const subtypes = typeLine.split('—')[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
  return subtypes.map((word) => new RegExp(`\\bsacrifice this ${escapeRegExp(word)}\\b`, 'i'));
}

function buildTargetConstraint(effect: SacrificeEffect): Constraints | undefined {
  const constraints: Constraints = {};
  if (effect.validType === 'creature-or-artifact') constraints.types = { hasAny: ['Creature', 'Artifact'] };
  else {
    const word = TYPE_WORD[effect.validType];
    if (word) constraints.types = { has: [word.charAt(0).toUpperCase() + word.slice(1)] };
  }
  if (effect.notSelf) (constraints as Constraints & { excludeSelf?: boolean }).excludeSelf = true;
  return Object.keys(constraints).length > 0 ? constraints : undefined;
}

export function recognizeSacrificeEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const sacrificeEffects = allEffects(input).map((o) => o.effect).filter(isSacrificeEffect);
  if (sacrificeEffects.length === 0) {
    return { matched: false, reason: "no kind:'sacrifice' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of sacrificeEffects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    if (effect.owner !== 'you') {
      return { matched: false, reason: `owner:'${effect.owner}' — no confirmed Fact-shape for a non-'you' owner (see module doc comment)` };
    }
    if (effect.qty !== undefined && typeof effect.qty !== 'number') {
      return { matched: false, reason: 'qty is a Computed<number> closure — opaque, can\'t read without executing it' };
    }
    if (typeof effect.qty === 'number' && effect.qty !== 1) {
      return { matched: false, reason: `qty ${effect.qty} — no real qty>1 card to verify plural templating against` };
    }

    const candidates = [
      ...template1Candidates(effect).map((pattern) => ({ pattern, selfSubtype: false })),
      ...template2Candidates(input.typeLine).map((pattern) => ({ pattern, selfSubtype: true })),
    ];
    if (candidates.length === 0) {
      return { matched: false, reason: `a sacrifice effect on this face (${JSON.stringify(effect)}) has no confirmed structural→text template` };
    }

    let winner: { pattern: RegExp; selfSubtype: boolean; match: RegExpMatchArray & { indices?: Array<[number, number] | undefined> } } | undefined;
    let totalMatches = 0;
    for (const candidate of candidates) {
      const global = new RegExp(candidate.pattern.source, candidate.pattern.flags + 'g');
      const matches = [...input.oracleText.matchAll(global)] as Array<RegExpMatchArray & { indices?: Array<[number, number] | undefined> }>;
      totalMatches += matches.length;
      if (matches.length === 1 && !winner) winner = { ...candidate, match: matches[0]! };
    }
    if (!winner || totalMatches !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `tried [${candidates.map((c) => c.pattern.source).join(', ')}] against oracle text "${input.oracleText}" — ${totalMatches} total match(es) (want exactly 1)`,
      };
    }

    const start = winner.match.index!;
    const end = start + winner.match[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }

    if (winner.selfSubtype) {
      facts.push({
        role: 'source',
        fact: { event: 'sacrifice', subject: 'self', target: 'self', annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
        provenance: { origin: 'parser', rule: RULE },
      });
      continue;
    }

    // TEMPLATE 1 only: group 2 is the object phrase (see
    // `template1Candidates`'s own doc comment) — narrows the paired SINK's
    // own annotation, while SOURCE keeps the full matched clause above
    // (2026-09-16 SOURCE/SINK span-narrowing fix, see module doc comment).
    const [objectStart, objectEnd] = winner.match.indices![2]!;
    const objectAnnotation = toLineOffset(input.oracleText, objectStart, objectEnd);
    if (!objectAnnotation) {
      return { matched: false, reason: `matched object-phrase span [${objectStart},${objectEnd}) did not resolve to a single real oracle-text line` };
    }

    const target = buildTargetConstraint(effect);
    facts.push({
      role: 'source',
      fact: {
        event: 'sacrifice',
        from: 'Battlefield',
        to: 'Graveyard',
        controller: 'you',
        ...(target ? { target } : {}),
        targeted: true,
        annotations: [annotation],
        ...(triggeredBy ? { triggeredBy } : {}),
      },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', ...(target ?? {}), annotations: [objectAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
