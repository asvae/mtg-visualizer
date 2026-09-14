import type { CardDefinition, Effect, EffectContext } from '../../card';

export const elvishArchdruid: CardDefinition = {
  name: 'Elvish Archdruid',
  manaCost: '{1}{G}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [2, 2],

  // The anthem is still documentary-only: no ptFormula shape exists for
  // "other creatures of a subtype get a flat CONTINUOUS bonus" (only
  // addPerEquipmentControlled/setToCreaturesControlled exist, both self-only
  // — same gap Thranduil, Sindarin Liege's own anthem hits) — this is a real
  // engine-architecture gap (state.ts's layer system has no board-wide
  // "grant others a static bonus" concept at all), not something a single
  // card's own definition.ts can work around. Flagged as a real, recurring
  // gap worth real infra investment (multiple cards hit it now), not fixed
  // here.
  staticAbilities: ['Other Elf creatures you control get +1/+1.'],

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
