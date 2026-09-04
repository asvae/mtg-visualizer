import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const vaanStreetThief: CardDefinition = {
  name: 'Vaan, Street Thief',
  manaCost: '{2}{R}',
  typeLine: 'Legendary Creature — Human Scout',

  pt: [2, 2],

  triggers: [
    {
      // Real `DB$ Dig ... DestinationZone$ Exile` (exile the top card of
      // the damaged player's library) then `DB$ Play | Optional$ True`
      // (you may cast it), else (`ConditionCompare$ GT0` on the
      // still-Remembered card) a Treasure token. No action anywhere in
      // this engine can cast an arbitrary discovered card (only `self` has
      // any cast-from-alternate-zone machinery, via `alternateCosts`), so
      // the "may cast it" branch is unreachable — the only actually
      // executable outcome is the "if you don't" branch, modeled directly
      // (real `move` to Exile + real `createToken` for the Treasure).
      name: 'onScoutsDealCombatDamage',
      effects: [
        {
          kind: 'custom',
          describe:
            "exile the top card of that player's library; you may cast it, if you don't, create a Treasure token (casting a non-self discovered card has no mechanism in this engine — approximated as always creating the Treasure token)",
          run: (ctx: EffectContext, actions: Actions) => {
            const opponent = ctx.opponents[0];
            if (!opponent) return;
            actions.move(opponent, 'Library', 'Exile', 1, 'any');
            actions.createToken(ctx.you, TOKENS.c_a_treasure_sac, 1);
          },
        } satisfies Effect,
      ],
    },
    {
      // Real `DB$ PutCounterAll | ValidCards$ Scout.YouCtrl,Pirate.YouCtrl,
      // Rogue.YouCtrl` — an OR across three subtypes; `putCounterAll`'s own
      // `subtype` field only ever filters by ONE subtype string, so no
      // combination of its fields expresses this disjunction — `custom`,
      // filtering the real battlefield pool via `hasSubtype` (already
      // exposed on every wrapped Card) then calling the real `putCounter`
      // action per match, same subtype-filtering shape summon-leviathan's
      // own chapter I uses.
      name: 'onCastSpellYouDontOwn',
      effects: [
        {
          kind: 'custom',
          describe: 'put a +1/+1 counter on each Scout, Pirate, and Rogue you control',
          run: (ctx: EffectContext, actions: Actions) => {
            for (const creature of ctx.you.getCreaturesInPlay()) {
              if (creature.hasSubtype('Scout') || creature.hasSubtype('Pirate') || creature.hasSubtype('Rogue')) actions.putCounter(creature, '+1/+1', 1);
            }
          },
        } satisfies Effect,
      ],
    },
  ],
};
