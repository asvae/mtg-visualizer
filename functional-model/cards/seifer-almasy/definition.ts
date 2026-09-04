import type { CardDefinition, Effect } from '../../card';

export const seiferAlmasy: CardDefinition = {
  name: 'Seifer Almasy',
  manaCost: '{3}{R}',
  typeLine: 'Legendary Creature — Human Knight',

  pt: [3, 4],

  triggers: [
    {
      // "Whenever a creature you control attacks alone, it gains double
      // strike until end of turn" — "Alone$ True" (which specific creature
      // attacked, and that it was the only attacker) isn't tracked anywhere
      // in this model (no combat/attack step exists at all — state.ts's own
      // header). Approximated as the first creature you control, same
      // always-first-candidate `chooseTarget` bias every other targeted
      // effect here already accepts.
      name: 'onAttacksAlone',
      effects: [{ kind: 'grantKeywordTarget', keyword: 'DoubleStrike', owner: 'you' } satisfies Effect],
    },
    {
      // Fire Cross — "you may cast target instant or sorcery card with mana
      // value 3 or less from your graveyard without paying its mana cost.
      // If that spell would be put into your graveyard, exile it instead."
      // Genuinely NOT modelable: no Actions member anywhere (this model's
      // `Actions` interface, card.ts) can resolve/"cast" an arbitrary
      // chosen CardDefinition — `interfaces.ts`'s own `play()` helper isn't
      // threaded through `Actions` at all, and nothing else stands in for
      // "run another card's own effects." Real text kept as documentation
      // only, same "described but not executed" treatment summon-
      // leviathan's own chapterII/III granted-delayed-trigger no-op gets.
      name: 'onDealsCombatDamageToPlayer',
      effects: [
        {
          kind: 'custom',
          describe:
            "you may cast target instant or sorcery card with mana value 3 or less from your graveyard without paying its mana cost, exiling it instead of it going to the graveyard (not mechanically enforced — no action anywhere in this model can resolve an arbitrary chosen card)",
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
