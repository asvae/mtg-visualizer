import type { CardDefinition, Effect } from '../../card';

// Real script (blitzball.txt): two independent activated abilities.
// "{T}: Add one mana of any color" (real Forge `Produced$ Any`, no
// `RestrictValid$`) is a real, structured, UNRESTRICTED `manaAbilities`
// entry — genuinely payable via `mana.ts`'s `canAfford`/`payMana`, the same
// 5-color `assignManaRequirements` backtracking a real choice-of-2 source
// already uses, just with all five colors legal instead of two (closed
// 2026-09-14, ENGINE_GAPS.md gap #5 — this card was never recognized by
// the old text-regex path, since "Add one mana of any color" doesn't match
// either of its two exact WUBRG-symbol shapes; now genuinely payable for
// the first time).
//
// The second ("GOOOOAAAALLL!") ability IS modeled: draw two cards, cost
// {T}+sacrifice-self (cost text only, same "sacrifice is part of the
// cost, not an effect" convention qiqirn-merchant's own bigDraw ability
// uses). "Activate only if an opponent was dealt combat damage by a
// legendary creature this turn" is a real activation restriction with no
// per-turn-event-tracking anywhere in this model (no combat/attack-history
// state exists at all) — kept as real text on `activationCost`, same
// documentary-only treatment every other "activate only if/once" clause in
// this batch gets (crystal-fragments-summon-alexander's own "activate only
// as a sorcery," dark-knight-s-greatsword's own "activate only once each
// turn").
export const blitzball: CardDefinition = {
  name: 'Blitzball',
  manaCost: '{3}',
  typeLine: 'Artifact',

  manaAbilities: [{ colors: ['W', 'U', 'B', 'R', 'G'] }],

  activationCost:
    'GOOOOAAAALLL! — {T}, Sacrifice this artifact (activate only if an opponent was dealt combat damage by a legendary creature this turn)',
  effects: [{ kind: 'drawCard', amount: 2 } satisfies Effect],
};
