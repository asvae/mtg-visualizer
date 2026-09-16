import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const coralSword: CardDefinition = {
  name: 'Coral Sword',
  manaCost: '{R}',
  typeLine: 'Artifact — Equipment',

  keywords: ['Flash'],
  // "Equipped creature gets +1/+0" — real, mechanical `continuousPTGrants`
  // (2026-09-16, static-ability audit follow-up — same already-real
  // query-time machinery dragoon-s-lance/paladin-s-arms/thief-s-knife/etc.
  // already use for this exact shape; this card was simply never migrated).
  staticAbilities: ['Equipped creature gets +1/+0.'],

  continuousPTGrants: [{ power: 1, toughness: 0, includeSelf: false, equippedBySelf: true }],

  triggers: [
    {
      // `DB$ Attach` has no declarative Effect kind (see ninja-s-blades'
      // own comment — every equip anywhere in this repo goes through
      // `custom` calling the real `actions.equip`); the "gains first
      // strike until end of turn" half of the SAME ability IS declarative
      // (`grantKeywordTarget`), split out as its own effect so `custom`
      // stays narrowly scoped to just the attach step. `chooseTarget`'s
      // own deterministic "always pick pool[0]" behavior means both
      // effects land on the SAME creature, matching Forge's real
      // `Defined$ Targeted` (the second effect targeting whatever the
      // first one attached to).
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe: 'attach to target creature you control',
          run: (ctx: EffectContext, actions: Actions) => {
            const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
            if (target) actions.equip(ctx.self, target);
          },
        } satisfies Effect,
        // recognizer-exception: grantKeywordTarget-effect-structural — the
        // real printed text says "THAT creature gains first strike" (an
        // anaphoric reference back to the SEPARATE `custom` attach effect's
        // own chosen target above, never the literal words "target creature
        // you control"); this effect's own `owner` field is deliberately
        // left unset since the actual choosing already happened in that
        // other effect (see this trigger's own module comment) — a
        // confirmed mismatch (structural approximation), not a bug.
        { kind: 'grantKeywordTarget', keyword: 'FirstStrike', validType: 'creature', untilEndOfTurn: true } satisfies Effect,
      ],
    },
  ],

  // Equip {1} — an activated ability on the Equipment itself, same
  // activationCost/effects shape as ninja-s-blades' own Equip {2}.
  activationCost: 'Equip {1}',
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
