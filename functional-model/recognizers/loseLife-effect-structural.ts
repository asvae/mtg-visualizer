// New recognizer (2026-09-16, card-results/fin-76-100 re-triage backlog item
// #1) — structural, direct sibling of `gainLife-effect-structural.ts` (same
// family, same "build a literal clause from the effect's own structured
// amount, require it verbatim" discipline): reads a real `kind:'loseLife'`
// `Effect` (`card.ts`: `{ kind: 'loseLife'; owner: EffectOwner; amount:
// Computed<number> }`) straight off `CardDefinition`
// (`structural-effects.ts`'s shared `allEffects` walker).
//
// **Real, whole-pool check done first** — grepped every real `kind:
// 'loseLife'` `Effect` across `functional-model/cards/*/definition.ts` (14
// real occurrences across 12 cards), then read each one's own real Forge
// oracle text directly via `forge-lookup.mjs` before writing anything:
//
//   - **`owner:'you'`, literal amount, RESOLUTION phrasing "you lose <N>
//     life"** — mirrors `gainLife-effect-structural.ts`'s own "you gain <N>
//     life" template exactly (base verb form, no `-s`: "you" always takes
//     the base form in English): `circle-of-power` ("you lose 2 life"),
//     `fang-fearless-l-cie` ("you lose 1 life"), `namazu-trader` ("you lose
//     1 life"), `summon-anima` (chapters I/II/III — one shared real line,
//     "I, II, III — Pain — You draw a card and you lose 1 life," same
//     "3 structurally-identical chapters, no exclusive line-claiming"
//     precedent `token-creation-structural.ts`'s own module doc comment
//     already establishes for a different Effect kind).
//   - **`owner:'you'`, literal amount, COST phrasing "Pay <N> life"** — a
//     genuinely DIFFERENT real English shape (no "you"/"lose" verb at
//     all — Magic's own activated-ability/keyword-cost templating is a
//     bare imperative): `dark-knight-s-greatsword` ("Equip—Pay 3 life"),
//     `ring-of-the-lucii` ("{2}, {T}, Pay 1 life:"). Tried SECOND, only when
//     the resolution phrasing above doesn't match — every real card in the
//     pool needs exactly one of the two templates, never both.
//     `elven-passage` ("{T}, Pay 1 life, Sacrifice this land:") and
//     `breeding-pool` ("you may pay 2 life," where the literal substring
//     "pay 2 life" still appears verbatim even though the real effect is
//     conditional/optional — a different, already-accepted behavioral
//     approximation that card's own `definition.ts` comment separately
//     documents) would ALSO match this same template, confirmed by direct
//     read of each one's own real Forge text, but NEITHER actually reaches
//     this recognizer (or any other) — `apply-recognizers.mjs`'s own real
//     loader has no checked-in oracle text for either under
//     `data/*/*_scryfall.json` at all (same "no oracle text available"
//     bucket every other recognizer in this catalog already accepts, e.g.
//     `token-creation-structural.ts`'s own `craterhoof-behemoth` case) —
//     confirmed directly, not assumed, by grepping both names across every
//     real `data/*/*_scryfall.json` file.
//   - **`owner:'opponents'`, literal amount, TARGETED phrasing "target
//     opponent loses <N> life"** — 3rd-person singular ("loses," not
//     "lose" — CR templating always treats "target opponent"/"each
//     opponent"/"each player" as grammatically singular): `al-bhed-
//     salvagers`, `sephiroth-fabled-soldier-sephiroth-one-winged-angel`
//     (BOTH real faces — the back face's own granted-emblem text repeats
//     the identical clause verbatim inside a quoted ability description,
//     matched independently by this recognizer's own plain text scan, same
//     "structural effect directly modeling a granted ability's real text"
//     precedent that card's own `definition.ts` already uses for the front
//     face's mirrored trigger). `controller:'opp'`, `targeted:true` —
//     matches `al-bhed-salvagers`'s own pre-existing hand-authored fact
//     shape exactly.
//   - **`owner:'opponents'`/`'each'`, literal amount, UNTARGETED phrasing —
//     bare "loses <N> life" with no "target" anywhere nearby** (a mass
//     "each opponent .../each player ..." clause, often mid-list, not
//     always even grammatically adjacent to "opponent"/"player" —
//     `malboro`'s own "each opponent discards a card, loses 2 life, and
//     exiles..." has "loses" directly after a COMMA, not after "opponent"
//     at all): `malboro` (`owner:'opponents'`), `summon-anima` chapter IV
//     ("Each opponent sacrifices a creature of their choice and loses 3
//     life," `owner:'opponents'`), `summon-primal-odin` chapter III ("Each
//     player loses 2 life," `owner:'each'`). `controller:'opp'` for
//     `owner:'opponents'`; for `owner:'each'` this recognizer follows
//     `summon-primal-odin`'s own PRE-EXISTING hand-authored fact convention
//     exactly (`controller:'you'` only, `targeted:false` — the opponent
//     half of an "each player" lifeloss stays uncaptured, a known, already-
//     established simplification this recognizer reproduces rather than
//     invents; NOT a new two-fact synthesis).
//   - **Non-literal `amount` (a `Computed<number>` closure)** —
//     `dark-confidant`'s own "You lose life equal to its mana value" — the
//     exact same wall `gainLife-effect-structural.ts`'s own module doc
//     comment already names for Omega, Heartless Evolution. Declines via
//     `'scope'`, no pattern built at all (never a `mismatch`).
//
// Fact shape: `{event:'lifeloss', controller, targeted?, annotations}` —
// matches this pool's own PRE-EXISTING hand-authored `lifeloss` fact
// convention exactly (`synergy.ts`'s own `Fact.controller` doc comment:
// "`lifeloss` is a real, documented EXCEPTION ... already uses `controller`
// to name who LOSES the life"), never a differently-shaped invention.
import type { Effect, EffectOwner } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'loseLife-effect-structural' as const;

type LoseLifeEffect = Extract<Effect, { kind: 'loseLife' }>;

function isLoseLifeEffect(e: Effect): e is LoseLifeEffect {
  return e.kind === 'loseLife';
}

/** The `Fact.controller` this effect's own `owner` maps to — see module doc
 * comment for why `'each'` deliberately reuses the SAME single-side
 * simplification `summon-primal-odin`'s own pre-existing hand-authored fact
 * already established, rather than synthesizing a second opponent-side
 * fact nobody has asked for. */
function controllerFor(owner: EffectOwner): 'you' | 'opp' {
  return owner === 'you' ? 'you' : owner === 'opponents' ? 'opp' : 'you';
}

/** One candidate match: a regex to try, plus whether a successful match
 * means this is a real CR 601.2c targeted claim (see module doc comment —
 * only ever `true` for the literal "target opponent" phrasing). */
interface Candidate {
  pattern: RegExp;
  targeted: boolean | undefined;
}

/** The real, closed candidate patterns this effect's own `owner`/`amount`
 * imply, tried in order — see module doc comment for the full real-pool
 * citation behind each branch. `undefined` when `amount` isn't a literal
 * number (a `Computed<number>` closure — opaque, can't read without
 * executing it). */
function buildCandidates(effect: LoseLifeEffect): Candidate[] | undefined {
  if (typeof effect.amount !== 'number') return undefined;
  const n = effect.amount;

  if (effect.owner === 'you') {
    return [
      { pattern: new RegExp(`\\byou lose\\s+${n}\\s+life\\b`, 'i'), targeted: undefined },
      { pattern: new RegExp(`\\bpay\\s+${n}\\s+life\\b`, 'i'), targeted: undefined },
    ];
  }

  // owner is 'opponents' or 'each' — 3rd-person singular "loses" only (see
  // module doc comment: "you lose" never applies here, so this can never
  // collide with the branch above).
  return [
    { pattern: new RegExp(`\\btarget opponent loses\\s+${n}\\s+life\\b`, 'i'), targeted: true },
    { pattern: new RegExp(`\\bloses\\s+${n}\\s+life\\b`, 'i'), targeted: false },
  ];
}

export function recognizeLoseLifeEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const loseLifeEffects = allEffects(input).map((o) => o.effect).filter(isLoseLifeEffect);
  if (loseLifeEffects.length === 0) {
    return { matched: false, reason: "no kind:'loseLife' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  let anyEligible = false;
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of loseLifeEffects) {
    const candidates = buildCandidates(effect);
    if (!candidates) {
      continue; // Computed<number> closure — opaque, never a 'mismatch'
    }
    anyEligible = true;
    const triggeredBy = triggeredByOf(effectSource.get(effect));

    let matchedCandidate: { m: RegExpExecArray; targeted: boolean | undefined } | undefined;
    for (const candidate of candidates) {
      const global = new RegExp(candidate.pattern.source, candidate.pattern.flags + 'g');
      const matches = [...input.oracleText.matchAll(global)];
      if (matches.length === 1) {
        matchedCandidate = { m: matches[0]!, targeted: candidate.targeted };
        break;
      }
      if (matches.length > 1) {
        return {
          matched: false,
          kind: 'mismatch',
          reason: `expected clause /${candidate.pattern.source}/ matched ${matches.length} times — ambiguous, declining rather than guessing which`,
        };
      }
    }
    if (!matchedCandidate) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `none of this effect's own confirmed candidate clauses (${candidates.map((c) => c.pattern.source).join(', ')}) were found verbatim in oracle text "${input.oracleText}"`,
      };
    }

    const start = matchedCandidate.m.index!;
    const end = start + matchedCandidate.m[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'source',
      fact: {
        event: 'lifeloss',
        controller: controllerFor(effect.owner),
        ...(matchedCandidate.targeted !== undefined ? { targeted: matchedCandidate.targeted } : {}),
        annotations: [annotation],
        ...(triggeredBy ? { triggeredBy } : {}),
      },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  if (!anyEligible) {
    return { matched: false, reason: 'every kind:"loseLife" Effect on this face was structurally out of scope (non-literal Computed<number> amount)' };
  }
  return { matched: true, facts };
}
