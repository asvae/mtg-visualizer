// Every relation type is a flat, independent role — a card gets a separate edge
// per relation type that applies (same as produce/consume have always coexisted
// as two edges), rather than a role plus an orthogonal "modifiers" array on it.
export type Role = 'produce' | 'consume' | 'atypical' | 'grant' | 'magnifier';

export interface CardData {
  id: string;
  name: string;
  cmc: number;
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
// text (functional-model/synergy.ts's `describeFact`), `weight` is the
// match's combined two-sided strength (`Math.sqrt(mineTotal * theirTotal)`,
// each a `factTotal` — see functional-model/synergy.ts's own doc comments on
// `Weight`/`factTotal`), 1-25, or `null` if either side's fact predates the
// weight fields (treat as "unweighted," never as 1 — a real 1 means
// "verified minimum-strength match," not "unknown").
export interface GraphReason {
  description: string;
  weight: number | null;
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

// forge-model/ — real Card-Forge (github.com/Card-Forge/forge) card scripts
// for the same cards, parsed by app/lib/forgeScript.ts into an outline the
// card page can render next to the synergy one. Forge's own shape is a flat
// list of top-level ability lines (A$/T$/S$/K$), each optionally chaining
// into further SVar-defined sub-effects — a per-ability linked list, not a
// single graph the way `flow` above is, so this stays its own type rather
// than being forced into SynergyFlow's shape.
export type ForgeLineType = 'A' | 'T' | 'S' | 'R' | 'K';

export interface ForgeRow {
  kind: 'line' | 'group';
  key: string;
  depth: number;
  isRoot: boolean;
  // 'line' only:
  lineType?: ForgeLineType;
  // The effect/keyword name — Mode$ value for T:/S:, the AB$/SP$/DB$ value
  // for an activated ability or a chained sub-effect, or the bare keyword
  // name for K: lines.
  role?: string;
  // Remaining pipe-separated fields not already consumed by chain-following
  // (SubAbility$/Choices$/AddTrigger$/Execute$) or shown as `description`,
  // rendered `Key=Value`-joined the same way a synergy node's `flags` are.
  fields?: string;
  // SpellDescription$/TriggerDescription$/Description$ — Forge's own
  // human-readable reminder text for this specific line, shown as a caption
  // (synergy nodes carry no per-node prose; Forge's real scripts do).
  description?: string;
  // 'group' only — a Choices$ (Charm, real "choose one") or K:Chapter
  // branch set.
  groupLabel?: string;
}

export interface ForgeFace {
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  pt: string | null;
  oracle: string | null;
  rows: ForgeRow[];
  // DeckHas$/AlternateMode$/etc — Forge engine/AI bookkeeping lines with no
  // synergy-model analogue, kept visible rather than silently dropped.
  meta: string[];
}

export interface ForgeCard {
  faces: ForgeFace[];
}
