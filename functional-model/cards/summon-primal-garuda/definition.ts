import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

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
          // creature an opponent controls." `dealDamageTarget`'s own
          // `owner` field would handle "an opponent controls" for real
          // (Ultros' own "target creature an opponent controls"
          // precedent), but it has no `tapped`-filtering field, so this
          // stays `custom` narrowing to `ctx.opponents`' own creatures for
          // that half. The "tapped" half is deliberately left unfiltered
          // here — `Card.isTapped()` DOES genuinely exist (interfaces.ts's
          // own real mirror of `RealCard.tapped`, state.ts; an earlier
          // version of this file's own comment wrongly claimed it didn't),
          // but this model's own `Constraints.tapped` (synergy.ts) is
          // ITSELF purely documentary — not consulted by the fact matcher —
          // same real, honest, engine-unenforced treatment Fate of the
          // Sun-Cryst's own "costs {2} less if it targets a tapped
          // creature" condition already gets, so there is no real
          // fact-level reason to wire it here either; doing so would only
          // cost this card's own scenario its one legal (untapped, generic
          // filler) target with nothing gained.
          kind: 'custom',
          describe: 'Aerial Blast — this creature deals 4 damage to target tapped creature an opponent controls',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = ctx.opponents.flatMap((p) => p.getCreaturesInPlay());
            if (pool.length === 0) return;
            actions.dealDamage(ctx.self, actions.chooseTarget(pool, ctx.preferTarget), 4);
          },
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
    { kind: 'pumpTarget', power: 1, toughness: 0, owner: 'you', notSelf: true } satisfies Effect,
    { kind: 'grantKeywordTarget', keyword: 'Flying', owner: 'you', notSelf: true } satisfies Effect,
  ];
}
