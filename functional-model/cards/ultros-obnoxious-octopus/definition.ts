import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const ultrosObnoxiousOctopus: CardDefinition = {
  name: 'Ultros, Obnoxious Octopus',
  manaCost: '{1}{U}',
  typeLine: 'Legendary Creature — Octopus',

  pt: [2, 1],

  triggers: [
    {
      // Real T:Mode$ SpellCast | ValidSAonCard$ Spell.ManaSpent GE4 —
      // "if at least four mana was spent to cast it" is a real cast-time
      // condition this model has no mana-spent tracking for at all (no
      // Effect/EffectContext field carries how much mana a cast spent
      // anywhere in this batch's read of card.ts/harness.ts); a scenario
      // firing this named trigger already stands in for "the condition was
      // met," same as every other conditional trigger name in this repo
      // (Minwu's own `onLifeGained`, e.g.).
      name: 'onNoncreatureSpellCastGE4Mana',
      effects: [
        {
          // "tap target creature an OPPONENT controls and put a stun
          // counter on IT" — the same chosen object twice. Neither
          // `tapTarget` nor `putCounterTarget` restricts its pool to one
          // player's creatures (both draw from the union of every
          // creature on the battlefield), and nothing ties two separate
          // declarative effects to the SAME chosen target — `custom`,
          // picking one real target from the real opponent-only pool and
          // applying both actions to it, is the honest shape.
          kind: 'custom',
          describe: 'tap target creature an opponent controls and put a stun counter on it',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = ctx.opponents.flatMap((p) => p.getCreaturesInPlay());
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            actions.tap(target);
            actions.putCounter(target, 'Stun', 1);
          },
        } satisfies Effect,
      ],
    },
    {
      name: 'onNoncreatureSpellCastGE8Mana',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 8 } satisfies Effect],
    },
  ],
};
