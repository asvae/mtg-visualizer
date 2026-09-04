import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (aettir_and_priwen.txt): a real layer-7 continuous effect on
// the EQUIPPED creature — "Equipped creature has base power and toughness
// X/X, where X is your life total" (S:Mode$ Continuous | SetPower$ X |
// SetToughness$ X | SVar:X:Count$YourLifeTotal). `CardDefinition.ptFormula`
// only covers a CDA on `self`'s OWN P/T (state.ts's own `effectivePT`
// reads `card.ptFormula` for that same card, never a card it's attached
// to) — there's no mechanism anywhere in this model for an Equipment to
// grant a dynamic, life-total-driven P/T override to whatever it's
// attached to. Kept as real text only, same treatment every other
// Equipment's own static P/T bonus gets (dark-knight-s-greatsword/
// samurai-s-katana/thief-s-knife/buster-sword/excalibur-ii, e.g.) — this
// one's just dynamic instead of a fixed delta, which changes nothing about
// where it has to live.
export const aettirAndPriwen: CardDefinition = {
  name: 'Aettir and Priwen',
  manaCost: '{6}',
  typeLine: 'Legendary Artifact — Equipment',

  staticAbilities: ['Equipped creature has base power and toughness X/X, where X is your life total.'],

  // Equip {5} — the standard Equip ability, same attach-to-a-chosen-
  // creature shape as dragoon-s-lance/thief-s-knife/machinist-s-arsenal.
  activationCost: '{5}',
  effects: [
    {
      kind: 'custom',
      describe: 'attach to target creature you control',
      run: (ctx: EffectContext, actions: Actions) => {
        const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        if (target) actions.equip(ctx.self, target);
      },
    } satisfies Effect,
  ],
};
