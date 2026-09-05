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
//  - Only BASIC lands are recognized as mana sources (real subtype = color:
//    Plains=W, Island=U, Swamp=B, Mountain=R, Forest=G). A dual/nonbasic
//    land, a mana rock, or a real "{T}: Add mana" activated ability
//    (Elvish Archdruid's own real one, e.g.) is NOT a mana source here —
//    real, plainly-flagged gap, same "start narrow" scope this prototype
//    already uses everywhere else.

import type { GameState, RealCard, RealPlayer } from './state';

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';

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

/** The color this real card produces as a mana source, or `undefined` if it isn't one of the basic lands this file recognizes (see header). */
function manaColorOf(card: RealCard): ManaColor | undefined {
  if (!card.types.includes('Land')) return undefined;
  for (const subtype of card.subtypes) {
    const color = BASIC_LAND_COLOR[subtype];
    if (color) return color;
  }
  return undefined;
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
