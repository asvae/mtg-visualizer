import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const whiteMagesStaff: CardDefinition = {
  name: "White Mage's Staff",
  manaCost: '{1}{W}',
  typeLine: 'Artifact — Equipment',

  // The +1/+1 P/T bonus and "is a Cleric" type grant are now real,
  // executable machinery (ENGINE_GAPS.md gap #14, fully closed 2026-09-12).
  // The granted "Whenever this creature attacks, you gain 1 life" triggered
  // ability is now ALSO real, executable machinery (closed 2026-09-16, real
  // Forge citation `res/cardsfolder/w/white_mages_staff.txt`: `S:...
  // AddTrigger$ TrigAttack | ... | SVar:TrigAttack:Mode$ Attacks |
  // ValidCard$ Card.Self | Execute$ TrigGainLife | ...` — a real Forge
  // "grant a whole triggered ability to another permanent" static, modeled
  // here via the new `Trigger.on: 'equippedAttacks'` value instead of
  // literally copying the trigger onto the equipped creature — see that
  // `on` value's own doc comment in card.ts for the full writeup, including
  // why this single mechanism also correctly covers Genji Glove's/Ultima
  // Weapon's own real, differently-shaped-in-Forge `Card.EquippedBy`
  // scripts). `gainLife`'s own real `ctx.you` target needs no "equipped
  // creature" resolution at all (unlike a card whose granted effect targets
  // "this creature" specifically, e.g. astrologian-s-planisphere's own
  // still-open counter grant), so this card closes fully with zero new
  // Effect vocabulary.
  staticAbilities: ['Equipped creature gets +1/+1, has "Whenever this creature attacks, you gain 1 life," and is a Cleric in addition to its other types.'],

  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, equippedBySelf: true }],
  continuousTypeGrants: [{ types: ['Cleric'], includeSelf: false, equippedBySelf: true }],

  // Job select — same real ETB mechanic (create a Hero token, then attach
  // this to it) as dragoon-s-lance/paladin-s-arms/machinist-s-arsenal's own
  // onEnter trigger; independent of the Equip ability below.
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
    // The granted "Whenever this creature attacks, you gain 1 life" — real,
    // executable via the new `on: 'equippedAttacks'` auto-fire (see
    // card.ts's own `Trigger.on` doc comment). `engine.ts`'s widened
    // `fireOnAttackTriggers` fires this for real the moment the EQUIPPED
    // creature (not White Mage's Staff itself) is declared as an attacker —
    // no manual `pilotFireTrigger` needed, same real auto-dispatch
    // `on: 'attacks'` already gives a card's own self-attack trigger.
    {
      name: 'onEquippedAttacksGainLife',
      on: 'equippedAttacks',
      effects: [{ kind: 'gainLife', amount: 1 } satisfies Effect],
    },
  ],

  // Equip {3} — same attach-to-a-chosen-creature shape dragoon-s-lance/
  // paladin-s-arms/machinist-s-arsenal/ninja-s-blades all use for their own
  // Equip ability (no declarative `equip` Effect kind exists — `custom`
  // calling the real `actions.equip` is the established shape).
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
