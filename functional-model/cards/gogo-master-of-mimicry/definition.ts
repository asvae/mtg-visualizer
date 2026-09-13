import type { CardDefinition, Effect } from '../../card';

// Real Forge script (../mtg-forge/forge-gui/res/cardsfolder/g/
// gogo_master_of_mimicry.txt): `A:AB$ CopySpellAbility | CantCopy$ True |
// Cost$ XMin1 X X T | ValidTgts$ Card,Emblem | TgtPrompt$ Select target
// activated or triggered ability you control | TargetType$
// Activated.YouCtrl,Triggered.YouCtrl | Amount$ X | MayChooseTarget$ True |
// SVar:X:Count$xPaid`. Oracle (data/fin/fin_scryfall.json, fin/54, matches):
// "{X}{X}, {T}: Copy target activated or triggered ability you control X
// times. You may choose new targets for the copies. This ability can't be
// copied and X can't be 0. (Mana abilities can't be targeted.)"
//
// The COST is real and genuinely payable through this engine's existing
// machinery, unmodified: `Cost$ ... X X T` is exactly the same "two `{X}`
// symbols sharing one chosen value" shape `mana.ts`'s own `ParsedManaCost
// .xCount`/`resolveXCost` was already built for (CR 107.3c, closed
// 2026-09-12, ENGINE_GAPS.md gap #6) — `activationCost: '{X}{X}, {T}'`
// parses as `xCount: 2`, folding to `generic: 2*x` exactly like Rydia,
// Summoner of Mist's own single-`{X}` ability already does (rydia-
// summoner-of-mist/definition.ts), just with two pips instead of one. `Cost
// $ XMin1 ...` (X can't be 0) has no structured minimum-X field on
// `canActivateAbility`/`effectiveActivationCost` anywhere in this engine
// (rydia's own ability has no such minimum either) — left as real,
// documented text only, same "not every free-text constraint is
// mechanically enforced" convention `canActivateAbility`'s own doc comment
// already states for other cost shapes it accepts without fully policing.
//
// The EFFECT ("Copy target activated or triggered ability you control X
// times") is genuinely NOT modelable, checked directly against `card.ts`'s
// `Effect` union and `interfaces.ts`'s own `Actions`: there is no
// stack-object model for an ability at all (only `copyPermanent` for a
// permanent already on the battlefield, `CardFactory.copyCard`-shaped) —
// the exact same wall `ether/definition.ts`'s own doc comment documents for
// copying a SPELL on the stack ("`card.ts`'s `Effect` union has no `kind`
// for copying an object on the stack ... no stack-object model exists to
// duplicate an object off of in the first place"). Gogo's own text is a
// THIRD, even narrower case than that one (an ACTIVATED OR TRIGGERED
// ABILITY specifically, not a spell) — nothing in this pool has ever needed
// any of the three, and building a real stack-object/ability-copy
// mechanism is out of scope for a single card. Kept as a `custom` no-op
// purely so `synergyTags()` still sees the real text, same "described but
// not executed" treatment `seifer-almasy`'s own Fire Cross clause and
// `noctis-prince-of-lucis`'s own graveyard-cast permission already get for
// an unrepresentable clause.
export const gogoMasterOfMimicry: CardDefinition = {
  name: 'Gogo, Master of Mimicry',
  manaCost: '{2}{U}',
  typeLine: 'Legendary Creature — Wizard',

  pt: [2, 4],

  activationCost: '{X}{X}, {T}',
  effects: [
    {
      kind: 'custom',
      describe:
        "copy target activated or triggered ability you control X times; you may choose new targets for the copies; this ability can't be copied and X can't be 0 (mana abilities can't be targeted) — not mechanically enforced, no stack-object/ability-copy mechanism exists anywhere in this model",
      run: () => {},
    } satisfies Effect,
  ],
};
