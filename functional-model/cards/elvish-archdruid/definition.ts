import type { CardDefinition, Effect, EffectContext } from '../../card';

export const elvishArchdruid: CardDefinition = {
  name: 'Elvish Archdruid',
  manaCost: '{1}{G}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [2, 2],

  // The anthem is now real, executable `continuousPTGrants` with a
  // `subtype` broadcast (2026-09-16, static-ability audit) — the SAME
  // real, already-existing `qualifiesForContinuousGrant` mechanism
  // `continuousKeywordGrants`' own subtype-scoped siblings (Ardyn's
  // "Demons you control," Dion's "other Knights you control") already use,
  // just applied to `continuousPTGrants` instead (that field's own doc
  // comment already covers this exact shape — `state.ts`'s `effectivePT`
  // reads it live). This comment used to claim no such mechanism existed
  // at all; that was stale/wrong by the time this audit checked — the
  // shared broadcast machinery already generalizes across all three grant
  // families. Elvish Archdruid is a cross-set reference card with no real
  // oracle text checked in anywhere under `data/*/*_scryfall.json` (same
  // gap `addMana-effect-structural.test.ts`'s own module doc comment
  // already documents for its mana ability) — the mechanical grant above
  // is genuinely real and live either way (`ptFormula`/`continuousPTGrants`
  // never depend on oracle text at runtime, only the recognizer/synergy
  // layer does), it just can't be auto-tagged into `synergy.json` via
  // `apply-recognizers.mjs` for this specific card.
  staticAbilities: ['Other Elf creatures you control get +1/+1.'],
  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, subtype: 'Elf' }],

  // The mana ability now has real (if deliberately inert) engine support —
  // see interfaces.ts's own `Player.addMana` doc comment: it leaves a real,
  // checkable trace line but adds nothing to a spendable pool (none
  // modeled). "for each Elf you control" counts itself (Elvish Archdruid is
  // itself an Elf) — real printed text has no "other" qualifier here,
  // unlike the anthem line above.
  //
  // NOT migrated to `card.ts`'s new `manaAbilities`/`ManaAbility
  // .variableAmount: {kind:'countSubtypeControlled', subtype:'Elf'}` shape
  // (2026-09-14, ENGINE_GAPS.md gap #5) — this card was never on the
  // free-text violation `manaAbilities` closes in the first place: its own
  // `activationCost`+`effects` below is ALREADY a real, genuinely
  // executable `Computed` amount, strictly better than the new field's own
  // still-unwired `variableAmount` (see that field's own doc comment for
  // why board-counted amounts aren't yet threaded into `canAfford`/
  // `payMana`). `variableAmount`'s `countSubtypeControlled` shape exists
  // for OTHER real cards with this exact printed pattern that had nothing
  // but free text before this pass — switching this card TO it would be a
  // real regression, not a migration.
  activationCost: '{T}',
  effects: [
    {
      kind: 'addMana',
      color: 'G',
      amount: (ctx: EffectContext) => ctx.you.getCreaturesInPlay().filter((c) => c.hasSubtype('Elf')).length,
    } satisfies Effect,
  ],
};
