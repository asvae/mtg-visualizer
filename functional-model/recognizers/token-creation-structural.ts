// New recognizer (2026-09-15, `feedback_facts_must_be_recognizer_derived`
// follow-up — Aerith Rescue Mission's "Hero token ETB"/Battle Menu's "Knight
// token ETB" facts, both previously AI-authored with no `provenance`).
// Structural (`definition.ts`-based, not Forge-script-matching — same
// family as `destroy-effect-structural.ts`/`drawCard-effect-structural.ts`):
// reads a `kind:'createToken'` `Effect` directly and derives the real,
// unavoidable CR 111.7 consequence every token creation has — the token
// itself entering the battlefield — as an `event:'entersBattlefield'`
// SOURCE fact, `controller:'you'` (real, unconditional: `card.ts`'s own
// `case 'createToken'` always calls `actions.createToken(ctx.you, ...)`, no
// owner variant exists on this Effect kind at all).
//
// **The real, closed general rule** (checked against the whole pool's 34
// real `kind:'createToken'` occurrences, 2026-09-15): a token's own real
// printed clause is always some variant of "create <quantifier>[, <name>][
// tapped] [<P>/<T> ][<adjectives> ]<subtype-noun> [creature ]token(s)" — this
// recognizer builds a per-effect regex from the effect's OWN structured
// `amount`/`token`/`tapped` fields (never guessing at unmodeled fields —
// color, in particular, is NOT tracked anywhere on `TokenInfo`/`RealCard`,
// so this recognizer never asserts a color word) and tolerates every
// intervening real adjective/qualifier word (color, "legendary," "tapped")
// via non-greedy same-sentence gaps rather than trying to enumerate them —
// same "verify a real closed anchor, tolerate everything unconfirmed in
// between" discipline `move-effect-structural.ts`'s own `optional`/`notSelf`
// handling already established.
//
// **Two, and only two, real reasons a qualifying `createToken` effect
// declines** (both checked against the real, NAMED pool below, not a
// blanket "declines" bucket):
//   - **Non-literal `amount`** (`Computed<number>`, a closure) — no real
//     template for a formula-dependent quantity string (`moogles-valor`,
//     `rufus-shinra`, `the-final-days`, `the-wandering-minstrel` all
//     confirmed real cases: each one's own printed clause uses a
//     board-state-dependent count/conditional, e.g. "if you don't control a
//     creature named Darkstar," that no fixed English quantifier word could
//     represent honestly).
//   - **`effect.token` is not a `TOKENS.<key>` registry reference** — this
//     recognizer resolves the derived fact's `subject: {token: '<id>'}`
//     via REVERSE lookup against `tokens.ts`'s own shared `TOKENS` registry
//     (the only real, confirmed source of a token's own canonical id
//     string this pool has); an INLINE `TokenInfo` object literal (no
//     registry key) has no such id available, and this recognizer will
//     never invent one — real color IS part of several real cards' own
//     canonical Forge `TokenScript$` ids (`b_0_1_wizard_snipe`, per several
//     of these cards' own `definition.ts` comments), but color is not
//     tracked anywhere in this structural data, so no deterministic id can
//     be derived from the `Effect` alone. Confirmed real cases: `call-the-
//     mountain-chocobo`, `choco-comet`, `circle-of-power`, `cornered-by-
//     black-mages`, `gysahl-greens`, `kuja-genome-sorcerer-trance-kuja-
//     fate-defied`, `lindblum-industrial-regency-mage-siege`, `mysidian-
//     elder`, `queen-brahne`, `rinoa-heartilly`, `sidequest-raise-a-
//     chocobo-black-chocobo`, `summon-fat-chocobo`, `chocobo-racetrack` —
//     every one of these already has its own `definition.ts` comment
//     independently confirming the same "not in TOKENS, built inline"
//     reason, not a new finding this recognizer invented.
//
// **All-or-nothing per face, not per-effect** — same simplification
// `destroy-effect-structural.ts`/`move-effect-structural.ts` both make: a
// face with 2+ `createToken` effects (a Saga's chapters, e.g. `summon-
// knights-of-round`'s own 4 identical chapters) where ANY one can't resolve
// declines the whole face.
//
// **No exclusive-consumption line-claiming** (deliberately DIFFERENT from
// `move-effect-structural.ts`'s own `claimedLines` set) — a Saga's own
// repeated chapters (`summon-knights-of-round`) legitimately share the
// exact SAME printed clause/line across 4 structural effects; each one
// independently searches the WHOLE oracle text for its own pattern (real
// precedent: `dion-bahamut-s-dominant-bahamut-warden-of-light`'s own single
// real hand-authored fact already confirms 4 structurally-identical chapter
// effects collapse to exactly 1 real fact — `apply-recognizers.mjs`'s own
// shared runner-level `mergeRecognizedFactsByIdentity` pass does that
// collapsing, not this recognizer).
//
// **Real, whole-pool check confirming exactly 17 real matches** (2026-09-15):
// `aerith-rescue-mission`, `ancient-adamantoise`, `battle-menu`, `dion-
// bahamut-s-dominant-bahamut-warden-of-light` (front face), `dragoon-s-
// wyvern`, `dwarven-castle-guard`, `magic-pot`, `magitek-armor`, `namazu-
// trader`, `prompto-argentum`, `sidequest-hunt-the-mark-yiazmat-ultimate-
// mark`, `summon-knights-of-round`, `tellah-great-sage`, `the-crystal-s-
// chosen`, `thranduil-sindarin-liege-silvan-rally`, `undercity-dire-rat`,
// `zidane-tantalus-thief` — re-check this comment if a future card changes
// that count.
import type { Effect } from '../card';
import { TOKENS } from '../tokens';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'token-creation-structural' as const;

type CreateTokenEffect = Extract<Effect, { kind: 'createToken' }>;

function isCreateTokenEffect(e: Effect): e is CreateTokenEffect {
  return e.kind === 'createToken';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The real, canonical Forge token id this effect's own `token` object
 * resolves to — reverse lookup against `tokens.ts`'s own shared `TOKENS`
 * registry by REFERENCE (every real registry-backed card literally writes
 * `token: TOKENS.<key>`, the same object, never a structural copy), never
 * derived from the object's own fields (see module doc comment: color, part
 * of several real cards' own canonical id, isn't tracked here at all).
 * `undefined` for an inline `TokenInfo` literal with no matching registry
 * entry. */
function registryIdFor(token: CreateTokenEffect['token']): string | undefined {
  return Object.entries(TOKENS).find(([, v]) => v === token)?.[0];
}

/** The real, closed regex this effect's own structured data implies — see
 * module doc comment for the full rule and the two real decline reasons.
 * `undefined` when `amount` isn't a literal number 0-10 (no real card in
 * this pool needs a quantity above ten). */
function buildExpectedPattern(effect: CreateTokenEffect): RegExp | undefined {
  if (typeof effect.amount !== 'number') return undefined;
  const qtyWord = effect.amount === 1 ? '(?:a|an|one)' : NUMBER_WORDS[effect.amount];
  if (!qtyWord) return undefined;

  const token = effect.token;
  const isCreature = token.types.includes('Creature');
  const subtypeWords = token.types.filter((t) => t !== 'Legendary' && t !== 'Creature' && t !== 'Artifact');
  const noun = subtypeWords[subtypeWords.length - 1] ?? token.name;
  // A named Legendary token (Rinoa Heartilly's own "create Angelo, a
  // legendary 1/1 ... Dog creature token") prints its own proper name
  // BEFORE the generic quantifier phrase — tolerated as an optional prefix,
  // never required, since most tokens in this pool have no such name.
  const namePrefix = token.types.includes('Legendary') ? `(?:${escapeRegExp(token.name)}, )?` : '';

  const parts = [`\\bcreate ${namePrefix}${qtyWord}\\b`];
  if (isCreature) parts.push(`[^.]*?${escapeRegExp(String(token.basePower))}\\/${escapeRegExp(String(token.baseToughness))}`);
  parts.push(`[^.]*?\\b${escapeRegExp(noun)}s?\\b`);
  parts.push(`[^.]*?\\btokens?\\b`);
  return new RegExp(parts.join(''), 'i');
}

export function recognizeTokenCreationStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).filter(isCreateTokenEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no kind:'createToken' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  for (const effect of effects) {
    const tokenId = registryIdFor(effect.token);
    if (!tokenId) {
      return {
        matched: false,
        reason: `this face's own createToken effect uses an inline TokenInfo literal (${JSON.stringify(effect.token)}) with no matching TOKENS registry entry — no canonical id derivable (see module doc comment: color isn't tracked structurally)`,
      };
    }
    const pattern = buildExpectedPattern(effect);
    if (!pattern) {
      return {
        matched: false,
        reason: `a createToken effect on this face (${JSON.stringify(effect)}) has a non-literal or unconfirmed amount — no real fixed-quantifier template to verify (see module doc comment)`,
      };
    }
    const m = pattern.exec(input.oracleText);
    if (!m) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected pattern /${pattern.source}/ not found in oracle text "${input.oracleText}"`,
      };
    }
    const start = m.index;
    const end = m.index + m[0].length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: { token: tokenId }, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
