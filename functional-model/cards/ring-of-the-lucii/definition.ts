import type { CardDefinition, Effect } from '../../card';

// Real script (ring_of_the_lucii.txt): Legendary Artifact with two
// independent activated abilities. The mana ability ("{T}: Add {C}{C}") is
// a real, structured `manaAbilities` entry (`Cost$ T | Produced$ C |
// Amount$ 2`) — the one real FIN card in this pool whose own mana ability
// produces MORE than 1 unit per tap; `mana.ts`'s `canAfford`/`payMana` now
// genuinely count this toward 2 GENERIC mana (closed 2026-09-14,
// ENGINE_GAPS.md gap #5 — this card was never recognized by the old
// text-regex path at all, since `{T}: Add {C}{C}.` doesn't match either of
// its two exact single-/dual-color shapes; now genuinely payable for the
// first time). "Tap target nonland permanent" — `tapTarget`'s own
// `validType` union has no "nonland" filter (only creature/artifact/land/
// creature-or-artifact/any); `'creature-or-artifact'` is the closest real
// fit (loses only the enchantment case), same approximation
// omega-heartless-evolution's own identical "tap target nonland permanent"
// clause already establishes. `ValidTgts$ Permanent.nonLand` carries no
// controller restriction, so `owner` stays omitted (the default combined
// pool).
//
// recognizer-exception: tapTarget-effect-structural — this card's own real
// text is "target NONLAND PERMANENT," never "target artifact or creature"
// (`tapTarget-effect-structural`'s own 2026-09-16 widening added a
// confirmed template for the LATTER, narrower phrase, ice-flan's own real
// text, not this card's broader one) — a known, already-documented
// approximation (see the comment above), not a recognizer bug.
export const ringOfTheLucii: CardDefinition = {
  name: 'Ring of the Lucii',
  manaCost: '{4}',
  typeLine: 'Legendary Artifact',

  manaAbilities: [{ colors: ['C'], amount: 2 }],

  abilities: [
    {
      name: 'tapNonland',
      cost: '{2}, {T}, Pay 1 life',
      effects: [{ kind: 'loseLife', owner: 'you', amount: 1 } satisfies Effect, { kind: 'tapTarget', validType: 'creature-or-artifact' } satisfies Effect],
    },
  ],
};
