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
//    Mountain=R, Forest=G), PLUS a narrow real slice of non-basic mana
//    sources: any permanent whose `CardDefinition.staticAbilities`
//    contains an EXACT, single-color, unrestricted "{T}: Add {X}." string
//    (`manaAbilityColorFromStaticText` below, X one of W/U/B/R/G/C) is
//    recognized too — checked against the real pool: 10 real WUBRG cards
//    qualify (Druid of the Cowl, Goobbue Gardener, Llanowar Elves — all
//    creatures, so 302.6 summoning-sickness applies, handled in
//    `engine.ts`; Midgar, Ishgard, Jidoor, Lindblum, Zanarkand — Adventure
//    lands; White Auracite, an artifact; Willowrush Verge, a plain land),
//    plus 6 real "{T}: Add {C}." lands (capital-city, cavern-of-souls,
//    starting-town, eclipsed-realms, clive-s-hideaway, the-gold-saucer —
//    added 2026-09-09 alongside colorless `ManaColor` support), PLUS
//    (closed 2026-09-12, ENGINE_GAPS.md gap #5's own "dual/choice-of-color"
//    remainder) an exact, unrestricted "{T}: Add {X} or {Y}." string
//    (`manaAbilityColorsFromStaticText` below) — checked against the real
//    pool: 12 real Town-cycle lands qualify (Vector, Imperial Capital's own
//    "{T}: Add {B} or {R}.", e.g.). `sourceColors`/`assignManaRequirements`
//    below generalize `canAfford`/`payMana`'s own colored-pip matching into
//    a real assignment problem so a dual source genuinely counts toward
//    EITHER color a cost needs (not just a fixed one, and not just a bigger
//    lookup table — a real per-cast choice, checked by exhaustive
//    backtracking since the real pool's costs/source counts are always
//    small enough for that to be both correct and fast). Still explicitly
//    NOT recognized: a restricted ability ("Activate only if...", "Spend
//    this mana only to..." — Cargo Ship's own real "{T}: Add {C}. Spend
//    this mana only to cast an artifact spell..." ability, e.g. — see this
//    file's own `manaAbilityColorFromStaticText` doc comment for why
//    correctly affording this would need a real spendable-mana-pool
//    tracking mechanism this engine doesn't have at all, a materially
//    bigger lift than a matching problem), or a variable one (Elvish
//    Archdruid's own "Add {G} for each Elf you control" — its `amount` is a
//    function of live board state, not a fixed single symbol at all, and
//    unlike the dual-color case above there's no way to represent "produces
//    a variable amount" as a `RealCard.manaAbility` value without teaching
//    `payMana` that ONE tap can yield more than one mana unit — a real,
//    separate extension to the payment model itself, not just a lookup
//    widening). A mana rock with one of THOSE two shapes remains a real,
//    separately tracked gap (ENGINE_GAPS.md gap #5).

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
 * Recognizes a real, narrow slice of non-basic "{T}: Add mana" static
 * abilities (see this file's own header) — the string must be EXACTLY
 * `{T}: Add {X}.` (X a single real color OR colorless — `[WUBRGC]`, widened
 * 2026-09-09 for The Gold Saucer's real "{T}: Add {C}." ability, same real
 * value as any other color here, not a separate check), with no
 * restriction/"spend only"/multi-symbol text attached, or it's correctly
 * ignored (still a real static ability text-wise — `staticAbilities` is
 * unaffected either way — just not modeled as a payable source). Returns
 * the FIRST such match across `staticAbilities` (Willowrush Verge has a
 * second, restricted `{T}: Add {G}` entry that's correctly skipped, while
 * its first, unrestricted `{T}: Add {U}` still qualifies).
 */
export function manaAbilityColorFromStaticText(staticAbilities?: string[]): ManaColor | undefined {
  for (const text of staticAbilities ?? []) {
    const match = /^\{T\}: Add \{([WUBRGC])\}\.$/.exec(text);
    if (match) return match[1] as ManaColor;
  }
  return undefined;
}

/**
 * Widens the above to also recognize a real, common "choice of color" shape
 * — an EXACT `{T}: Add {X} or {Y}.` string (two real colors, still no
 * restriction/"spend only"/third-symbol text attached) — checked against the
 * real pool: 12 real FIN Town-cycle lands use this exact shape (Vector,
 * Imperial Capital's own "{T}: Add {B} or {R}.", e.g.), on top of the
 * single-color cards `manaAbilityColorFromStaticText` above already covers.
 *
 * **Now (2026-09-12) also a real payment/affordability primitive, not just
 * `scripts/prefill-mana-facts.mjs`'s own synergy-FACT generation** —
 * ENGINE_GAPS.md gap #5's own "dual/choice-of-color" remainder, closed:
 * `engine.ts`'s `resolveTop`/`playLand` now store this function's own
 * result on `RealCard.manaAbility` (widened to a real `ManaColor[]` — see
 * that field's own doc comment) whenever the single-color function above
 * doesn't match but this one names two colors, and `sourceColors`/
 * `assignManaRequirements` below genuinely let a dual source pay EITHER of
 * its two colors via real backtracking (not a bigger lookup table — a real
 * per-cast choice, checked exhaustively since the real pool's cost/source
 * sizes are always small enough for that to be both correct and fast).
 *
 * Returns every color the FIRST matching static-ability string names (in
 * printed order) — a single-color match short-circuits the same way the
 * function above does; a choice match returns both colors; neither shape
 * matching (restricted/hybrid/variable, same exclusions as above) returns an
 * empty array, not `undefined` (a caller iterates this one). Colorless
 * (`{C}`) is now a recognized single-color match too (2026-09-09, same
 * `[WUBRGC]` widening as `manaAbilityColorFromStaticText` above) — still
 * only via the single-symbol branch; a `{T}: Add {C} or {X}.` choice-of-
 * color-plus-colorless shape doesn't exist on any real card in this pool,
 * so the choice branch stays WUBRG-only rather than speculatively widened.
 */
export function manaAbilityColorsFromStaticText(staticAbilities?: string[]): ManaColor[] {
  for (const text of staticAbilities ?? []) {
    const single = /^\{T\}: Add \{([WUBRGC])\}\.$/.exec(text);
    if (single) return [single[1] as ManaColor];
    const choice = /^\{T\}: Add \{([WUBRG])\} or \{([WUBRG])\}\.$/.exec(text);
    if (choice) return [choice[1] as ManaColor, choice[2] as ManaColor];
  }
  return [];
}

/**
 * Real, structural mana-ability derivation for a permanent as it enters the
 * battlefield (`engine.ts`'s `resolveTop`/`playLand`, the one real call
 * site) — single-color first (`manaAbilityColorFromStaticText`, stored as a
 * bare `ManaColor`, unchanged shape/behavior from before this pass), then
 * the choice-of-color widening (`manaAbilityColorsFromStaticText`, stored
 * as a real `ManaColor[]`) only when the single-color match fails. A
 * restricted/variable ability (Cargo Ship's own "Spend this mana only to
 * cast an artifact spell...", Elvish Archdruid's own "for each Elf you
 * control") matches NEITHER function, so this correctly returns `undefined`
 * for both — see this file's own header for why those two shapes stay
 * unmodeled.
 */
export function deriveManaAbility(staticAbilities?: string[]): ManaColor | ManaColor[] | undefined {
  const single = manaAbilityColorFromStaticText(staticAbilities);
  if (single) return single;
  const choice = manaAbilityColorsFromStaticText(staticAbilities);
  return choice.length > 0 ? choice : undefined;
}

/** Every color `card` produces as a mana source — a basic land subtype (single-element), or a real `manaAbility` derived at ETB (`RealCard`'s own doc comment; single- or dual-element) — or an empty array if it's neither/not a mana source at all. Supersedes the old single-`ManaColor`-returning `manaColorOf` (2026-09-12, ENGINE_GAPS.md gap #5's dual-color-source closure) — every real caller below now goes through this instead, so a dual land's own TWO producible colors are both genuinely visible to `canAfford`/`payMana`'s own assignment, not just the first. */
function sourceColors(card: RealCard): ManaColor[] {
  if (card.types.includes('Land')) {
    for (const subtype of card.subtypes) {
      const color = BASIC_LAND_COLOR[subtype];
      if (color) return [color];
    }
  }
  if (card.manaAbility === undefined) return [];
  return Array.isArray(card.manaAbility) ? card.manaAbility : [card.manaAbility];
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

/** Whether `sources` (already-filtered untapped mana sources) can cover `cost` — colored + Hybrid pips matched first via `assignManaRequirements` (a real dual-color source may pay either its own color, a real Hybrid pip may be paid by either of its two colors), generic covered by whatever's left. Read-only; doesn't tap anything (see `payMana` for the mutating half). `cost.xCount` is ignored (see `ParsedManaCost.xCount`'s own doc comment — resolve X first via `resolveXCost`). */
export function canAfford(sources: RealCard[], cost: ParsedManaCost): boolean {
  const assigned = assignManaRequirements(sources, coloredRequirementsFor(cost));
  if (assigned === null) return false;
  return sources.length - assigned.length >= cost.generic;
}

/** Taps exactly enough of `sources` to pay `cost` (colored + Hybrid pips first via the same real assignment `canAfford` uses, then generic off whatever's left) — real `payMana` mutation (`state.tap`), not a log-only observation. Throws if `canAfford` would say no, rather than tapping a partial/wrong set. Returns the exact real sources tapped, in order — the same deterministic choice this function already makes, just surfaced instead of thrown away (a caller has no other way to know WHICH lands paid for something; `engine-trace.ts`'s own pilot logging is what this return value exists for). */
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
  for (let i = 0; i < cost.generic; i++) tapCard(remaining[0]!);
  return tapped;
}
