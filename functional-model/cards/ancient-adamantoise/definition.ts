import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const ancientAdamantoise: CardDefinition = {
  name: 'Ancient Adamantoise',
  manaCost: '{5}{G}{G}{G}',
  typeLine: 'Creature — Turtle',

  pt: [8, 20],
  keywords: ['Vigilance', 'Ward'],

  // Real `S:Mode$ NoCleanupDamage` (no cleanup step exists in this engine
  // — inert, recognized-but-inert same as Vigilance/Ward here) and the
  // real `R:Event$ DamageDone ... ReplaceWith$ DmgMe` damage-redirection
  // replacement effect (no replacement-effect mechanism anywhere in this
  // engine, same "conditional/continuous rule with no matching shape"
  // reasoning card.ts's own `ptFormula` doc comment gives for staying
  // freeform text) both stay static text rather than a fabricated
  // mechanism.
  staticAbilities: [
    "Damage isn't removed from this creature during cleanup steps.",
    'All damage that would be dealt to you and other permanents you control is dealt to this creature instead.',
  ],

  triggers: [
    {
      name: 'onDies',
      effects: [
        {
          // Real `Defined$ TriggeredNewCardLKICopy | Origin$ Graveyard |
          // Destination$ Exile` — no declarative "move self specifically"
          // shape exists on `move` (its own targeted branch always picks
          // from a filtered POOL, with `notSelf` only ever EXCLUDING self,
          // never selecting only it), so `custom` calling the real
          // `moveTo` on `ctx.self` directly, same approximation
          // jecht-reluctant-guardian's own "exile this" custom uses.
          kind: 'custom',
          describe: 'exile this creature',
          run: (ctx: EffectContext, actions: Actions) => {
            actions.moveTo(ctx.self, 'Exile');
          },
        } satisfies Effect,
        { kind: 'createToken', token: TOKENS.c_a_treasure_sac, amount: 10, tapped: true } satisfies Effect,
      ],
    },
  ],
};
