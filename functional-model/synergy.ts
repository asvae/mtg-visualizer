// Real, execution-VERIFIED synergy matching — v2. Supersedes the string-key
// `factsFor`/`staticFactsFor` model this file used to export (see
// SYNERGY_DESIGN.md, "design v2", for the full reasoning this rewrite is
// based on). Facts are no longer flat colon-strings joined by equality; they
// are attribute bags (see `Fact` below) AUTHORED BY AN AI reading a card's
// own `definition.ts` (cards/<slug>/synergy.json), not derived by script from a
// trace — a script can observe THAT a lambda reads `hasSubtype('Legendary')`
// but not WHY (pump vs. destroy have identical reads, opposite intent).
// scripts/verify-synergy.mjs reconciles the AI's facts against an
// instrumented trace.json in both directions; this module never runs a
// scenario itself.
//
// Type-only import of CardDefinition/Effect — this file still has zero
// RUNTIME dependency on card.ts (confirmed before adding the v1 version of
// this file, still true here), so it stays a one-way edge, no cycle, and
// stays cheap enough to import from a live server route without pulling in
// harness.ts/state.ts/layers.ts.
import type { CardDefinition } from './card';

// ---------------------------------------------------------------------------
// The fact model (SYNERGY_DESIGN.md "The fact model")

export type Side = 'you' | 'opp';

/** `has` = all of; `hasAny` = any of; `not` = none of. Grow only when a real card forces it. */
export interface TypeConstraint {
  has?: string[];
  hasAny?: string[];
  not?: string[];
}

export interface NumConstraint {
  min?: number;
  max?: number;
  eq?: number;
}

export interface NameConstraint {
  eq: string;
}

/** The fixed, small constraint vocabulary — appears on wants, and on a produce only where the effect itself is filtered (what it targets). */
export interface Constraints {
  types?: TypeConstraint;
  cmc?: NumConstraint;
  power?: NumConstraint;
  toughness?: NumConstraint;
  amount?: NumConstraint;
  name?: NameConstraint;
}

/** 1-5, computed mechanically (not authored by hand) — two independent dimensions of a fact's real significance, meant to be multiplied together (1-25) for a connection's total strength (see `factTotal`):
 *  - `ease` (produces AND wants): how many REAL givers this fact has — `matchCountForFact`'s raw match count against the pool, bucketed and INVERTED (more givers = lower score). 1 = nearly every card in the pool can satisfy it ("permanents on your battlefield" — true of almost anything), 5 = rare, only a handful of cards give it. Deliberately punishes broad-but-weak facts (you'll get those regardless of what you build around) in favor of rare, specific ones.
 *  - `strength` (produces ONLY — a want has no magnitude of its own, it inherits the matched produce's `strength` as `theirTotal`... no, `factTotal`, see below): real game-mechanical magnitude of the effect, steeply bucketed from the actual number in `trace.json` (tokens/counters/damage/life/cards — whatever the produce's own action carries), NOT linear: a 1-for-1 effect and a 2-for-1 effect are not "close" in power, so the bucketing jumps hard past 1 (e.g. magnitude 1 → 1, magnitude 2 → 4-5, magnitude 3+ → 5) rather than spreading evenly.
 * Both are a crude stand-in for real weighting (see SYNERGY_DESIGN.md's parked rarity-weighting note) — recompute if the pool changes meaningfully rather than trusting these to stay accurate. */
export type Weight = 1 | 2 | 3 | 4 | 5;

/** `'self'` = the card this synergy.json belongs to; `{token}` = a token, resolved from token-cards/<slug>/definition.ts's own definition the same way. */
export type Subject = 'self' | { token: string };

/** A persistent object in a zone. */
export interface ZoneFact extends Constraints {
  role: 'produces' | 'wants';
  zone: string;
  controller?: Side;
  /** Only meaningful on a `produces` fact — "the thing appearing in that zone is THIS." A `wants` fact instead uses the `Constraints` fields above directly to describe what it's looking for. */
  subject?: Subject;
  ease?: Weight;
  strength?: Weight;
  /** A short verbatim (or near-verbatim) snippet of the card's own oracle text this fact was derived from — purely documentary, read by nobody but a human looking at the Functional model table wondering "why does this card want that?" (FIN #16's "wants permanents on your battlefield" was the case that prompted this: unreadable without the source line). Not authored for every card — see progress.json's own textCoverageAudited flag for which cards have it. */
  sourceText?: string;
}

/** An occurrence. */
export interface EventFact extends Constraints {
  role: 'produces' | 'wants';
  event: string;
  controller?: Side;
  subject?: Subject;
  /** `'self'` = this same object; a bare `Constraints` = "whatever this effect's own filter is" (a produce) or "whatever the consumer itself must satisfy" (a want, always paired with `target: 'self'` — see matcher). */
  target?: 'self' | Constraints;
  /** Free-form event-specific fields a real card's own effect carries (Aerith's own `counterType: '+1/+1'`, e.g.) — not part of the fixed constraint vocabulary, matched by plain equality when both sides declare it. */
  counterType?: string;
  ease?: Weight;
  strength?: Weight;
  /** See `ZoneFact.sourceText`. */
  sourceText?: string;
}

/** A fact has either `zone` (a persistent object) or `event` (an occurrence) — never both. The matcher branches on which is present; do not unify them. */
export type Fact = ZoneFact | EventFact;

export function isZoneFact(fact: Fact): fact is ZoneFact {
  return 'zone' in fact;
}
export function isEventFact(fact: Fact): fact is EventFact {
  return 'event' in fact;
}

/** On-disk shape of cards/<slug>/synergy.json — role is implied by which array a fact sits in, so it's omitted from the stored data and reattached on load (see `loadCardFacts` in scripts/find-synergies.mjs and scripts/verify-synergy.mjs). AI-authored, tracked in git, never derived by script — see this file's own header. */
export interface SynergyFile {
  produces: Omit<Fact, 'role'>[];
  wants: Omit<Fact, 'role'>[];
}

// ---------------------------------------------------------------------------
// Static attribute resolution — a produce's `subject` (or a want's own
// implicit subject, the card itself) resolves to real CardDefinition/token
// attributes at MATCH time, never stored redundantly on the fact itself
// (SYNERGY_DESIGN.md: "Static card properties ... are NOT stored in facts").

export interface StaticAttrs {
  name: string;
  types: string[];
  cmc?: number;
  power?: number;
  toughness?: number;
}

/** The minimal shape a token definition needs for attribute resolution — `token-cards/<slug>/definition.ts` exports something at least this wide (see SYNERGY_DESIGN.md's "Tokens" section); not the full `TokenDefinition` shape (which also carries triggers/activated/keywords) since the matcher only ever reads static attributes off it. */
export interface TokenLike {
  name: string;
  typeLine: string;
  pt?: [power: number, toughness: number];
  cmc?: number;
}

/**
 * Real type line shape: "Supertype(s) Type(s) — Subtype(s)" (205.3a-c) —
 * everything after the em-dash is the real subtype list, space-separated;
 * "Legendary" is folded in as a plain type WORD the same pragmatic way
 * harness.ts's own `typesFromTypeLine`/`subtypesFromTypeLine` already do
 * (hasSubtype('Legendary') throughout this corpus, no real supertype field
 * anywhere in this model) — kept as a small local duplicate here rather than
 * imported from harness.ts, so this file stays free of harness.ts/state.ts's
 * runtime weight (see this file's own header).
 */
function typeWordsFromTypeLine(typeLine: string): string[] {
  const words: string[] = [];
  if (/\bCreature\b/.test(typeLine)) words.push('Creature');
  if (/\bArtifact\b/.test(typeLine)) words.push('Artifact');
  if (/\bEnchantment\b/.test(typeLine)) words.push('Enchantment');
  if (/\bLand\b/.test(typeLine)) words.push('Land');
  if (/\bPlaneswalker\b/.test(typeLine)) words.push('Planeswalker');
  if (/\bInstant\b/.test(typeLine)) words.push('Instant');
  if (/\bSorcery\b/.test(typeLine)) words.push('Sorcery');
  const subtypes = typeLine.split('—')[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
  words.push(...subtypes);
  if (/\bLegendary\b/.test(typeLine)) words.push('Legendary');
  return words;
}

export function staticAttrsFor(card: CardDefinition | TokenLike): StaticAttrs {
  return {
    name: card.name,
    types: typeWordsFromTypeLine(card.typeLine),
    cmc: card.cmc,
    power: card.pt?.[0],
    toughness: card.pt?.[1],
  };
}

/**
 * Resolves a `Subject` against the card the fact belongs to, or a token
 * registry for `{token}`. An OMITTED `subject` is deliberately NOT the same
 * as `'self'` — Gaius van Baelsar's own "each player sacrifices a
 * creature" produces `{zone:'Graveyard', controller:'you'}` with no
 * `subject` at all, because what lands in the graveyard is whichever
 * creature got sacrificed, not Gaius himself; resolving that to Gaius's own
 * attrs would wrongly let a type-constrained want (Fight On!'s own "wants
 * Graveyard CREATURES") match him even when the actual sacrificed object's
 * type is unknown. Returns undefined for both "no subject declared" and "a
 * {token} subject this registry doesn't (yet) know about" (before
 * token-cards/<slug>/ has been authored — see SYNERGY_DESIGN.md's "Tokens"
 * section: "the token-cards/ folder grows on demand") — either way, a caller
 * asking "what are its static attrs" gets "unknown," which the matcher
 * already treats as "matches only an unconstrained want" (see
 * `factsInteract`'s own `hasAnyConstraint` check).
 */
export function resolveSubject(subject: Subject | undefined, ownCard: CardDefinition, tokens: Record<string, TokenLike>): StaticAttrs | undefined {
  if (subject === 'self') return staticAttrsFor(ownCard);
  if (subject === undefined) return undefined;
  const token = tokens[subject.token];
  return token ? staticAttrsFor(token) : undefined;
}

// ---------------------------------------------------------------------------
// Constraint evaluation

function satisfiesType(types: string[], c: TypeConstraint | undefined): boolean {
  if (!c) return true;
  if (c.has && !c.has.every((t) => types.includes(t))) return false;
  if (c.hasAny && !c.hasAny.some((t) => types.includes(t))) return false;
  if (c.not && c.not.some((t) => types.includes(t))) return false;
  return true;
}
function satisfiesNum(value: number | undefined, c: NumConstraint | undefined): boolean {
  if (!c) return true;
  if (value === undefined) return false;
  if (c.min !== undefined && value < c.min) return false;
  if (c.max !== undefined && value > c.max) return false;
  if (c.eq !== undefined && value !== c.eq) return false;
  return true;
}
function satisfiesName(value: string | undefined, c: NameConstraint | undefined): boolean {
  if (!c) return true;
  return value === c.eq;
}

/** Every constraint field on `c` must hold against `attrs` — an absent field on `c` is vacuously satisfied (SYNERGY_DESIGN.md's "grow only when a real card forces it" — an unconstrained fact matches anything). */
export function satisfiesConstraints(attrs: StaticAttrs, c: Constraints): boolean {
  return satisfiesType(attrs.types, c.types) && satisfiesNum(attrs.cmc, c.cmc) && satisfiesNum(attrs.power, c.power) && satisfiesNum(attrs.toughness, c.toughness) && satisfiesName(attrs.name, c.name);
}

function sidesCompatible(a: Side | undefined, b: Side | undefined): boolean {
  return !a || !b || a === b;
}

/**
 * A fact that references `'self'` (a produce's `subject`, or an event's own
 * `target: 'self'`) is implicitly about the CASTER's own side even when
 * `controller` itself is omitted (SYNERGY_DESIGN.md's own Aerith facts #4/
 * #5/#7/#8 all omit `controller` — "puts counters on ITSELF" has no other
 * sensible side). Without this, a fully-omitted-controller fact would fall
 * back to `sidesCompatible`'s wildcard and wrongly match an OPPONENT-side
 * effect (Braska's Final Aeon's own chapter III forces an opponent's
 * creature to die — that must never satisfy another card's own "I want to
 * die" want just because both facts happen to omit `controller`). A fact
 * that references nothing self-shaped (Overkill's own unconstrained
 * `{event:'dies'}`, e.g.) keeps the true wildcard.
 */
function effectiveController(fact: Fact): Side | undefined {
  if (fact.controller) return fact.controller;
  if (isZoneFact(fact)) return fact.subject === 'self' ? 'you' : undefined;
  return (fact as EventFact).target === 'self' ? 'you' : undefined;
}

function constraintsOf(fact: Constraints): Constraints {
  const { types, cmc, power, toughness, name } = fact;
  return { types, cmc, power, toughness, name };
}
function hasAnyConstraint(c: Constraints): boolean {
  return !!(c.types || c.cmc || c.power || c.toughness || c.name);
}

// ---------------------------------------------------------------------------
// The matcher (SYNERGY_DESIGN.md "Step 6 — matcher")

export interface PoolCard {
  name: string;
  card: CardDefinition;
  produces: Fact[];
  wants: Fact[];
}

export type SelfInteractionKind = 'same-instance' | 'second-copy' | 'second-copy-legendary';

/** `fact.ease * (fact.strength ?? 1)` (1-25) — total connection strength for one side of a match (see `Weight`'s own doc comment). `strength` is neutral (1) on a `wants` fact by design (a want has no magnitude of its own — only `ease`, "how rare is this requirement," carries meaning there); on a `produces` fact missing `strength` it's still treated as 1, not `null` — a real, computed absence would mean the effect has no measurable magnitude at all. `null` only if `ease` itself is missing (a fact predating these fields). */
export function factTotal(fact: Fact): number | null {
  if (!fact.ease) return null;
  return fact.ease * (fact.strength ?? 1);
}

export interface InteractionMatch {
  card: string;
  /** Present only when `card` names THIS SAME card — the pair (A, A), computed and kept like any other match, never dropped (SYNERGY_DESIGN.md "Self-interactions"). */
  selfInteraction?: SelfInteractionKind;
  /** `factTotal` of the OTHER side's specific fact that satisfied this match (the group's own `fact` is `mine`'s side — see `InteractionGroup`) — a caller wanting this match's full two-sided strength combines both (e.g. `Math.sqrt(mine * theirs)`), not just `mine` alone. `null` if that fact predates the weight fields. */
  theirTotal: number | null;
}

export interface InteractionGroup {
  /** Which side of this fact `cardName` is on — `'produces'` means this card provides the thing, `'wants'` means it benefits from it. */
  direction: 'produces' | 'wants';
  fact: Fact;
  /** The set of attributes this fact actually constrains (SYNERGY_DESIGN.md: "Derivable from the fact; no labels in the data layer") — `['zone','controller','types']` for a type-gated zone want, `['event']` for a bare "lifegain" hook, etc. */
  theme: string[];
  description: string;
  matches: InteractionMatch[];
}

function factKind(fact: Fact): string {
  return isZoneFact(fact) ? `zone:${fact.zone}` : `event:${(fact as EventFact).event}`;
}

/** Theme = the set of attributes a want (or a produce's own filter) actually constrains — no separate label vocabulary, just which fields are present. */
export function themeOf(fact: Fact): string[] {
  const theme = [factKind(fact).split(':')[0]!];
  if (fact.controller) theme.push('controller');
  if (fact.types) theme.push('types');
  if (fact.cmc) theme.push('cmc');
  if (fact.power) theme.push('power');
  if (fact.toughness) theme.push('toughness');
  if (fact.name) theme.push('name');
  if (isEventFact(fact) && fact.counterType) theme.push('counterType');
  return theme;
}

function describeSide(side: Side | undefined): string {
  return side === 'you' ? 'your' : side === 'opp' ? "an opponent's" : 'a';
}

/** Zone-appropriate noun for an unconstrained zone fact — "permanents on your battlefield," not "things on your battlefield." */
const ZONE_NOUN: Record<string, string> = {
  Battlefield: 'permanents',
  Graveyard: 'cards',
  Hand: 'cards',
  Library: 'cards',
  Exile: 'cards',
  Stack: 'spells',
};

/** Human-readable text for a fact — the Interactions panel's own `description` field, parsed straight off the same structured fields the matcher itself reads (no separate hand-written label table to keep in sync). */
export function describeFact(fact: Fact): string {
  const constraintBits: string[] = [];
  if (fact.types?.has) constraintBits.push(fact.types.has.join(' '));
  if (fact.types?.hasAny) constraintBits.push(`(${fact.types.hasAny.join('/')})`);
  if (fact.cmc) constraintBits.push(`mana value ${fact.cmc.min ?? ''}${fact.cmc.max !== undefined ? `-${fact.cmc.max}` : ''}${fact.cmc.eq !== undefined ? `=${fact.cmc.eq}` : ''}`.trim());
  const qualifier = constraintBits.length ? `${constraintBits.join(' ')} ` : '';
  if (isZoneFact(fact)) {
    const noun = ZONE_NOUN[fact.zone] ?? 'things';
    const prep = fact.zone === 'Battlefield' ? 'on' : 'in';
    return `${qualifier}${qualifier ? '' : `${noun} `}${prep} ${describeSide(fact.controller)} ${fact.zone.toLowerCase()}`;
  }
  const event = fact.event;
  if (event === 'lifegain') return `${describeSide(fact.controller)} life gain`;
  if (event === 'dies') return fact.target === 'self' ? 'dying' : `${describeSide(fact.controller)} creature dying`;
  if (event === 'putCounter') return `${fact.counterType ?? ''} counters${fact.target === 'self' ? ' on itself' : ''}`.trim();
  return `${qualifier}${event}`;
}

function selfInteractionKind(fact: Fact, card: PoolCard): SelfInteractionKind {
  if (isEventFact(fact)) return 'same-instance';
  return typeWordsFromTypeLine(card.card.typeLine).includes('Legendary') ? 'second-copy-legendary' : 'second-copy';
}

/** Does producer fact `p` (belonging to `pCard`) satisfy wanter fact `w` (belonging to `wCard`)? Symmetric to how it's invoked — `mine`/`mineRole` decide which side `p`/`w` actually is. Module-level (not nested in `findInteractionsForCard`) so `matchCountForFact` below can reuse the exact same real matching logic rather than a re-derived approximation. */
function factsInteract(mine: Fact, mineCard: PoolCard, mineRole: 'produces' | 'wants', theirs: Fact, theirCard: PoolCard, tokens: Record<string, TokenLike>): boolean {
  const p = mineRole === 'produces' ? mine : theirs;
  const pCard = mineRole === 'produces' ? mineCard : theirCard;
  const w = mineRole === 'produces' ? theirs : mine;
  const wCard = mineRole === 'produces' ? theirCard : mineCard;
  if (isZoneFact(p) !== isZoneFact(w)) return false;
  if (!sidesCompatible(effectiveController(p), effectiveController(w))) return false;

  if (isZoneFact(p) && isZoneFact(w)) {
    if (p.zone !== w.zone) return false;
    const wantConstraints = constraintsOf(w);
    if (!hasAnyConstraint(wantConstraints)) return true;
    const attrs = resolveSubject(p.subject, pCard.card, tokens);
    return !!attrs && satisfiesConstraints(attrs, wantConstraints);
  }

  const pe = p as EventFact;
  const we = w as EventFact;
  if (pe.event !== we.event) return false;
  if (pe.counterType && we.counterType && pe.counterType !== we.counterType) return false;

  // "A want with target: 'self' on the consumer side matches a produce
  // whose target filter the consumer card satisfies" (SYNERGY_DESIGN.md).
  if (we.target === 'self') {
    if (pe.target === undefined) return true;
    if (pe.target === 'self') return pCard.name === wCard.name; // same-instance only
    return satisfiesConstraints(staticAttrsFor(wCard.card), pe.target);
  }
  // A want with a `Constraints` target (rare — none of today's cards need
  // it) checks the PRODUCER'S subject the same way a zone want does.
  if (we.target && typeof we.target === 'object') {
    const attrs = resolveSubject(pe.subject, pCard.card, tokens);
    return !!attrs && satisfiesConstraints(attrs, we.target);
  }
  // Neither side names a target — a bare event hook (lifegain, e.g.).
  return true;
}

/** Real match count for ONE fact against `pool` — how many (other-card, other-fact) pairs actually satisfy it via the real matcher (`factsInteract`), self-interactions included, UNFILTERED (unlike `findInteractionsForCard`, a fact with zero matches still returns 0 rather than being dropped). This is what `ease` (see `Weight`'s doc comment) is computed from — "how many givers does this fact have," not a string-key shape heuristic. */
export function matchCountForFact(fact: Fact, factCard: PoolCard, role: 'produces' | 'wants', pool: PoolCard[], tokens: Record<string, TokenLike> = {}): number {
  let count = 0;
  for (const other of pool) {
    const otherFacts = role === 'produces' ? other.wants : other.produces;
    for (const theirs of otherFacts) {
      if (factsInteract(fact, factCard, role, theirs, other, tokens)) count++;
    }
  }
  return count;
}

/** Every interaction `cardName` participates in, across `pool` (every card's own facts, itself included — self-interactions are a real, kept output, not filtered out). `tokens` resolves `{token}` subjects; omit for a card set with no token-producing effects yet. */
export function findInteractionsForCard(cardName: string, pool: PoolCard[], tokens: Record<string, TokenLike> = {}): InteractionGroup[] {
  const self = pool.find((p) => p.name === cardName);
  if (!self) return [];

  const groups: InteractionGroup[] = [];

  function matchOne(mine: Fact, mineCard: PoolCard, mineRole: 'produces' | 'wants'): InteractionGroup | null {
    const matches: InteractionMatch[] = [];
    for (const other of pool) {
      const otherFacts = mineRole === 'produces' ? other.wants : other.produces;
      for (const theirs of otherFacts) {
        if (factsInteract(mine, mineCard, mineRole, theirs, other, tokens)) {
          const isSelf = other.name === mineCard.name;
          matches.push({ card: other.name, selfInteraction: isSelf ? selfInteractionKind(mine, mineCard) : undefined, theirTotal: factTotal(theirs) });
        }
      }
    }
    if (!matches.length) return null;
    return { direction: mineRole, fact: mine, theme: themeOf(mine), description: describeFact(mine), matches };
  }

  for (const fact of self.produces) {
    const group = matchOne(fact, self, 'produces');
    if (group) groups.push(group);
  }
  for (const fact of self.wants) {
    const group = matchOne(fact, self, 'wants');
    if (group) groups.push(group);
  }
  return groups;
}
