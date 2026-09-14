// Simplified mana-cost affordability — real Forge parses a cost string into
// `ManaCostShard`s (forge-core/src/main/java/forge/card/mana/ManaCostShard.java,
// `ManaCostParser.java`) and pays against a real spendable `ManaPool`
// (`ManaPool.java`). This prototype has no spendable mana pool at all (see
// interfaces.ts's own `Player.addMana` doc comment — a deliberately inert
// observation point, no ManaPool modeled anywhere), so "afford" here means
// something narrower: does the caster control enough UNTAPPED mana sources
// to cover a parsed cost, checked and PAID (tapped) atomically,
// all-or-nothing.
//
// Explicit scope, matching this file's own header convention elsewhere in
// functional-model/*.ts:
//  - Generic ({N}), the five colored pips ({W}{U}{B}{R}{G}), real Hybrid
//    pips (`{G/U}`-shaped — ManaCostShard.java lines 36-45, e.g. `GU`), and
//    real `{X}` symbols (ManaCostShard.java line 84, `X(ManaAtom.IS_X,
//    "X")`) are now all parsed and payable (closed 2026-09-12,
//    ENGINE_GAPS.md gap #6 — checked the real pool first: Thranduil,
//    Sindarin Liege // Silvan Rally's own `{1}{G/U}{G/U}`/`{2}{G/U}{G/U}`
//    faces need Hybrid; Choco Comet's `{X}{R}{R}` and Doppelgang's
//    `{X}{X}{X}{G}{U}` need X — 3 real cards total, the only ones in the
//    ~321-card pool that do). Phyrexian (`{U/P}`) and a colorless-specific
//    PIP IN A COST (`{C}` — e.g. a spell printed as "{3}{C}") are STILL not
//    parsed — `parseManaCost` still throws on either — because grepping
//    every real `manaCost:` string in the pool found zero cards needing
//    either shape (checked, not assumed): no real FIN card justifies
//    building them yet, per this doc's own "does a real card need this"
//    discipline. A source that PRODUCES {C} is unaffected either way (next
//    bullet) — that's a source-side ability, not a cast-cost pip.
//  - Basic lands (real subtype = color: Plains=W, Island=U, Swamp=B,
//    Mountain=R, Forest=G), PLUS every real, structured `CardDefinition
//    .manaAbilities` entry (`card.ts`'s own `ManaAbility` — see its full
//    doc comment for the real Forge citation, `AbilityManaPart.java`)
//    that's an ORDINARY payable source: a bare `{T}` cost (no `cost`
//    override), no `restriction`, no `activationCondition`, and no
//    `variableAmount` — see `payableManaAbility` below, the one real
//    chokepoint this file now filters through (closed 2026-09-14,
//    superseding the OLD text-regex path this same header used to
//    document: `manaAbilityColorFromStaticText`/
//    `manaAbilityColorsFromStaticText`/`deriveManaAbility`, all DELETED —
//    every real card that used to rely on scanning `staticAbilities` text
//    now declares a real, typed `manaAbilities` entry instead, checked and
//    migrated card-by-card, see `ENGINE_GAPS.md`'s own "Non-basic mana
//    sources" entry for the full list).
//  - `sourceColors`/`assignManaRequirements` below generalize `canAfford`/
//    `payMana`'s own colored-pip matching into a real assignment problem so
//    a multi-color source (a real CHOICE, `ManaAbility.colors.length > 1`)
//    genuinely counts toward ANY of its own colors a cost needs — not just
//    a fixed one, and not just a bigger lookup table — a real per-cast
//    choice, checked by exhaustive backtracking since the real pool's
//    costs/source counts are always small enough for that to be both
//    correct and fast. This now ALSO covers a genuine 5-color "any one
//    color" source (Blitzball's real, unrestricted `{T}: Add one mana of
//    any color.` — `ManaAbility.colors: ['W','U','B','R','G']`, no
//    narrower vocabulary needed) for free, same mechanism.
//  - A source with `ManaAbility.amount` > 1 (Ring of the Lucii's real
//    `{T}: Add {C}{C}.`) contributes that many units toward GENERIC
//    coverage in one tap (`sourceAmount` below) — real, narrow extension;
//    see `payableManaAbility`'s own doc comment for the one documented
//    simplification this doesn't cover (an amount>1 source is never
//    matched against more than one COLORED requirement in a single
//    assignment — harmless for the one real pool card that needs this,
//    since its own 2 units are colorless-only and colorless is never
//    itself a payable pip in a cast cost, see `COLORS` below).
//  - Still explicitly NOT recognized as an ordinary payable source — real,
//    named, flagged debt, not silently dropped: a RESTRICTED ability
//    ("Spend this mana only to..." — Cargo Ship's own real `{T}: Add {C}.
//    Spend this mana only to cast an artifact spell...`, Freya Crescent's,
//    The Emperor of Palamecia's own real equivalents — all 3 now genuinely
//    TYPED via `ManaAbility.restriction`, just still unenforced, since
//    correctly affording this would need a real spendable-mana-pool
//    tracking mechanism this engine doesn't have at all — see
//    `ManaAbility.restriction`'s own doc comment), a VARIABLE one (Elvish
//    Archdruid's own "Add {G} for each Elf you control", Woodland
//    Weavemaster's own "Add X mana... where X is this creature's power" —
//    both now genuinely TYPEABLE via `ManaAbility.variableAmount`, just not
//    yet wired into `canAfford`/`payMana`, which take no live
//    controller/board reference to re-derive a variable count from at
//    payment time — see that field's own doc comment), or a source whose
//    OWN activation needs something other than a bare `{T}` (a non-`{T}`
//    `cost`, e.g. Capital City's real `{1}, {T}: Add one mana of any
//    color.`; or a real `activationCondition`, e.g. Willowrush Verge's
//    second ability) — paying a MANA ABILITY'S OWN cost, or checking a
//    live board-state precondition before activating one, are both real,
//    separate, bigger lifts than this file's own narrow "tap sources,
//    assign to requirements" scope. A mana rock/land with any of these
//    remaining shapes stays a real, separately tracked gap (ENGINE_GAPS.md
//    gap #5), now honestly TYPED rather than silently text-only or absent.

import type { GameState, RealCard, RealPlayer } from './state';

/**
 * The five real colors, PLUS colorless (`C`) — added 2026-09-09 for The
 * Gold Saucer's real "{T}: Add {C}." ability (a genuine mana-producing
 * value, not a parallel mechanism bolted on beside this type: every
 * function below that already enumerated the five colors now also
 * recognizes `C` through the exact same code path, not a separate one).
 * Deliberately NOT added to `COLORS` below (the narrower "payable colored
 * PIP" list `parseManaCost`/`canAfford`/`payMana` validate a SPELL's own
 * cost against) — a permanent's mana ABILITY producing `C` is a different
 * question from a CAST cost containing a literal `{C}` pip, and only the
 * former is in scope here (see this file's own header).
 */
export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

/** The five basic land names — shared here so callers (harness.ts's `PlayerState.basicLands`, e.g.) don't duplicate this union inline. */
export type BasicLandName = 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest';

export interface ParsedManaCost {
  generic: number;
  colors: Partial<Record<ManaColor, number>>;
  /**
   * Real Hybrid pips (`{G/U}`-shaped, ManaCostShard.java lines 36-45, e.g.
   * `GU(ManaAtom.GREEN | ManaAtom.BLUE, "G/U")`) — one entry per printed
   * pip, each a 2-element tuple of the two colors it can be paid with
   * (`['G','U']`, printed order preserved). Real FIN cards: Thranduil,
   * Sindarin Liege // Silvan Rally's own `{1}{G/U}{G/U}`/`{2}{G/U}{G/U}`.
   * Empty for any cost with no Hybrid pips (the overwhelming majority).
   * Only WUBRG-vs-WUBRG Hybrid is modeled — Phyrexian (`{U/P}`) and
   * "or-2-generic"/"or-colorless" Hybrid variants (`{2/W}`, `{C/W}`) are
   * still unsupported (no real FIN card needs either, see this file's own
   * header).
   */
  hybrid: ManaColor[][];
  /**
   * Count of real `{X}` symbols in the cost (ManaCostShard.java line 84,
   * `X(ManaAtom.IS_X, "X")`) — CR 107.3c: multiple `{X}`s in one cost all
   * refer to the SAME chosen value, so this is a plain count, not a list.
   * Real FIN cards: Choco Comet's `{X}{R}{R}` (1), Doppelgang's
   * `{X}{X}{X}{G}{U}` (3). Zero for any cost with no `{X}` (the
   * overwhelming majority). A cost with `xCount > 0` is NOT yet
   * cast-ready — `resolveXCost` below folds a caller-chosen X value into
   * `generic` before `canAfford`/`payMana` ever see it; both of those
   * functions simply ignore `xCount` (an un-resolved `{X}{R}{R}` would
   * otherwise silently need 0 extra generic, which is a real, legal CR
   * 107.3b default — X unspecified reads as 0 — so this is a safe,
   * non-crashing fallback, not a silent miscount, but a caller SHOULD
   * resolve X first whenever the caster actually wants to pay more).
   */
  xCount: number;
}

const BASIC_LAND_COLOR: Record<string, ManaColor> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
};

// The payable/spell-cost-pip colors — deliberately still WUBRG-only, NOT
// widened to include `C` (see `ManaColor`'s own doc comment: a colorless
// PRODUCE ability is now real, but a spell's own cost containing a literal
// {C} pip stays unparsed, unchanged real gap). `parseManaCost`/`canAfford`/
// `payMana`/`basicLandsFor` all key off this narrower list, not `ManaColor`
// directly, so widening `ManaColor` doesn't silently change what a cost
// STRING can contain.
const COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

// No basic land produces colorless in this pool (no Wastes card exists
// here) — `Partial` rather than a `C: ...` entry that would just be dead
// code; every real caller (`basicLandsFor`) only ever looks this up for a
// color already filtered through `COLORS` above (still WUBRG-only), so a
// `C` key is never actually requested at runtime.
const LAND_FOR_COLOR: Partial<Record<ManaColor, BasicLandName>> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

/** Parses a real printed mana-cost string (`{2}{U}{U}`) into generic + colored-pip counts, plus real Hybrid pips and an `{X}` count (see `ParsedManaCost`'s own doc comments — both closed 2026-09-12, ENGINE_GAPS.md gap #6). Throws on any symbol outside this file's own declared scope (Phyrexian, a colorless PIP IN A COST — see header) — a clear signal, not a silently wrong count. */
export function parseManaCost(cost: string): ParsedManaCost {
  const parsed: ParsedManaCost = { generic: 0, colors: {}, hybrid: [], xCount: 0 };
  const tokens = cost.match(/\{[^}]+\}/g) ?? [];
  for (const token of tokens) {
    const inner = token.slice(1, -1);
    if (/^\d+$/.test(inner)) {
      parsed.generic += Number(inner);
      continue;
    }
    if (inner === 'X') {
      parsed.xCount += 1;
      continue;
    }
    if ((COLORS as string[]).includes(inner)) {
      const color = inner as ManaColor;
      parsed.colors[color] = (parsed.colors[color] ?? 0) + 1;
      continue;
    }
    const hybridMatch = /^([WUBRG])\/([WUBRG])$/.exec(inner);
    if (hybridMatch) {
      parsed.hybrid.push([hybridMatch[1] as ManaColor, hybridMatch[2] as ManaColor]);
      continue;
    }
    throw new Error(`parseManaCost: unsupported mana symbol {${inner}} in "${cost}" (Phyrexian/generic-colorless-in-a-cost not modeled — no real FIN card needs either, see this file's own header)`);
  }
  return parsed;
}

/**
 * Real CR 601.2b/107.3c "announce the value of X" — folds a caster-chosen
 * `x` into `generic` (`xCount` real `{X}` symbols each contribute `x`
 * generic, CR 107.3c: multiple `{X}`s in one cost share the SAME value) and
 * zeroes `xCount` so the result is fully cast-ready for `canAfford`/
 * `payMana` (neither reads `xCount` at all — see `ParsedManaCost.xCount`'s
 * own doc comment for why an un-resolved cost still behaves safely, as
 * X=0, rather than crashing). `x` defaults to 0 (a real, legal choice,
 * CR 107.3b) when the caller doesn't supply one. See `engine.ts`'s
 * `effectiveCastCost` for the one real call site (threads a caller-supplied
 * `x` through `canCastSpell`/`castSpell`, same shape as `declaredTarget`).
 */
export function resolveXCost(cost: ParsedManaCost, x?: number): ParsedManaCost {
  const chosen = Math.max(0, x ?? 0);
  return { ...cost, generic: cost.generic + cost.xCount * chosen, xCount: 0 };
}

/**
 * Real CR 601.2f/118.9 cost-reduction — reduces only the GENERIC portion of
 * an already-parsed cost, floored at 0 rather than going negative (118.9:
 * a cost can't be reduced below what its own colored-mana requirement
 * demands; a real "costs {N} less to cast" clause never touches colored
 * pips). See `card.ts`'s `CostReduction` for the caller-facing shape this
 * backs (`engine.ts`'s `canCastSpell`/`castSpell`).
 */
export function reduceGenericCost(cost: ParsedManaCost, amount: number): ParsedManaCost {
  return { ...cost, generic: Math.max(0, cost.generic - amount) };
}

/** Renders a `ParsedManaCost` back to a printed-style string (`{2}{W}`) — generic first (only when nonzero, or when there are truly no other pips of any kind), then each real color's pips repeated (always in `COLORS`' own WUBRG order), then any real Hybrid pips (`{G/U}`, printed-order preserved) — `xCount` is deliberately NOT rendered (a caller should `resolveXCost` first; an un-resolved `{X}` cost has no single "printed value" to show once X is chosen). Used for trace logging the ACTUAL cost paid after a real cost reduction or X-resolution (`engine-trace.ts`'s `pilotCast`), not just the nominal printed `card.manaCost`. `{0}` for a cost that's entirely reduced away with no colored/hybrid pips left (matches real Forge's own "free spell" display, e.g. a fully-reduced-to-0 cost — no real FIN card in this pool hits that case yet, but the shape is correct regardless). */
export function formatManaCost(cost: ParsedManaCost): string {
  let out = '';
  const hasColoredOrHybrid = Object.values(cost.colors).some((n) => n) || cost.hybrid.length > 0;
  if (cost.generic > 0 || !hasColoredOrHybrid) out += `{${cost.generic}}`;
  for (const color of COLORS) {
    const count = cost.colors[color] ?? 0;
    for (let i = 0; i < count; i++) out += `{${color}}`;
  }
  for (const pip of cost.hybrid) out += `{${pip[0]}/${pip[1]}}`;
  return out;
}

/**
 * Scenario-setup convenience (harness.ts's `PlayerState.basicLands` /
 * `engine.ts` test helpers): one basic land per colored pip in `cost`, PLUS
 * one per real Hybrid pip (`{G/U}`-shaped — using the pip's FIRST printed
 * color; a real payer could legally choose either, see
 * `assignManaRequirements`, but this helper only needs ONE legal,
 * affordable board state for scenario setup, not every possible one),
 * generic pips filled by round-robining whichever colors the cost already
 * needs (so `{2}{G}` yields `[Forest, Forest, Forest]`, not `[Forest,
 * Mountain]`-by-arbitrary-default) — falls back to an all-Forest count
 * (`generic` + 1) when the cost has zero colored/Hybrid pips, since some
 * real land has to be picked and Forest is this file's own
 * arbitrary-but-consistent default elsewhere (`sourceColors`'s subtype
 * table order, e.g.). `cost.xCount` is ignored (same "resolve X first"
 * convention `canAfford`/`payMana` use — no real FIN card needs
 * `basicLandsFor` for an X-cost card today: Choco Comet/Doppelgang's own
 * scenarios stay on `harness.ts`'s flat `Scenario` style, which never calls
 * this at all). Does not itself validate `cost` — reuses `parseManaCost`,
 * so the same throw applies to an unsupported (Phyrexian/colorless-pip)
 * symbol.
 */
export function basicLandsFor(cost: string): BasicLandName[] {
  const parsed = parseManaCost(cost);
  const neededColors = COLORS.filter((c) => (parsed.colors[c] ?? 0) > 0);
  const lands: BasicLandName[] = [];
  for (const color of neededColors) {
    // `color` only ever comes from `neededColors` (`COLORS.filter(...)`,
    // still WUBRG-only — see `COLORS`'s own doc comment), so `LAND_FOR_COLOR`
    // (now `Partial` to accommodate `ManaColor`'s new colorless value, which
    // never reaches here) is guaranteed defined for it.
    for (let i = 0; i < (parsed.colors[color] ?? 0); i++) lands.push(LAND_FOR_COLOR[color]!);
  }
  for (const pip of parsed.hybrid) lands.push(LAND_FOR_COLOR[pip[0]]!);
  const allNeededColors = [...neededColors, ...parsed.hybrid.map((pip) => pip[0])];
  if (allNeededColors.length === 0) {
    for (let i = 0; i < parsed.generic + 1; i++) lands.push('Forest');
  } else {
    for (let i = 0; i < parsed.generic; i++) lands.push(LAND_FOR_COLOR[allNeededColors[i % allNeededColors.length]!]!);
  }
  return lands;
}

/**
 * Every `card.counterConditionalGrants` entry currently ACTIVE (`card`'s own
 * counter count for that entry's `counterType` is > 0 right now) — duck-typed
 * against `state.ts`'s own `RealCard.counterConditionalGrants`/
 * `CounterConditionalGrant` shape rather than imported as a value (this
 * file's own header: `mana.ts` never imports a VALUE from `state.ts`,
 * only types — reading `card.counterConditionalGrants`/`card.counters`
 * directly needs no runtime import at all). Real Forge citation and full
 * design: `card.ts`'s own `CounterConditionalGrant` doc comment (Ultima,
 * Origin of Oblivion's own real `RemoveAllAbilities$ True | AddAbility$
 * ColorlessMana`) — `payableManaAbility`/`sourceColors`/`sourceAmount`
 * below are the real mana-side readers.
 */
function activeCounterConditionalGrants(card: RealCard) {
  return (card.counterConditionalGrants ?? []).filter((g) => (card.counters[g.counterType] ?? 0) > 0);
}

/**
 * The one real ORDINARILY-PAYABLE `ManaAbility` on `card`, if any (closed
 * 2026-09-14, ENGINE_GAPS.md gap #5, superseding the old text-regex path —
 * see this file's own header) — a bare `{T}` cost (no `cost` override), no
 * `restriction`, no `activationCondition`, and no `variableAmount`. Returns
 * the FIRST such qualifying entry across `card.manaAbilities` (Willowrush
 * Verge's own second, conditioned `{T}: Add {G}.` entry is correctly
 * skipped in favor of its first, unrestricted `{T}: Add {U}.`, same
 * "first match wins" behavior the old regex path already had). A
 * restricted/conditioned/variable/non-bare-`{T}` entry is real, present,
 * structured data (`CardDefinition.manaAbilities` — never silently dropped)
 * but deliberately excluded HERE, same "known, honestly unenforced" scope
 * every one of those fields' own doc comments already documents.
 *
 * An ACTIVE `counterConditionalGrants` entry (Ultima, Origin of Oblivion's
 * own blight counter) is checked FIRST and, when present, REPLACES this
 * entirely: a `grantManaAbility` wins outright (the permanent's only mana
 * ability is now that one, printed ones ignored); a bare `removeAllAbilities`
 * with no replacement means no mana ability at all anymore.
 */
function payableManaAbility(card: RealCard): { colors: ManaColor[]; amount: number } | undefined {
  const active = activeCounterConditionalGrants(card);
  const granted = active.find((g) => g.grantManaAbility)?.grantManaAbility;
  if (granted) return { colors: granted.colors, amount: granted.amount ?? 1 };
  if (active.some((g) => g.removeAllAbilities)) return undefined;
  for (const ability of card.manaAbilities ?? []) {
    if (ability.restriction || ability.activationCondition || ability.variableAmount) continue;
    if ((ability.cost ?? '{T}') !== '{T}') continue;
    return { colors: ability.colors, amount: ability.amount ?? 1 };
  }
  return undefined;
}

/**
 * Every color `card` produces as a mana source — EVERY matching basic-land
 * subtype color (real fix, 2026-09-14: previously stopped at the FIRST
 * matching subtype, silently dropping a genuine dual-basic-type land's
 * second color — Breeding Pool's own real `Land — Forest Island` typeLine
 * needs BOTH `G` and `U`, matching real Forge's own behavior: a dual-basic
 * land needs no explicit `A:AB$ Mana` script line at all, its mana ability
 * is automatically derived from its own printed basic land types, confirmed
 * against `res/cardsfolder/b/breeding_pool.txt` — no such line exists
 * there), OR the ordinarily-payable `ManaAbility` above (single- or
 * multi-element) — or an empty array if it's neither/not a mana source at
 * all. Every real caller below goes through this, so a dual land's own
 * producible colors are always fully visible to `canAfford`/`payMana`'s own
 * assignment, not just the first.
 *
 * Exported (2026-09-14, ENGINE_GAPS.md gap #5's own "Ultima, Origin of
 * Oblivion" closure) so `engine.ts` can re-derive which color(s) a REAL
 * tapped source just produced, right after `payMana` returns — the one
 * real chokepoint for firing `card.ts`'s new `Trigger.on: 'tapLandForMana'`
 * (Forge's own real `TriggerType.TapsForMana`, see that field's own doc
 * comment) — without duplicating this function's own real derivation
 * logic at the call site.
 */
export function sourceColors(card: RealCard): ManaColor[] {
  // Real Forge `RemoveLandTypes$ True | RemoveAllAbilities$ True |
  // AddAbility$ ColorlessMana` (613, Ultima, Origin of Oblivion's own blight
  // counter, ENGINE_GAPS.md's own closure) — checked BEFORE the basic-land-
  // subtype derivation below, since a blighted land has genuinely lost every
  // land subtype it printed (`effectiveSubtypes`, `state.ts`) and would
  // otherwise still be read here off its raw, un-stripped `card.subtypes`
  // (this function reads the RAW field, not `effectiveSubtypes`, since it
  // has no `GameState` to call that with — the active-grant check below
  // needs none either, it's entirely local to `card`).
  const active = activeCounterConditionalGrants(card);
  const granted = active.find((g) => g.grantManaAbility)?.grantManaAbility;
  if (granted) return granted.colors;
  if (active.some((g) => g.removeAllAbilities)) return [];
  if (card.types.includes('Land')) {
    const landColors = card.subtypes.map((s) => BASIC_LAND_COLOR[s]).filter((c): c is ManaColor => c !== undefined);
    if (landColors.length > 0) return landColors;
  }
  return payableManaAbility(card)?.colors ?? [];
}

/** How many mana units ONE tap of `card` produces toward GENERIC coverage (`canAfford`/`payMana` below) — always 1 for a basic land (no real FIN basic land taps for more), or the ordinarily-payable `ManaAbility`'s own real `amount` (Ring of the Lucii's real `Amount$ 2`, the one pool card that needs a value other than 1). Only ever consulted for a source `sourceColors` already returned at least one color for. */
function sourceAmount(card: RealCard): number {
  // Same active-grant precedence as `sourceColors` above — a blighted
  // land's own real `{T}: Add {C}` always produces exactly 1 (Ultima's own
  // real script has no `Amount$` override on `ColorlessMana`).
  const active = activeCounterConditionalGrants(card);
  const granted = active.find((g) => g.grantManaAbility)?.grantManaAbility;
  if (granted) return granted.amount ?? 1;
  if (card.types.includes('Land') && card.subtypes.some((s) => BASIC_LAND_COLOR[s])) return 1;
  return payableManaAbility(card)?.amount ?? 1;
}

/** Every untapped real mana source (see `sourceColors`) this player currently controls. */
export function untappedManaSources(player: RealPlayer): RealCard[] {
  return player.battlefield.filter((c) => !c.tapped && sourceColors(c).length > 0);
}

/**
 * One "this many mana units, restricted to one of these colors" requirement
 * — a single colored pip is `{colors: [X]}` (exactly one legal color); a
 * Hybrid pip is `{colors: [X, Y]}` (either legal color). See
 * `assignManaRequirements` below for how a list of these gets matched
 * against real sources.
 */
interface ColorRequirement {
  colors: ManaColor[];
}

/**
 * Real assignment problem underneath both `canAfford` and `payMana` — CLOSES
 * ENGINE_GAPS.md gap #6's real Hybrid-pip support AND gap #5's real
 * dual-color-SOURCE support in one shared mechanism, since both are the same
 * underlying shape: some requirements accept more than one color, some
 * sources produce more than one color, and a real cast needs ONE valid
 * assignment of sources to requirements (CR 601.2g "the player pays the
 * cost" — a legal choice, not necessarily unique). Exhaustive backtracking
 * (try the first not-yet-used source whose own producible colors overlap
 * this requirement's legal colors; recurse; undo and try the next on
 * failure) rather than a greedy heuristic — greedy can wrongly reject a
 * legal payment when a choice/dual source's "obvious" first color turns out
 * to be needed elsewhere (e.g. two Hybrid `{G/U}` pips against one Forest +
 * one Island: greedy always trying G first for both pips would wrongly fail
 * the second). Backtracking is correct regardless of ordering; real FIN
 * cost/source sizes (at most a handful of colored+hybrid pips, a
 * battlefield's worth of lands) keep this fast in practice — no real card
 * in this pool comes close to needing a smarter (e.g. max-flow) algorithm.
 *
 * Returns the real `RealCard[]` chosen (one per requirement, same order as
 * `requirements`) or `null` if no legal assignment exists at all. Does NOT
 * mutate `sources` or tap anything — `payMana` re-runs this against its own
 * copy and taps the result for real.
 */
function assignManaRequirements(sources: RealCard[], requirements: ColorRequirement[]): RealCard[] | null {
  const used = new Set<number>();
  const backtrack = (reqIndex: number): number[] | null => {
    if (reqIndex === requirements.length) return [];
    const req = requirements[reqIndex]!;
    for (let i = 0; i < sources.length; i++) {
      if (used.has(i)) continue;
      const colors = sourceColors(sources[i]!);
      if (!colors.some((c) => req.colors.includes(c))) continue;
      used.add(i);
      const rest = backtrack(reqIndex + 1);
      if (rest !== null) return [i, ...rest];
      used.delete(i);
    }
    return null;
  };
  const result = backtrack(0);
  return result === null ? null : result.map((i) => sources[i]!);
}

/** The real colored-pip + Hybrid-pip requirement list for `cost` — colored pips first (in `COLORS`' own WUBRG order, matching this function's pre-existing iteration order so an all-fixed-color cast still assigns identically to before this pass), then Hybrid pips in printed order. Generic is NOT a requirement here — any leftover source (of ANY color) pays it, checked/tapped separately by `canAfford`/`payMana` themselves. Shared by both so they can never disagree about what a cost demands. */
function coloredRequirementsFor(cost: ParsedManaCost): ColorRequirement[] {
  const requirements: ColorRequirement[] = [];
  for (const color of COLORS) {
    const need = cost.colors[color] ?? 0;
    for (let i = 0; i < need; i++) requirements.push({ colors: [color] });
  }
  for (const pip of cost.hybrid) requirements.push({ colors: pip });
  return requirements;
}

/** Whether `sources` (already-filtered untapped mana sources) can cover `cost` — colored + Hybrid pips matched first via `assignManaRequirements` (a real dual-color source may pay either its own color, a real Hybrid pip may be paid by either of its two colors), generic covered by whatever's left, SUMMING each leftover source's own `sourceAmount` (2026-09-14, ENGINE_GAPS.md gap #5 — Ring of the Lucii's real `Amount$ 2` source counts as 2 toward generic, not 1; every other real source in this pool still has `amount` 1, so this is a strict generalization of the old plain-count check, not a behavior change for them). Read-only; doesn't tap anything (see `payMana` for the mutating half). `cost.xCount` is ignored (see `ParsedManaCost.xCount`'s own doc comment — resolve X first via `resolveXCost`). */
export function canAfford(sources: RealCard[], cost: ParsedManaCost): boolean {
  const assigned = assignManaRequirements(sources, coloredRequirementsFor(cost));
  if (assigned === null) return false;
  const assignedSet = new Set(assigned);
  const genericAvailable = sources.filter((s) => !assignedSet.has(s)).reduce((sum, s) => sum + sourceAmount(s), 0);
  return genericAvailable >= cost.generic;
}

/** Taps exactly enough of `sources` to pay `cost` (colored + Hybrid pips first via the same real assignment `canAfford` uses, then generic off whatever's left, one tap at a time, each contributing its own real `sourceAmount` toward the remaining generic need — 2026-09-14, ENGINE_GAPS.md gap #5, same generalization `canAfford` above documents) — real `payMana` mutation (`state.tap`), not a log-only observation. Throws if `canAfford` would say no, rather than tapping a partial/wrong set. Returns the exact real sources tapped, in order — the same deterministic choice this function already makes, just surfaced instead of thrown away (a caller has no other way to know WHICH lands paid for something; `engine-trace.ts`'s own pilot logging is what this return value exists for). */
export function payMana(state: GameState, sources: RealCard[], cost: ParsedManaCost): RealCard[] {
  if (!canAfford(sources, cost)) throw new Error('payMana: cannot afford this cost with the given sources');
  const remaining = [...sources];
  const tapped: RealCard[] = [];
  const tapCard = (card: RealCard) => {
    const idx = remaining.indexOf(card);
    remaining.splice(idx, 1);
    state.tap(card);
    tapped.push(card);
  };
  const assigned = assignManaRequirements(remaining, coloredRequirementsFor(cost))!;
  for (const card of assigned) tapCard(card);
  let genericNeeded = cost.generic;
  while (genericNeeded > 0) {
    const source = remaining[0]!;
    genericNeeded -= sourceAmount(source);
    tapCard(source);
  }
  return tapped;
}
