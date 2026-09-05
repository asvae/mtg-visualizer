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

/** The fixed, small constraint vocabulary — appears on a sink fact, and on a source fact only where the effect itself is filtered (what it targets). */
export interface Constraints {
  types?: TypeConstraint;
  cmc?: NumConstraint;
  power?: NumConstraint;
  toughness?: NumConstraint;
  amount?: NumConstraint;
  name?: NameConstraint;
}

/** 1-5, computed mechanically (not authored by hand) — real game-mechanical magnitude of a fact, steeply bucketed from the actual number involved (NOT linear: a 1-for-1 effect and a 2-for-1 effect are not "close" in power, so the bucketing jumps hard past 1 — magnitude 1 → 1, magnitude 2 → 4-5, magnitude 3+ → 5 — rather than spreading evenly):
 *  - on a `source` fact: the real number from `trace.json` (tokens/counters/damage/life/cards — whatever the source's own action carries).
 *  - on a `sink` fact: the fact's own declared `amount` constraint (e.g. "wants 3+ creatures" → 3) — no trace involved, it's a static requirement, not an action. A sink with no numeric constraint (most bare event hooks — "wants lifegain," no minimum) has no magnitude concept and stays unset (`factTotal` treats missing as neutral 1, same as a source with no measurable magnitude).
 * Previously paired with a second `ease` (rarity) dimension; dropped in favor of `value` alone on both sides — see git history for the retired rationale. A crude stand-in for real weighting (see SYNERGY_DESIGN.md's parked rarity-weighting note) — recompute if the pool changes meaningfully rather than trusting these to stay accurate. Renamed from `strength` (2026-09-05) — collided with d3-force's own unrelated `.strength()` API/graphRenderer.ts's physics terminology; `power` was tried next but collides with `Constraints.power` (a creature's real power stat), so this landed on `value` instead. */
export type Weight = 1 | 2 | 3 | 4 | 5;

/** `'self'` = the card this synergy.json belongs to; `{token}` = a token, resolved from token-cards/<slug>/definition.ts's own definition the same way. */
export type Subject = 'self' | { token: string };

/** A persistent object in a zone. */
export interface ZoneFact extends Constraints {
  role: 'source' | 'sink';
  /** Stable per-card identity — unique among THIS card's own facts only (not pool-wide), author-chosen (e.g. `"exile"`, `"return-enters"`). Required going forward; older cards authored before this field existed won't actually have it on disk despite the type (a plain JSON cast, not runtime-validated) — a caller keying off `id` should still tolerate `undefined` in practice. Lets a caller (the card page's Functional model table, `annotateCardText`'s own hover wiring) key off something stable instead of re-deriving an identity from `role`/`sourceText`/`description`, which breaks the moment two facts share all three. */
  id: string;
  zone: string;
  controller?: Side;
  /** Only meaningful on a `source` fact — "the thing appearing in that zone is THIS." A `sink` fact instead uses the `Constraints` fields above directly to describe what it's looking for. */
  subject?: Subject;
  value?: Weight;
  /** A short verbatim (or near-verbatim) snippet of the card's own oracle text this fact was derived from — purely documentary, read by nobody but a human looking at the Functional model table wondering "why does this card want that?" (FIN #16's "wants permanents on your battlefield" was the case that prompted this: unreadable without the source line). Not authored for every card — see progress.json's own textCoverageAudited flag for which cards have it. */
  sourceText?: string;
  /** The exact substring of `sourceText` that names THIS fact specifically, for `annotateCardText`'s inline card-text view — AI-authored per fact, same as `sourceText` itself, NOT derived by a generic per-event-kind regex (a regex like "draws? a card" can't tell which of several "draw a card" clauses on one card is this fact's own, especially once conditions/exceptions are in play; the author reading the real card text can). Must be a literal substring of `sourceText` — `annotateCardText` verifies this and silently skips the fact (no inline link, still visible in the plain facts table) if it isn't. */
  highlight?: string;
}

/** An occurrence. */
export interface EventFact extends Constraints {
  role: 'source' | 'sink';
  /** See `ZoneFact.id`. */
  id: string;
  event: string;
  controller?: Side;
  subject?: Subject;
  /** `'self'` = this same object; a bare `Constraints` = "whatever this effect's own filter is" (a produce) or "whatever the consumer itself must satisfy" (a want, always paired with `target: 'self'` — see matcher). */
  target?: 'self' | Constraints;
  /** Free-form event-specific fields a real card's own effect carries (Aerith's own `counterType: '+1/+1'`, e.g.) — not part of the fixed constraint vocabulary, matched by plain equality when both sides declare it. */
  counterType?: string;
  /** Documentary only — this event's own trigger/activation is capped to once per turn on the real card (e.g. Elrond's draw-per-activation), but nothing in state.ts/turn.ts enforces that cap yet (see progress.json's knownGaps). Not matched against anything. */
  oncePerTurn?: boolean;
  value?: Weight;
  /** See `ZoneFact.sourceText`. */
  sourceText?: string;
  /** See `ZoneFact.highlight`. */
  highlight?: string;
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
  source: Omit<Fact, 'role'>[];
  sink: Omit<Fact, 'role'>[];
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
  source: Fact[];
  sink: Fact[];
}

export type SelfInteractionKind = 'same-instance' | 'second-copy' | 'second-copy-legendary';

/** `fact.value` (1-5) — `compute-weights.mjs` writes an explicit value on EVERY fact it processes, source and sink alike, `1` (neutral) when the fact has no measurable magnitude (a bare event hook, an unquantified want) rather than leaving it unset. So `undefined` here only means "this fact predates the weight fields entirely" (never run through `compute-weights.mjs`) — genuinely unknown, not neutral — and stays `null` rather than being coerced to 1. A caller wanting a match's full two-sided value combines both sides' `factTotal` (see `server/api/graph-links.ts`'s `combinedWeight` — plain product, per-side range 1-5, combined range 1-25). */
export function factTotal(fact: Fact): number | null {
  return fact.value ?? null;
}

export interface InteractionMatch {
  card: string;
  /** Present only when `card` names THIS SAME card — the pair (A, A), computed and kept like any other match, never dropped (SYNERGY_DESIGN.md "Self-interactions"). */
  selfInteraction?: SelfInteractionKind;
  /** `factTotal` of the OTHER side's specific fact that satisfied this match (the group's own `fact` is `mine`'s side — see `InteractionGroup`) — a caller wanting this match's full two-sided value combines both (e.g. `Math.sqrt(mine * theirs)`), not just `mine` alone. `null` if that fact predates the weight fields. */
  theirTotal: number | null;
}

export interface InteractionGroup {
  /** Which side of this fact `cardName` is on — `'source'` means this card provides the thing, `'sink'` means it benefits from it. */
  direction: 'source' | 'sink';
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

/** Constraint words off any `Constraints`-shaped object — factored out so both a fact's own fields AND an event fact's `target` (a separate constraint holder, not the fact's own filter) can share it. */
function constraintBits(c: Constraints): string[] {
  const bits: string[] = [];
  if (c.types?.has) bits.push(c.types.has.join(' '));
  if (c.types?.hasAny) bits.push(`(${c.types.hasAny.join('/')})`);
  if (c.cmc) bits.push(`mana value ${c.cmc.min ?? ''}${c.cmc.max !== undefined ? `-${c.cmc.max}` : ''}${c.cmc.eq !== undefined ? `=${c.cmc.eq}` : ''}`.trim());
  return bits;
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

/** Override for the bare "<zone> presence" phrase on an unqualified zone fact — Exile's own default reads as "exile presence" otherwise, which says nothing about where the thing came from; in this pool an Exile fact is always something leaving the battlefield, so name that instead. */
const ZONE_PRESENCE_PHRASE: Record<string, string> = {
  Exile: 'exile from battlefield',
};

/**
 * Human-readable text for a fact — the Interactions panel's own `description`
 * field, parsed straight off the same structured fields the matcher itself
 * reads (no separate hand-written label table to keep in sync).
 *
 * Deliberately terse: an unconstrained zone fact reads as plain "<zone>
 * presence" ("battlefield presence," not "permanents on your battlefield" or
 * "permanents you control") — 'you' is the default and stays unstated,
 * 'opp' gets an explicit "opponent's" prefix since that's the notable case.
 * A `target` constraint (activateAbility's own "target Creature," e.g.) is
 * deliberately NOT rendered into the text either, even though the data still
 * carries it — that nuance now lives in `value`'s own hand-authored score
 * (a conditional want scores lower) rather than cluttering the label.
 */
export function describeFact(fact: Fact): string {
  const bits = constraintBits(fact);
  const qualifier = bits.length ? `${bits.join(' ')} ` : '';
  if (isZoneFact(fact)) {
    if (!qualifier) {
      const presence = ZONE_PRESENCE_PHRASE[fact.zone] ?? `${fact.zone.toLowerCase()} presence`;
      return fact.controller === 'opp' ? `opponent's ${presence}` : presence;
    }
    const noun = ZONE_NOUN[fact.zone] ?? 'things';
    return `${qualifier}${noun} in ${describeSide(fact.controller)} ${fact.zone.toLowerCase()}`;
  }
  const event = fact.event;
  if (event === 'lifegain') return `${describeSide(fact.controller)} life gain`;
  if (event === 'dies') return fact.target === 'self' ? 'dying' : `${describeSide(fact.controller)} creature dying`;
  if (event === 'putCounter') return `${fact.counterType ?? ''} counters${fact.target === 'self' ? ' on itself' : ''}`.trim();
  if (event === 'drawCard' || event === 'drawCards') return 'card draw';
  if (event === 'entersBattlefield') return 'enters the battlefield';
  if (event === 'activateAbility') return 'activate ability';
  return `${qualifier}${event}`;
}

/** Everything a hover needs about one fact behind a linked phrase — see `AnnotatedText`. */
export interface AnnotatedFactRef {
  /** See `ZoneFact.id` — required by the type, but a fact predating per-fact ids won't actually carry one at runtime; a caller matching against this should still tolerate `undefined` and fall back to `role`/`sourceText`/`description`. */
  id: string;
  role: 'source' | 'sink';
  value?: Weight;
  description: string;
  sourceText: string;
}

/**
 * Wire format for a card's annotated FULL card text — title, mana cost, type
 * line, then oracle text, same order a real printed card reads (see
 * `annotateCardText`'s own `cardText` param for how that string gets built)
 * — with fact-linked phrases marked inline, markdown-link style —
 * `[phrase](N)` where N indexes into `facts` (`facts[N]`, itself an array
 * since rare cases put more than one fact behind the same phrase). One
 * string plus one small array is the whole payload; the client only has to
 * split on that one marker pattern to render — it never re-derives WHICH
 * phrase belongs to which fact, that's decided here. Safe against real
 * oracle text's own parentheses (reminder text, e.g. "(Whenever this
 * creature...)") because the marker requires an immediately preceding `]`,
 * which plain prose parens never have.
 */
export interface AnnotatedText {
  text: string;
  facts: AnnotatedFactRef[][];
}

/**
 * Computed once server-side (see server/api/card/[set]/[number].ts, which
 * builds `cardText` as `"${name}\t${manaCost}\n${typeLine}\n${oracleText}"`)
 * so the client never re-derives which substring belongs to which fact. Only
 * ever anchors within the oracle-text portion in practice — a fact's
 * `sourceText`/`highlight` are quoted from real rules text, never the
 * title/mana/type lines — but nothing here assumes that; it's a plain
 * substring search over whatever string it's given.
 *
 * Deliberately conservative: a fact only gets a linked phrase when it
 * declares its own `highlight` (AI-authored, same as `sourceText`) AND that
 * `highlight` is actually a substring of the fact's own `sourceText` AND
 * `sourceText` itself appears verbatim in `cardText` — three independent
 * honesty checks against three independently-fallible things (a typo in
 * `highlight`; `sourceText` predating a wording fix). Deliberately NOT a
 * generic per-event-kind regex ("draws? a card," e.g.) — a card can use the
 * same words for more than one ability under different conditions, and only
 * the author reading the real card text (not a pattern matched against every
 * card in the pool) can say which occurrence is THIS fact's own. A fact that
 * fails any of these just isn't clickable inline — it's still visible in the
 * plain facts table below, this is additive, not a replacement.
 */
export function annotateCardText(cardText: string, facts: Fact[]): AnnotatedText {
  interface Range {
    start: number;
    end: number;
    facts: Fact[];
  }
  const ranges: Range[] = [];
  for (const f of facts) {
    if (!f.sourceText || !f.highlight) continue;
    const sourceIdx = cardText.indexOf(f.sourceText);
    if (sourceIdx === -1) continue;
    const highlightIdx = f.sourceText.indexOf(f.highlight);
    if (highlightIdx === -1) continue;
    ranges.push({ start: sourceIdx + highlightIdx, end: sourceIdx + highlightIdx + f.highlight.length, facts: [f] });
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);

  const accepted: Range[] = [];
  for (const r of ranges) {
    const last = accepted[accepted.length - 1];
    if (last && r.start === last.start && r.end === last.end) {
      last.facts.push(...r.facts);
      continue;
    }
    if (last && r.start < last.end) continue; // overlapping, ambiguous — keep whichever sorted first
    accepted.push(r);
  }

  let text = '';
  let cursor = 0;
  const factGroups: AnnotatedFactRef[][] = [];
  for (const r of accepted) {
    text += cardText.slice(cursor, r.start);
    const idx = factGroups.length;
    factGroups.push(r.facts.map((f) => ({ id: f.id, role: f.role, value: f.value, description: describeFact(f), sourceText: f.sourceText! })));
    text += `[${cardText.slice(r.start, r.end)}](${idx})`;
    cursor = r.end;
  }
  text += cardText.slice(cursor);
  return { text, facts: factGroups };
}

function selfInteractionKind(fact: Fact, card: PoolCard): SelfInteractionKind {
  if (isEventFact(fact)) return 'same-instance';
  return typeWordsFromTypeLine(card.card.typeLine).includes('Legendary') ? 'second-copy-legendary' : 'second-copy';
}

/** Does producer fact `p` (belonging to `pCard`) satisfy wanter fact `w` (belonging to `wCard`)? Symmetric to how it's invoked — `mine`/`mineRole` decide which side `p`/`w` actually is. Module-level (not nested in `findInteractionsForCard`) so `matchCountForFact` below can reuse the exact same real matching logic rather than a re-derived approximation. */
function factsInteract(mine: Fact, mineCard: PoolCard, mineRole: 'source' | 'sink', theirs: Fact, theirCard: PoolCard, tokens: Record<string, TokenLike>): boolean {
  const p = mineRole === 'source' ? mine : theirs;
  const pCard = mineRole === 'source' ? mineCard : theirCard;
  const w = mineRole === 'source' ? theirs : mine;
  const wCard = mineRole === 'source' ? theirCard : mineCard;
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

/** Every interaction `cardName` participates in, across `pool` (every card's own facts, itself included — self-interactions are a real, kept output, not filtered out). `tokens` resolves `{token}` subjects; omit for a card set with no token-producing effects yet. */
export function findInteractionsForCard(cardName: string, pool: PoolCard[], tokens: Record<string, TokenLike> = {}): InteractionGroup[] {
  const self = pool.find((p) => p.name === cardName);
  if (!self) return [];

  const groups: InteractionGroup[] = [];

  function matchOne(mine: Fact, mineCard: PoolCard, mineRole: 'source' | 'sink'): InteractionGroup | null {
    const matches: InteractionMatch[] = [];
    for (const other of pool) {
      const otherFacts = mineRole === 'source' ? other.sink : other.source;
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

  for (const fact of self.source) {
    const group = matchOne(fact, self, 'source');
    if (group) groups.push(group);
  }
  for (const fact of self.sink) {
    const group = matchOne(fact, self, 'sink');
    if (group) groups.push(group);
  }
  return groups;
}
