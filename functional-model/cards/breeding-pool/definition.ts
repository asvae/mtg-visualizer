import type { CardDefinition, Effect } from '../../card';

export const breedingPool: CardDefinition = {
  name: 'Breeding Pool',
  manaCost: '',
  typeLine: 'Land — Forest Island',

  // No `manaAbilities` entry needed — confirmed against the real shipped
  // script (`res/cardsfolder/b/breeding_pool.txt`): unlike every OTHER real
  // FIN dual-color land in this pool, Breeding Pool has NO explicit `A:AB$
  // Mana` line at all. Real Forge derives its `{T}: Add {G} or {U}.`
  // automatically from its own printed basic land types (Forest + Island),
  // the same way a plain Forest/Island itself never needs one either — a
  // genuine, real, fixed bug in `mana.ts`'s own `sourceColors` used to
  // silently drop this: the basic-land-subtype branch used to stop at the
  // FIRST matching subtype, so this card only ever produced `G`, never `U`,
  // through this engine (fixed 2026-09-14 alongside this migration —
  // `sourceColors` now collects EVERY matching basic-land-subtype color,
  // not just the first).
  //
  // "As this land enters, you may pay 2 life. If you don't, it enters
  // tapped." — a real binary choice with no player-decision engine
  // anywhere (same "always takes the action" simplification `optional`
  // fields elsewhere document): modeled as ALWAYS paying the 2 life, never
  // entering tapped — the untapped/paid-life branch, not the tapped/free
  // branch.
  triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'loseLife', owner: 'you', amount: 2 } satisfies Effect] }],
};
