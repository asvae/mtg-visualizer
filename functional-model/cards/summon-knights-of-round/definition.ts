import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

// Real 714.3a/b Saga chapters modeled as named `triggers`, same
// simplification jecht-reluctant-guardian-braska-s-final-aeon/summon-bahamut/
// summon-choco-mog already document. Chapters I-IV point at the SAME real
// Forge SVar (K:Chapter:5:TrigToken,TrigToken,TrigToken,TrigToken,TrigPumpAll)
// — the token ability repeats four times, not a typo, same shape summon-
// bahamut's own repeated-chapter SVars already establish.
export const summonKnightsOfRound: CardDefinition = {
  name: 'Summon: Knights of Round',
  manaCost: '{6}{W}{W}',
  typeLine: 'Enchantment Creature — Saga Knight',

  keywords: ['Indestructible'],

  triggers: [
    { name: 'chapterI', effects: [{ kind: 'createToken', token: TOKENS.w_2_2_knight, amount: 3 } satisfies Effect] },
    { name: 'chapterII', effects: [{ kind: 'createToken', token: TOKENS.w_2_2_knight, amount: 3 } satisfies Effect] },
    { name: 'chapterIII', effects: [{ kind: 'createToken', token: TOKENS.w_2_2_knight, amount: 3 } satisfies Effect] },
    { name: 'chapterIV', effects: [{ kind: 'createToken', token: TOKENS.w_2_2_knight, amount: 3 } satisfies Effect] },
    {
      // Ultimate End — "other creatures you control get +2/+2 until end of
      // turn. Put an indestructible counter on each of them." Two separate
      // declarative passes over the same "other creatures you control" set
      // — order between them doesn't matter, each is an independent field
      // mutation on the same cards.
      name: 'chapterV',
      effects: [
        { kind: 'pumpAll', predicate: 'creatures-you-control', power: 2, toughness: 2, notSelf: true } satisfies Effect,
        { kind: 'putCounterAll', predicate: 'creatures-you-control', counterType: 'Indestructible', amount: 1, notSelf: true } satisfies Effect,
      ],
    },
  ],
};
