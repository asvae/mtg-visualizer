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
// recognizer-exception: jobSelectCreateTokenAndEquip-effect-structural —
// this card's own real printed oracle text (confirmed via
// data/fin/fin_scryfall.json) prints the bare "Job select" keyword line with
// NO parenthetical reminder text at all (every sibling Job-select Equipment
// in this pool DOES print "(When this Equipment enters, create a 1/1
// colorless Hero creature token, then attach this to it.)"). The closure
// below is still 100% correct (K:Job select is a hardcoded engine keyword —
// see this file's own comment right below), so the recognizer's own runtime
// probe correctly classifies it; it's the required LITERAL clause that
// genuinely can't be found on this specific printing, a real card-text
// variance, not a recognizer bug.
// recognizer-exception: entersBattlefield-self-trigger-structural — same
// real divergence as above: this printing's bare "Job select" keyword line
// carries no parenthetical "(When this Equipment enters...)" reminder text
// at all, so no "When/Whenever <self> enters" clause exists for this
// recognizer to verify against, even though `on:'enter'` is genuinely
// correct (K:Job select is a real, hardcoded engine-wide ETB trigger).
export const summonersGrimoire: CardDefinition = {
  name: "Summoner's Grimoire",
  manaCost: '{3}{G}',
  typeLine: 'Artifact — Book Equipment',

  // The "is a Shaman" type grant is now real, executable
  // `continuousTypeGrants` (same generalization dragoon-s-lance's/
  // black-mage-s-rod's own migrations established). The granted "Whenever
  // this creature attacks, you may put a creature card from your hand onto
  // the battlefield..." triggered ability is the same genuinely open gap
  // class black-mage-s-rod's own comment documents — no vocabulary anywhere
  // in this model grants a WHOLE NEW triggered ability (its own condition
  // PLUS its own effect) to another permanent; `continuousKeywordGrants`/
  // `continuousPTGrants`/`continuousTypeGrants` only ever broadcast a
  // keyword/P&T delta/subtype — stays real-but-inert text.
  staticAbilities: [
    'Equipped creature is a Shaman in addition to its other types and has "Whenever this creature attacks, you may put a creature card from your hand onto the battlefield. If that card is an enchantment card, it enters tapped and attacking."',
  ],

  continuousTypeGrants: [{ types: ['Shaman'], includeSelf: false, equippedBySelf: true }],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
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
