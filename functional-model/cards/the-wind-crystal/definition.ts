import type { CardDefinition, Effect } from '../../card';

export const theWindCrystal: CardDefinition = {
  name: 'The Wind Crystal',
  manaCost: '{2}{W}{W}',
  typeLine: 'Legendary Artifact',

  // 'LifegainDouble' (ENGINE_GAPS.md gap #8b, closed) — a real, structured
  // keyword replacing the old freeform half of `staticAbilities` below for
  // "If you would gain life, you gain twice that much life instead." Real
  // Forge citation, `res/cardsfolder/t/the_wind_crystal.txt`'s own shipped
  // script: `R:Event$ GainLife | ActiveZones$ Battlefield | ValidPlayer$ You
  // | ReplaceWith$ GainDouble ... SVar:X:ReplaceCount$LifeGained/Twice` — a
  // real per-player CR 614.2 self-replacement (general `ReplacementEffect`
  // machinery this engine doesn't have), checked at `state.gainLife`'s own
  // one real chokepoint instead (see that method's own doc comment).
  // Approximated via the SAME keyword-grant machinery `card.ts`'s own
  // `Keyword` doc comment already establishes for `'Unblockable'` — not a
  // name-matched freeform string anymore.
  keywords: ['LifegainDouble'],

  // "White spells you cast cost {1} less to cast." — CLOSED (2026-09-12,
  // ENGINE_GAPS.md gap #7's second example): a real, unconditional,
  // color-gated BROADCAST cost reduction onto OTHER spells this permanent's
  // controller casts — `card.ts`'s new `SpellCostReductionGrant` (real
  // Forge citation, `res/cardsfolder/t/the_wind_crystal.txt`: `S:Mode$
  // ReduceCost | ValidCard$ Card.White | Type$ Spell | Activator$ You |
  // Amount$ 1 | ...`). `engine.ts`'s `canCastSpell`/`castSpell` now sum every
  // matching grant on the CASTER's own battlefield (`state.ts`'s
  // `activeSpellCostDiscount`) against the cast spell's own colored mana-cost
  // pips — a genuinely different mechanism from `CostReduction` (Fate of the
  // Sun-Cryst's own target-conditional SELF-discount), replacing the old
  // documentary-only `staticAbilities` text now that it's real, same
  // "structured field replaces free text once real" convention
  // `continuousKeywordGrants`'s own cards already established.
  spellCostReductionGrants: [{ amount: 1, colors: ['W'] }],

  // "{4}{W}{W}, {T}: Creatures you control gain flying and lifelink until
  // end of turn." — a real board-wide KEYWORD-ONLY grant, now mechanically
  // real: `grantKeywordAll` (card.ts, Ardyn/Circle of Power/Moogles' Valor
  // precedent) genuinely mutates every creature-you-control's real
  // `keywords` via `state.grantKeyword` — a later Flying/Lifelink check
  // (attacking without being blocked by a non-flyer; `state.dealDamage`'s
  // own life-gain path) really reflects both grants. Two separate calls,
  // one per keyword — no Effect kind grants more than one keyword at once
  // (same "one call per keyword" convention Restoration Magic's own Cure/
  // Cura/Curaga modes already establish). **Real bug fixed 2026-09-15**:
  // both effects below were missing `untilEndOfTurn: true` entirely (this
  // comment used to say duration "isn't tracked... not enforced here," but
  // that was itself the bug, not a design choice — `state.ts`'s own real
  // 514.2 Cleanup removal (`clearUntilEndOfTurnKeywordGrants`) genuinely
  // does clear an `untilEndOfTurn: true` grant; an omitted flag silently
  // meant PERMANENT-within-scenario instead of the real card's actual
  // "until end of turn" duration). Now real and enforced, same as every
  // other `grantKeyword*` effect in this pool.
  activationCost: '{4}{W}{W}, {T}',
  effects: [
    { kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'Flying', untilEndOfTurn: true } satisfies Effect,
    { kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'Lifelink', untilEndOfTurn: true } satisfies Effect,
  ],
};
