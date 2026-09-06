// Simplified mana-cost affordability — real Forge parses a cost string into
// `ManaCostShard`s (forge-game/src/main/java/forge/game/mana/ManaCostShard.java)
// and pays against a real spendable `ManaPool` (`ManaPool.java`). This
// prototype has no spendable mana pool at all (see interfaces.ts's own
// `Player.addMana` doc comment — a deliberately inert observation point, no
// ManaPool modeled anywhere), so "afford" here means something narrower:
// does the caster control enough UNTAPPED mana sources to cover a parsed
// cost, checked and PAID (tapped) atomically, all-or-nothing.
//
// Explicit scope, matching this file's own header convention elsewhere in
// functional-model/*.ts:
//  - Generic ({N}) and the five colored pips ({W}{U}{B}{R}{G}) only. Hybrid
//    ({W/U}), Phyrexian ({U/P}), colorless-specific ({C}), and X in a cost
//    are NOT parsed — `parseManaCost` throws on one rather than silently
//    mis-costing it.
//  - Basic lands (real subtype = color: Plains=W, Island=U, Swamp=B,
//    Mountain=R, Forest=G), PLUS a narrow real slice of non-basic mana
//    sources: any permanent whose `CardDefinition.staticAbilities`
//    contains an EXACT, single-color, unrestricted "{T}: Add {X}." string
//    (`manaAbilityColorFromStaticText` below) is recognized too — checked
//    against the real pool: 10 real cards qualify (Druid of the Cowl,
//    Goobbue Gardener, Llanowar Elves — all creatures, so 302.6
//    summoning-sickness applies, handled in `engine.ts`; Midgar, Ishgard,
//    Jidoor, Lindblum, Zanarkand — Adventure lands; White Auracite, an
//    artifact; Willowrush Verge, a plain land). Still explicitly NOT
//    recognized: a dual/choice-of-color ability ("{T}: Add {G} or {U}." —
//    correctly affording a payable cost through this would mean a real
//    bipartite-matching assignment problem, not just a bigger lookup
//    table), a restricted one ("Activate only if...", "Spend this mana
//    only to..."), a colorless one ({C} — `parseManaCost` itself doesn't
//    parse {C} at all, see gap #6), or a variable one (Elvish Archdruid's
//    own "Add {G} for each Elf you control" — not a fixed single symbol).
//    A mana rock with one of THOSE shapes remains a real, separately
//    tracked gap.

import type { GameState, RealCard, RealPlayer } from './state';

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';

/** The five basic land names — shared here so callers (harness.ts's `PlayerState.basicLands`, e.g.) don't duplicate this union inline. */
export type BasicLandName = 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest';

export interface ParsedManaCost {
  generic: number;
  colors: Partial<Record<ManaColor, number>>;
}

const BASIC_LAND_COLOR: Record<string, ManaColor> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
};

const COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

const LAND_FOR_COLOR: Record<ManaColor, BasicLandName> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

/** Parses a real printed mana-cost string (`{2}{U}{U}`) into generic + colored-pip counts. Throws on any symbol outside this file's own declared scope (see header) — a clear signal, not a silently wrong count. */
export function parseManaCost(cost: string): ParsedManaCost {
  const parsed: ParsedManaCost = { generic: 0, colors: {} };
  const tokens = cost.match(/\{[^}]+\}/g) ?? [];
  for (const token of tokens) {
    const inner = token.slice(1, -1);
    if (/^\d+$/.test(inner)) {
      parsed.generic += Number(inner);
      continue;
    }
    if ((COLORS as string[]).includes(inner)) {
      const color = inner as ManaColor;
      parsed.colors[color] = (parsed.colors[color] ?? 0) + 1;
      continue;
    }
    throw new Error(`parseManaCost: unsupported mana symbol {${inner}} in "${cost}" (hybrid/Phyrexian/X/generic-colorless not modeled — see this file's own header)`);
  }
  return parsed;
}

/**
 * Scenario-setup convenience (harness.ts's `PlayerState.basicLands` /
 * `engine.ts` test helpers): one basic land per colored pip in `cost`,
 * generic pips filled by round-robining whichever colors the cost already
 * needs (so `{2}{G}` yields `[Forest, Forest, Forest]`, not `[Forest,
 * Mountain]`-by-arbitrary-default) — falls back to an all-Forest count
 * (`generic` + 1) when the cost has zero colored pips, since some real land
 * has to be picked and Forest is this file's own arbitrary-but-consistent
 * default elsewhere (`manaColorOf`'s subtype table order, e.g.). Does not
 * itself validate `cost` — reuses `parseManaCost`, so the same throw
 * applies to an unsupported symbol.
 */
export function basicLandsFor(cost: string): BasicLandName[] {
  const parsed = parseManaCost(cost);
  const neededColors = COLORS.filter((c) => (parsed.colors[c] ?? 0) > 0);
  const lands: BasicLandName[] = [];
  for (const color of neededColors) {
    for (let i = 0; i < (parsed.colors[color] ?? 0); i++) lands.push(LAND_FOR_COLOR[color]);
  }
  if (neededColors.length === 0) {
    for (let i = 0; i < parsed.generic + 1; i++) lands.push('Forest');
  } else {
    for (let i = 0; i < parsed.generic; i++) lands.push(LAND_FOR_COLOR[neededColors[i % neededColors.length]!]);
  }
  return lands;
}

/**
 * Recognizes a real, narrow slice of non-basic "{T}: Add mana" static
 * abilities (see this file's own header) — the string must be EXACTLY
 * `{T}: Add {X}.` (X a single real color), with no restriction/"spend
 * only"/multi-symbol text attached, or it's correctly ignored (still a
 * real static ability text-wise — `staticAbilities` is unaffected either
 * way — just not modeled as a payable source). Returns the FIRST such
 * match across `staticAbilities` (Willowrush Verge has a second,
 * restricted `{T}: Add {G}` entry that's correctly skipped, while its
 * first, unrestricted `{T}: Add {U}` still qualifies).
 */
export function manaAbilityColorFromStaticText(staticAbilities?: string[]): ManaColor | undefined {
  for (const text of staticAbilities ?? []) {
    const match = /^\{T\}: Add \{([WUBRG])\}\.$/.exec(text);
    if (match) return match[1] as ManaColor;
  }
  return undefined;
}

/** The color this real card produces as a mana source — a basic land subtype, or a real `manaAbility` derived at ETB (see `RealCard`'s own doc comment) — or `undefined` if it's neither. */
function manaColorOf(card: RealCard): ManaColor | undefined {
  if (card.types.includes('Land')) {
    for (const subtype of card.subtypes) {
      const color = BASIC_LAND_COLOR[subtype];
      if (color) return color;
    }
  }
  return card.manaAbility;
}

/** Every untapped real mana source (see `manaColorOf`) this player currently controls. */
export function untappedManaSources(player: RealPlayer): RealCard[] {
  return player.battlefield.filter((c) => !c.tapped && manaColorOf(c) !== undefined);
}

/** Whether `sources` (already-filtered untapped mana sources) can cover `cost` — colored pips matched first (greedy, no cross-color substitution since a basic land only ever produces its own color), generic covered by whatever's left. Read-only; doesn't tap anything (see `payMana` for the mutating half). */
export function canAfford(sources: RealCard[], cost: ParsedManaCost): boolean {
  const remaining = [...sources];
  for (const color of COLORS) {
    const need = cost.colors[color] ?? 0;
    for (let i = 0; i < need; i++) {
      const idx = remaining.findIndex((c) => manaColorOf(c) === color);
      if (idx === -1) return false;
      remaining.splice(idx, 1);
    }
  }
  return remaining.length >= cost.generic;
}

/** Taps exactly enough of `sources` to pay `cost` (colored pips first, then generic off whatever's left) — real `payMana` mutation (`state.tap`), not a log-only observation. Throws if `canAfford` would say no, rather than tapping a partial/wrong set. */
export function payMana(state: GameState, sources: RealCard[], cost: ParsedManaCost): void {
  if (!canAfford(sources, cost)) throw new Error('payMana: cannot afford this cost with the given sources');
  const remaining = [...sources];
  const tapMatching = (predicate: (c: RealCard) => boolean) => {
    const idx = remaining.findIndex(predicate);
    const card = remaining[idx]!;
    remaining.splice(idx, 1);
    state.tap(card);
  };
  for (const color of COLORS) {
    const need = cost.colors[color] ?? 0;
    for (let i = 0; i < need; i++) tapMatching((c) => manaColorOf(c) === color);
  }
  for (let i = 0; i < cost.generic; i++) tapMatching(() => true);
}
