import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { you, selectUpTo, applyToBound, putCounter, grantKeyword, branch, hasSubtype, drawCard } from '../../combinator';

// A transforming DFC — same `backFace` shape jecht-reluctant-guardian-braska-s-
// final-aeon/dion-bahamut-s-dominant-bahamut-warden-of-light/crystal-fragments-
// summon-alexander already establish: a second, independent `CardDefinition`,
// reached via `Scenario.face: 'back'`. Real `DB$ SetState | Mode$ Transform`
// (a direct flip, not an exile-based transform) is modeled the SAME way
// those other DFCs' own front faces already are — `moveTo(self, 'Exile')`
// then `moveTo(self, 'Battlefield')` as the closest available stand-in for
// "this permanent transforms" (no "which face is currently showing" state
// exists anywhere in this model beyond `backFace` being a second static
// CardDefinition; see jecht's own comment for the fuller citation) — kept
// consistent with that precedent rather than invented fresh here.
export const venatHeartOfHydaelyn: CardDefinition = {
  name: 'Venat, Heart of Hydaelyn',
  manaCost: '{1}{W}{W}',
  typeLine: 'Legendary Creature — Elder Wizard',

  pt: [3, 3],

  triggers: [
    {
      // "Whenever you cast a legendary spell, draw a card. This ability
      // triggers only once each turn." Real `ActivationLimit$ 1` — a
      // per-turn trigger-frequency cap; no turn-counter/activation-limit
      // state exists anywhere in this model (same real, flagged gap
      // G'raha Tia's own "Allagan Eye" comment already documents) — a
      // scenario exercises the trigger firing once, which is all
      // `resolveCard()` ever does per call regardless.
      name: 'onCastLegendarySpell',
      effects: [{ kind: 'drawCard' } satisfies Effect],
    },
  ],

  // "Hero's Sundering — {7}, {T}: Exile target nonland permanent. Transform
  // Venat. Activate only as a sorcery." PARTIALLY MIGRATED (2026-09-16,
  // fin/26-50 follow-up) — the "exile target nonland permanent" half is now
  // a real declarative `move` effect: `move`'s own targeted branch already
  // has both a real `nonLand` filter (Jill, Shiva's Dominant's own
  // precedent) and an unrestricted (no `owner`) candidate pool (Coeurl/
  // Dion's own precedent). An earlier version of this card excluded
  // `ctx.self` from the exile-target pool via a hand-rolled filter — the
  // real printed text has no "another" restriction at all (Venat COULD
  // legally target itself), so that exclusion was never a real textual
  // claim, only a scenario-engineering workaround for `chooseTarget`'s own
  // "always the first pool candidate absent a real choice" default; this
  // card's own scenario already supplies a real `preferTarget` for this
  // exact activation (see scenarios.ts), so dropping the workaround changes
  // nothing observable and is MORE faithful to the real, unrestricted
  // printed text, not less.
  //
  // "Transform Venat" itself STAYS `custom` (`sequence('Exile',
  // 'Battlefield')`, `combinator.ts`'s own real node for this same exile/
  // re-enter transform stand-in, was tried here and reverted — that node
  // specifically models Crystal Fragments'/Dion's own LITERAL printed text,
  // "Exile this [X], then return it to the battlefield transformed" —
  // checked directly against both of their own real Scryfall oracle text,
  // confirmed verbatim. Venat's own real printed text says only "Transform
  // Venat," never that exile/return phrasing at all — using `sequence()`
  // here would be a real, false textual claim this card's own printed text
  // doesn't make, even though the ENGINE-LEVEL trick (exile then re-add) is
  // the same stand-in either way; `sequenceExileReturn-effect-structural`
  // correctly declined this exact mismatch when tried, which is why this
  // half stays `custom` rather than being forced into that recognizer's
  // scope).
  activationCost: '{7}, {T}',
  effects: [
    { kind: 'move', from: 'Battlefield', to: 'Exile', qty: 1, validType: 'any', nonLand: true, target: true } satisfies Effect,
    {
      kind: 'custom',
      describe: 'transform Venat (activate only as a sorcery)',
      run: (ctx: EffectContext, actions: Actions) => {
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
      },
    } satisfies Effect,
  ],

  backFace: {
    name: 'Hydaelyn, the Mothercrystal',
    manaCost: '',
    typeLine: 'Legendary Creature — God',

    pt: [4, 4],
    keywords: ['Indestructible'],

    triggers: [
      {
        // "Blessing of Light — At the beginning of combat on your turn,
        // put a +1/+1 counter on another target creature you control.
        // Until your next turn, it gains indestructible. If that creature
        // is legendary, draw a card." Migrated (2026-09-16, engine-lane
        // primitive build) off a `kind:'custom'` closure onto `kind:
        // 'program'`, now that `program-ast-walker.ts` has real occurrence
        // support for a bound `putCounter`/`grantKeyword` `EachAction` PLUS
        // combinator.ts's own `DrawCard` node exists for the bare "draw a
        // card" consequence a `Branch` can gate — see both files' own
        // 2026-09-16 doc comments (this was the confirmed, documented
        // blocker, not a hypothetical one). `selectUpTo(...filter
        // ('excludeSelf'), 1, 'target', ...)` picks the SAME real target
        // once, reused by both `applyToBound` calls AND the `hasSubtype`
        // branch condition, exactly like the old `custom` closure's own
        // single `chooseTarget` call did (`excludeSelf` covers "another,"
        // `hasSubtype(..., 'Legendary')` covers the conditional draw's own
        // real gate). "Until your next turn" (a duration distinct from
        // "until end of turn") is still NOT tracked — same accepted
        // `state.grantKeyword`/`layers.ts` duration-agnostic simplification
        // every other keyword grant in this pool already accepts (the
        // `grantKeyword` builder's own `untilEndOfTurn` param is
        // deliberately omitted here, same as the old closure's own bare
        // `actions.grantKeyword(target, 'Indestructible')` call) — the
        // grant is mechanically real (a later `hasKeyword`/
        // `effectiveKeywords` check on the target genuinely sees it) but
        // persists for the rest of a scenario rather than expiring on cue.
        name: 'onBeginCombat',
        effects: [
          {
            kind: 'program',
            describe:
              "Blessing of Light — put a +1/+1 counter on another target creature you control; until your next turn it gains indestructible; if that creature is legendary, draw a card",
            program: selectUpTo(you.creaturesInPlay().filter('excludeSelf'), 1, 'target', [
              applyToBound('target', 0, putCounter('+1/+1', 1)),
              applyToBound('target', 0, grantKeyword('Indestructible')),
              branch(hasSubtype('target', 0, 'Legendary'), [drawCard()]),
            ]),
          } satisfies Effect,
        ],
      },
    ],
  },
};
