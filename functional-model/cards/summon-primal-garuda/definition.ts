import type { CardDefinition, Effect } from '../../card';

// Real 714.3a/b Saga chapters modeled as named `triggers`, same
// simplification jecht-reluctant-guardian-braska-s-final-aeon/summon-bahamut/
// summon-choco-mog already document (turn-based-action precision traded for
// reusing the existing multi-trigger mechanism). Real `K:Chapter:3:DBDmg,
// DBPump,DBPump` — chapters II and III both point at the SAME real Forge
// SVar (Slipstream), matching "II, III — Slipstream" on the printed card,
// same repeated-SVar shape summon-bahamut/summon-choco-mog's own chapters
// already establish.
export const summonPrimalGaruda: CardDefinition = {
  name: 'Summon: Primal Garuda',
  manaCost: '{3}{W}',
  typeLine: 'Enchantment Creature — Saga Harpy',

  pt: [3, 3],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'chapterI',
      effects: [
        {
          // "Aerial Blast — This creature deals 4 damage to target tapped
          // creature an opponent controls." Migrated (2026-09-16) off the
          // old `kind:'custom'` closure now that `dealDamageTarget` has a
          // real `tapped` filter (`card.ts`, real `Card.isTapped()`/
          // `RealCard.tapped` — see that field's own doc comment): `owner:
          // 'opponents'` covers "an opponent controls" (same Ultros
          // precedent), `tapped: true` covers the real TAPPED restriction
          // — both are now genuine, state-mutating pool filters, not
          // documentary-only (unlike `Constraints.tapped` (synergy.ts),
          // which stays purely informational on the FACT side; this is the
          // EFFECT side, a real runtime restriction on `resolveTargets`'s
          // own candidate pool). `scenarios.ts`'s own opponent filler now
          // seeds a real pre-tapped creature (`creaturesTapped: true`,
          // harness.ts) so this still has a legal target to land on.
          kind: 'dealDamageTarget',
          amount: 4,
          owner: 'opponents',
          tapped: true,
        } satisfies Effect,
      ],
    },
    {
      name: 'chapterII',
      effects: slipstream(),
    },
    {
      name: 'chapterIII',
      effects: slipstream(),
    },
  ],
};

function slipstream(): Effect[] {
  // "Slipstream — Another target creature you control gets +1/+0 and
  // gains flying until end of turn." Two real, distinct Effect kinds —
  // `pumpTarget` has no combined P/T-plus-keyword-grant shape — same split
  // Gladiolus Amicitia's own "another target creature you control gets
  // +2/+2 and gains trample" already establishes. Both real, not
  // documentary: `grantKeywordTarget` mechanically mutates the chosen
  // real card's own `keywords` (state.ts's own `grantKeyword`), same as
  // Restoration Magic/Moogles' Valor's own real grants in this batch — the
  // "not mechanically enforced" framing an earlier version of this file
  // used predates both cards' own fixes and no longer applies.
  // `chooseTarget`'s deterministic first-candidate pool ordering lands
  // both effects on the SAME creature whenever (as in this card's own
  // scenario) there's exactly one legal "another" candidate.
  return [
    { kind: 'pumpTarget', power: 1, toughness: 0, owner: 'you', notSelf: true, untilEndOfTurn: true } satisfies Effect,
    { kind: 'grantKeywordTarget', keyword: 'Flying', owner: 'you', notSelf: true, untilEndOfTurn: true } satisfies Effect,
  ];
}
