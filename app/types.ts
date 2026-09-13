// Every relation type is a flat, independent role — a card gets a separate edge
// per relation type that applies (same as produce/consume have always coexisted
// as two edges), rather than a role plus an orthogonal "modifiers" array on it.
export type Role = 'produce' | 'consume' | 'atypical' | 'grant' | 'magnifier';

// Shared 3-way review-status vocabulary — ReviewStatusBadge.vue's own
// `status` prop. Matches functional-model/keywords/registry.ts's
// `KeywordEntry.status` (a keyword genuinely has a "not yet implemented"
// state with no badge/button at all); the card page's own two-state
// fields (`review`: 'ai'|'human', `scenariosReview`/`interactionsReview`:
// 'draft'|'reviewed') map onto just the latter two values — a card's own
// facts/scenarios/interactions are always "there", never "not
// implemented" — without changing what's actually stored in
// progress.json (see server/api/card/review-status.ts, untouched).
export type ReviewStatus = 'not_implemented' | 'ai_reviewed' | 'human_reviewed';

/** One face of a card, real structured data (server/api/card/[set]/[number].ts) — a single-faced card is a one-entry `AnnotatedCard.faces`. `oracleText` is served RAW/UNTOUCHED (real `\n`s, not pre-split) as of the 2026-09-11 `Fact.annotations` pointer rework (see `.claude/contracts/card-schema.md`'s "Fact-to-oracle-text pointers" section) — a consumer that wants inline fact-linked spans (FunctionalModelText.vue) builds them itself at render time from each visible `Fact`'s own `annotations` (`functional-model/synergy.ts`'s `AnnotationRef`: `{ line, start, end }`, line-relative offsets into `oracleText.split('\n')`), rather than receiving a pre-built segment tree. */
export interface AnnotatedFace {
  name: string;
  /** '' for a back face with none of its own. */
  manaCost: string;
  /** Real color letters (`['U']`, `['W','U']`, ...) — only set for a face that prints "Color Indicator: ..." instead of its own mana cost (a transform DFC's back face, e.g.). Empty array (not omitted) for a genuinely colorless indicator. */
  colorIndicator?: string[];
  typeLine: string;
  oracleText: string;
  power?: string;
  toughness?: string;
}
export interface AnnotatedCard {
  faces: AnnotatedFace[];
}

export interface CardData {
  id: string;
  name: string;
  cmc: number;
  // Front face's raw Scryfall mana cost string (e.g. "{2}{U}{U}"), null for
  // a face with none (lands) — the graph node's title bar renders this via
  // the same {X}-symbol data URIs ManaSymbol.vue uses.
  manaCost: string | null;
  colors: string[];
  colorIdentity: string[];
  typeLine: string;
  rarity: string;
  images: string[];
  // Front face's Scryfall art_crop (illustration only, no frame/text) — the
  // main graph's own card node uses this (app/lib/graphRenderer.ts); the
  // hover tooltip's CardMedia still uses `images` (the whole card) above.
  // `null` for the rare card with no resolved art_crop.
  artCrop: string | null;
  tokens: { name: string; image: string }[];
  scryfallUri: string;
  // The card detail page's own server route (server/api/card/[set]/[number].ts)
  // serves this as FRONT-face-only (NOT Scryfall's raw `keywords` field,
  // which for a transform DFC is the union of both faces') — see
  // `backKeywords` below for the second face's own set, same convention as
  // `power`/`backPower`. The whole-graph node builder (buildGraph.ts's own
  // `buildGraph()`) constructs this same shape independently and keeps the
  // union there instead (a graph node's badge deliberately means "this card
  // has this ability somewhere," not "on the currently-shown face").
  keywords: string[];
  // Scryfall's own set/collector-number identity — the card detail page is
  // routed by these (/app/card/[set]/[number]), same URL shape as
  // scryfall.com/card/<set>/<number>, so prev/next is a plain ±1.
  set: string;
  collectorNumber: string;
  // How many copies are in the active deck-import filter — only ever set in
  // `deck` mode (see useGraphStore.ts); `undefined` in every other mode
  // (plain set browsing, an `sf=` Scryfall query), never a meaningless 1.
  qty?: number;
  // Raw Scryfall power/toughness strings (e.g. "3", "*") — undefined for a
  // non-creature. `back*` is the second `card_faces` entry, for a
  // transforming DFC whose back face is also a creature (Jill, Shiva's
  // Dominant // Shiva, Warden of Ice) — the Scenarios tab's replay board
  // uses these to show the tested card's own current P/T.
  power?: string;
  toughness?: string;
  backPower?: string;
  backToughness?: string;
  // Back face's own printed keywords — undefined for anything with no
  // second face at all (a transform DFC only). See `keywords` above.
  backKeywords?: string[];
}

export interface ThemeData {
  id: string;
  label: string;
}

export interface EdgeData {
  card: string;
  theme: string;
  role: Role;
  weight: number;
}

// One matched fact behind a CardLink — `description` is the human-readable
// text (functional-model/synergy.ts's `describeFact`). Combined edge
// strength is NOT baked in server-side (see graph-links.ts's own header
// comment) — `sourceShareRatio`/`sinkShareRatio` are this one match's own
// slice of two separate pool-wide totals (how many OTHER matches split the
// same source fact's output, and separately how many split the same sink
// fact's demand), each in (0, 1]. graphRenderer.ts's `reasonWeight` turns
// these into an actual number by multiplying each ratio by a user-tunable
// budget (PhysicsControls.vue's "Source spread"/"Sink spread" sliders) —
// kept as raw ratios here (not a value×budget product) specifically so a
// slider drag never needs a server round-trip to see its effect.
export interface GraphReason {
  description: string;
  sourceShareRatio: number;
  sinkShareRatio: number;
  // Which of the parent CardLink's `a`/`b` is the source (arrow tail) for
  // this specific reason — 'a' means a is the source and b the sink, 'b' the
  // reverse. Two reasons on the same pair can point opposite ways (each
  // card independently is a source the other is a sink for); direction is
  // per-reason, not per-pair, which is why it lives here and not on
  // CardLink itself.
  from: 'a' | 'b';
}

// Direct card<->card synergy edge for the main graph visualizer — sourced
// from functional-model's real, verified matching (server/api/graph-links.ts),
// not the hand-curated theme-hub edges above (which stay alive for the card
// detail page's own "Synergy model" column and the review tooling, see
// EdgeData/ThemeData). `a`/`b` are card ids (unordered pair, `a < b`).
export interface CardLink {
  a: string;
  b: string;
  reasons: GraphReason[];
}

export interface GraphFile {
  set: string;
  cards: CardData[];
  links: CardLink[];
}

// PRD 01 "Core concepts" (docs/prds/01-core-concepts.md) — a Deck is a
// fully independent, unconstrained collection: no format, no legality, no
// quantity caps, ever (a deliberate sandbox — usable for a cube just as
// well as a real deck). `card` is the full CardData, not just an id, so a
// Deck entry renders as a graph node on its own, without depending on
// whatever else happens to be loaded into Scope right now. `useGraphStore.ts`'s
// own `graph` computed is what actually combines this with Scope, at render
// time only (rendered set = Scope ∪ {entries with quantity > 0}) — a Deck
// never replaces or narrows Scope the way the old paste-a-decklist feature
// used to.
export interface DeckEntry {
  card: CardData;
  quantity: number;
}
export interface Deck {
  name: string;
  entries: DeckEntry[];
}

export const ROLES: Role[] = ['produce', 'consume', 'atypical', 'grant', 'magnifier'];

// synergy-model card-synergy decomposition effort (synergy-model/),
// unrelated to the Role/EdgeData theme-relation types above. A card is a
// flat map of nodes (pure edge facts, no sequencing) plus a separate `flow`
// graph describing how they depend on each other — kept apart because
// matching/lane-analysis only ever needs the flat facts, while sequencing
// only matters for round-trip reconstruction. See this session's synergy-
// model design discussion for the full rationale (not yet written into
// SCHEMA.md/REVIEW_PROCESS.md — those still describe the retired flat
// ability.step line format and are pending a rewrite).
//
// `role: 'trigger'` replaces the old `listen`/`on-enter`/`deals-damage`
// roles — every triggered ability is `role: 'trigger'` plus a `trigger-type`
// (open vocabulary: 'enter', 'attack', 'deals-damage', 'saga-chapter', ...),
// `to: 'stack'`, `from: '--'`. `thing` on a trigger node means "whose
// occurrence": 'self' for this card's own, or a coarse type ('creature',
// 'artifact') with a `not:self` flag for another's.
export type SynergyRole =
  | 'enters'
  | 'cast'
  | 'source'
  | 'move'
  | 'tap'
  | 'becomes'
  | 'emit'
  | 'trigger'
  | 'amplify'
  | 'suppress'
  | 'sensor'
  | 'scaler'
  | 'modifier'
  | 'tagger';

export type SynergyOwner = 'me' | 'opp' | 'any' | 'all';

export type SynergyZone = 'bf' | 'gy' | 'hand' | 'exile' | 'lib' | 'stack' | '--';

export interface SynergyNode {
  role: SynergyRole;
  owner: SynergyOwner;
  from: SynergyZone;
  to: SynergyZone;
  // Registry key (synergy-model/data/registries.json), always free text —
  // the registry is open-ended (grows every set), unlike role/owner/zone.
  thing: string;
  // Only present on a `role: 'trigger'` node — the event name.
  'trigger-type'?: string;
  // Free-text tail (`may`, `copy`, `self`, `not:self`, `target`, `cost:`,
  // `qty:N`, `qty:0..N`, `lifetime:turn`, `cond:...`, space-separated) — not
  // enum-able, a sparse tail rather than a closed list. Two binding forms
  // live here too, both snapshotting a value at the node where it's first
  // fixed (a trigger's own variable info is locked in when it triggers, not
  // re-evaluated later — same reasoning `if:A.S` back-references used to
  // rely on, now expressed structurally instead of via step coordinates):
  // `<name>:=<label>` on the producing node (e.g. a `scaler`, or a trigger
  // naming who/what it fixed — `player:=damagedPlayer`) declares a named
  // value; `<field>=<label>` on a consumer (`qty=damageDealt`,
  // `player=damagedPlayer`) binds a local field to that name. `:=` always
  // declares, bare `=` always references — never the reverse.
  flags?: string;
}

// A step in a `flow.steps` array (or in `flow.roots`) is either a bare node
// id, or a branch group with no edge-fact of its own: `combine: 'any'` is
// one occurrence satisfiable by any of several predicates (a disjunctive
// predicate on a single action — not a real choice), while a number 1..N is
// a genuine modal "choose N of these." Each id inside `of` continues
// independently via its own `flow.steps` entry.
export type SynergyFlowStep = string | { combine: 'any' | number; of: string[] };

export interface SynergyFlow {
  // Node ids with nothing pointing at them — they fire on their own,
  // ungated by anything else on the card (e.g. `enters` is always a root:
  // never nested under `cast`, since a permanent can enter without being
  // cast — reanimation, etc.). Can also hold a bare branch group, for an
  // activated ability whose own cost is itself a disjunctive predicate.
  roots: SynergyFlowStep[];
  // id -> what follows it. Whether that's guaranteed or a real interruption
  // point is derived from the target node's own `to` field (`stack` ⇒ this
  // node could be Stifled/countered — 603.3b — so what follows is
  // contingent on it actually resolving), not stored separately here.
  steps: Record<string, SynergyFlowStep[]>;
}

// synergy-model/EXAM_PROCESS.md's round-trip fidelity test result for one
// card: a fresh, isolated agent's attempt to reconstruct the card (mana
// cost, type line, rules text) from nothing but the edges above, judged by
// hand against the real oracle text. The examiner's own structured answer
// (manaCost/typeLine/description/assumptions/couldNotDerive) stays
// separate from the judgement (verdict/notes) — one is what the isolated
// agent produced, the other is this session's assessment of it; rendering
// or reading them mixed together made it hard to tell which was which.
export interface SynergyExamResult {
  name: string;
  // null when the exam predates the card-style output format (mana cost /
  // type line weren't asked for yet) — not every older result has these.
  manaCost: string | null;
  typeLine: string | null;
  description: string;
  assumptions: string[];
  couldNotDerive: string[];
  verdict: 'match' | 'issues';
  notes: string;
  comparedAt: string;
}

// forge-model/ (real Card-Forge card scripts, parsed by app/lib/forgeScript.ts
// into an outline shown next to the synergy one) was removed 2026-09-11 as
// GPL-3.0 exposure cleanup — confirmed dead, nothing rendered it. The
// ForgeLineType/ForgeRow/ForgeFace/ForgeCard types that shape used to live
// here went with it.
