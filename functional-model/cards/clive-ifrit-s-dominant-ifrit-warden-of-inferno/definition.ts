import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// A transforming DFC whose front face has its OWN activated transform
// ability (unlike jecht-reluctant-guardian-braska-s-final-aeon's own
// damage-triggered version) — same `backFace` + `custom` exile/return
// pattern that card established, see its own definition.ts header for the full
// reasoning on why a transform is modeled as `custom` here.
//
// Real gaps hit on this card, all flagged to the parent session rather
// than approximated:
//  - Front face ETB ("you may discard your hand, then draw cards equal to
//    your devotion to red") needs `Count$Devotion.Red` — the number of
//    {R} pips across the mana costs of permanents you control. No
//    Card/Player method anywhere exposes a permanent's own mana cost pips
//    (getCMC() gives total mana VALUE, not per-color pip counts) — devotion
//    can't be computed at all, so this whole trigger is omitted rather than
//    modeling only the discard half (which alone would misrepresent a
//    card whose entire point is the redraw).
//  - Back face chapter I ("Ifrit fights up to one other target creature")
//    needs a real `fight` — both creatures deal damage to EACH OTHER equal
//    to power. No Effect kind supports the reverse direction (a chosen
//    target dealing ITS power back to `self`) — `dealDamage`/
//    `dealDamageTarget` only ever have `self` as source. Omitted.
//  - Back face chapters II/III ("Add {R}{R}{R}{R}") need a mana-producing
//    action — nothing in this model tracks a mana pool at all (state.ts's
//    own header rules out anything beyond its stated action vocabulary).
//    Omitted, including the self-transform-back sub-effect that's tied to
//    chapter III's own mana-adding text (building just the transform half
//    without its funding purpose would misrepresent the chapter).
export const cliveIfritsDominant: CardDefinition = {
  name: "Clive, Ifrit's Dominant",
  manaCost: '{4}{R}{R}',
  typeLine: 'Legendary Creature — Human Noble Warrior',

  pt: [5, 5],

  activationCost: '{4}{R}{R}, {T} (activate only as a sorcery)',
  effects: [
    {
      kind: 'custom',
      describe: "exile Clive, then return it to the battlefield transformed under its owner's control",
      run: (ctx: EffectContext, actions: Actions) => {
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
      },
    } satisfies Effect,
  ],

  backFace: {
    name: 'Ifrit, Warden of Inferno',
    manaCost: '',
    typeLine: 'Legendary Enchantment Creature — Saga Demon',
    pt: [9, 9],
    // Chapter I (fight) and chapters II/III (add mana, then transform back)
    // are both real gaps — see this file's own header. No `triggers` here
    // at all rather than a partial, misleading representation.
  },
};
