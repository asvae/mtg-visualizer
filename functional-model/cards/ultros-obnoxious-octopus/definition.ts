import type { CardDefinition, Effect } from '../../card';

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
      // (Minwu's own `onLifeGained`, e.g.). Sahagin (fin/71, same batch,
      // its own identical real `ValidSA$ Spell.ManaSpent GE4` condition)
      // reaches the same conclusion in its own definition.ts comment —
      // checked before writing this card's own fact model, to stay
      // consistent rather than re-litigate: no real mana-spent tracking
      // exists anywhere in this engine.
      name: 'onNoncreatureSpellCastGE4Mana',
      effects: [
        // "tap target creature an OPPONENT controls and put a stun counter
        // on IT" — the same chosen object twice. Real Ice Flan/Summon Shiva
        // precedent (see either's own definition.ts comment): nothing ties
        // two separate declarative effects to the SAME chosen target, but
        // both pools here are identical (`owner:'opponents'`, nothing moves
        // zones in between), so `chooseTarget`'s own deterministic
        // first-pool-candidate rule lands on the same creature both times —
        // no `custom` workaround needed now that `tapTarget`/
        // `putCounterTarget`'s own `owner` field exists (this card's own
        // former `custom` implementation predated it and is now obsolete,
        // per Ice Flan's own comment calling this exact card out by name).
        { kind: 'tapTarget', validType: 'creature', owner: 'opponents' } satisfies Effect,
        { kind: 'putCounterTarget', validType: 'creature', counterType: 'stun', amount: 1, owner: 'opponents' } satisfies Effect,
      ],
    },
    {
      name: 'onNoncreatureSpellCastGE8Mana',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 8 } satisfies Effect],
    },
  ],
};
