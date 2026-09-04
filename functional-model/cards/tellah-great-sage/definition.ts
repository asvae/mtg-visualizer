import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const tellahGreatSage: CardDefinition = {
  name: 'Tellah, Great Sage',
  manaCost: '{3}{U}{R}',
  typeLine: 'Legendary Creature — Human Wizard',

  pt: [3, 3],

  triggers: [
    {
      // "Whenever you cast a noncreature spell, create a 1/1 colorless Hero
      // creature token. If four or more mana was spent to cast that spell,
      // draw two cards. If eight or more mana was spent to cast that
      // spell, sacrifice NICKNAME and it deals that much damage to each
      // opponent." Same real `TriggeredCard$CastTotalManaSpent` fixed value
      // shantotto-tactician-magician's own identical trigger shape uses.
      // The final clause needs SELF specifically sacrificed (not "a
      // creature you control" — `sacrifice`'s own pool-pick can't guarantee
      // self), so that whole conditional clause is `custom`, moving `self`
      // directly to the graveyard (the real zone-change consequence of a
      // sacrifice) and dealing the damage.
      name: 'onCastNoncreatureSpell',
      effects: [
        { kind: 'createToken', token: TOKENS.c_1_1_hero, amount: 1 } satisfies Effect,
        { kind: 'drawCard', amount: (ctx) => (((ctx.triggerInput?.manaSpent as number) ?? 0) >= 4 ? 2 : 0) } satisfies Effect,
        {
          kind: 'custom',
          describe: 'if eight or more mana was spent to cast that spell, sacrifice Tellah and it deals that much damage to each opponent',
          run: (ctx, actions) => {
            const x = (ctx.triggerInput?.manaSpent as number) ?? 0;
            if (x < 8) return;
            actions.moveTo(ctx.self, 'Graveyard');
            for (const opponent of ctx.opponents) actions.dealDamage(ctx.self, opponent, x);
          },
        } satisfies Effect,
      ],
    },
  ],
};
