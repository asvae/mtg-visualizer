import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

// Real script (summoners_grimoire.txt): `K:Job select` — confirmed against
// forge-game's own CardFactoryUtil.java (`keyword.equals("Job select")`):
// a HARDCODED engine keyword, not per-card data — "When this Equipment
// enters, create a 1/1 colorless Hero creature token, then attach this to
// it" applies to ANY card carrying `K:Job select` (this script itself has
// no explicit SVar for it, same as astrologian-s-planisphere/black-mage-s-rod's
// own scripts — confirming it's engine-wide, not authored per card). Not
// added to `keywords` (the enum has no "Job select" entry, and neither of
// those two sibling cards lists it there either) — the `onEnter` trigger
// below IS the real behavior.
export const summonersGrimoire: CardDefinition = {
  name: "Summoner's Grimoire",
  manaCost: '{3}{G}',
  typeLine: 'Artifact — Book Equipment',

  // "Equipped creature is a Shaman in addition to its other types and has
  // 'Whenever this creature attacks, you may put a creature card from your
  // hand onto the battlefield. If that card is an enchantment card, it
  // enters tapped and attacking.'" — a static grant of a TRIGGERED ability
  // to whichever creature is equipped, not to this permanent itself; no
  // `AddTrigger$`-equivalent field exists (same `staticAbilities`-text-only
  // treatment black-mage-s-rod's own granted-trigger comment documents).
  staticAbilities: [
    'Equipped creature is a Shaman in addition to its other types and has "Whenever this creature attacks, you may put a creature card from your hand onto the battlefield. If that card is an enchantment card, it enters tapped and attacking."',
  ],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'custom',
          describe: 'create a 1/1 colorless Hero creature token, then attach this to it',
          run: (ctx: EffectContext, actions: Actions) => {
            const [created] = actions.createToken(ctx.you, TOKENS.c_1_1_hero, 1);
            if (created) actions.equip(ctx.self, created);
          },
        } satisfies Effect,
      ],
    },
  ],

  // "Abraxas — Equip {3}" — a flavor name on the standard Equip ability,
  // same attach-to-a-chosen-creature shape astrologian-s-planisphere/
  // black-mage-s-rod already use.
  activationCost: '{3}',
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
