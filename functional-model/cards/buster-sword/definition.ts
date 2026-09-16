import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (buster_sword.txt): "Equipped creature gets +3/+2" — real,
// mechanical `continuousPTGrants` (2026-09-16, static-ability audit
// follow-up: this and a dozen sibling Equipment cards were left on inert
// `staticAbilities`-only text despite the SAME real, already-built,
// query-time `continuousPTGrants`/`continuousTypeGrants`/
// `continuousKeywordGrants` machinery dragoon-s-lance/paladin-s-arms/
// thief-s-knife/white-mage-s-staff/sage-s-nouliths/black-mage-s-rod/
// crystal-fragments-summon-alexander already use for this EXACT same
// shape — this card's own comment used to say "same staticAbilities-
// text-only treatment" as those cards, unaware several of them had
// already been migrated; fixed for real now).
//
// The granted "whenever equipped creature deals combat damage to a
// player, draw a card, then you may cast a spell from your hand with mana
// value <= that damage without paying its mana cost" is modeled as if it
// were Buster Sword's OWN trigger — same `onEquippedDealsDamage`
// simplification thief-s-knife/ninja-s-blades already establish (the real
// source is whichever creature is equipped, not this permanent). The draw
// is real and modeled; the free-cast clause is NOT — no Effect kind (and
// no `play` member on `Actions`) exists anywhere to "cast a card without
// paying its cost" (interfaces.ts's own `play` is a declared, unwired
// convenience wrapper — never part of `Actions`, never implemented in
// state.ts/harness.ts), so that half stays real text only via a no-op
// `custom` effect, same honest treatment crystal-fragments-summon-
// alexander's own "prevent all damage" chapter gets for its own
// unmodelable clause.
export const busterSword: CardDefinition = {
  name: 'Buster Sword',
  manaCost: '{3}',
  typeLine: 'Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +3/+2.'],

  continuousPTGrants: [{ power: 3, toughness: 2, includeSelf: false, equippedBySelf: true }],

  triggers: [
    {
      name: 'onEquippedDealsDamage',
      effects: [
        { kind: 'drawCard' } satisfies Effect,
        {
          kind: 'custom',
          describe:
            'you may then cast a spell from your hand with mana value less than or equal to that damage without paying its mana cost — no "cast without paying its cost" action exists anywhere in this model (interfaces.ts\'s own `play` convenience wrapper is declared but never wired into `Actions`), kept as text only',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],

  // Equip {2} — the standard Equip ability, same attach-to-a-chosen-
  // creature shape every other Equipment in this batch uses.
  activationCost: '{2}',
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
