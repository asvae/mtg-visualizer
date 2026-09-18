import type { CardDefinition, Effect } from '../../card';
import { applyToBound, putCounter, selectUpTo, you } from '../../combinator';

// Real Scryfall data (FDN #12, confirmed against `data/cards.db`):
//   "Lifelink (Damage dealt by this creature also causes you to gain that
//   much life.)\nWhen this creature enters, put a +1/+1 counter on each of
//   up to two other target creatures you control."
//   {3}{W}, Creature — Cat Beast, 2/3.
//
// Lifelink is a real, printed `Keyword` (`card.ts`'s own closed `Keyword`
// union already has `'Lifelink'`) — mechanically enforced by `state.ts`'s
// own `dealDamage` (real 702.15e chokepoint, not something this card's own
// `definition.ts` needs to spell out as an `Effect`). This is the second
// real FDN card with printed Lifelink (`healer-s-hawk` is the first) — the
// real motivating card for `sink-model/predicates/lifelink.ts`, which reads
// this exact `keywords` field to derive the implicit `gainLife` production
// `deriveOccurrences` otherwise has no way to see (Lifelink's lifegain has
// no corresponding `gainLife` `Effect` node on any card, since it's purely
// automatic engine consequence of dealing damage).
//
// The ETB ability ("put a +1/+1 counter on each of up to two OTHER target
// creatures you control") mirrors `cards/venat-heart-of-hydaelyn-hydaelyn-
// the-mothercrystal/definition.ts`'s own real "Blessing of Light" shape
// (`selectUpTo(you.creaturesInPlay().filter('excludeSelf'), N, 'target',
// [applyToBound('target', index, putCounter(...))])`) — that card picks
// max 1 and applies to index 0 only ("another target creature," singular);
// this card widens the SAME real vocabulary to max 2, applying the
// identical `putCounter` action to BOTH index 0 AND index 1 of the same
// binding (each `applyToBound` call is independently a no-op — see that
// node's own `combinator.ts` doc comment — when fewer than `index + 1`
// creatures were actually picked, which is exactly the real "UP TO two"
// looseness this ability needs: 0, 1, or 2 targets are all legal). No new
// combinator vocabulary needed.
export const felidarSavior: CardDefinition = {
  name: 'Felidar Savior',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Cat Beast',
  pt: [2, 3],
  keywords: ['Lifelink'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'program',
          describe: 'put a +1/+1 counter on each of up to two other target creatures you control',
          program: selectUpTo(you.creaturesInPlay().filter('excludeSelf'), 2, 'target', [
            applyToBound('target', 0, putCounter('+1/+1', 1)),
            applyToBound('target', 1, putCounter('+1/+1', 1)),
          ]),
        } satisfies Effect,
      ],
    },
  ],

  // Coverage-justification manifest (2026-09-18, FDN schema-tightness
  // redesign proof-of-concept — see `.claude/contracts/card-schema.md`).
  // Real printed oracle text, 2 clauses: "Lifelink (Damage dealt by this
  // creature also causes you to gain that much life.)\nWhen this creature
  // enters, put a +1/+1 counter on each of up to two other target
  // creatures you control." Zero `missingSchemaFunctionality` entries —
  // both clauses are fully, structurally covered.
  coverageJustification: [
    {
      clause: 'Lifelink (Damage dealt by this creature also causes you to gain that much life.)',
      coveredBy: { kind: 'keyword', keyword: 'Lifelink' },
      reasoning: "Printed keyword, present in this card's own `keywords` array — mechanically ENFORCED (not just tracked) by `state.ts`'s own real `dealDamage` chokepoint, per that field's own doc comment; the reminder text in parentheses is exactly what that chokepoint does.",
    },
    {
      clause: 'When this creature enters, put a +1/+1 counter on each of up to two other target creatures you control.',
      coveredBy: { kind: 'trigger', name: 'onEnter' },
      reasoning: "The `onEnter` trigger (`on:'enter'`, this engine's real self-only ETB auto-fire scope) runs a `program` effect built from `selectUpTo(you.creaturesInPlay().filter('excludeSelf'), 2, 'target', ...)` — the real \"up to two OTHER target creatures you control\" selection (0, 1, or 2 legal picks), each bound index independently applying `putCounter('+1/+1', 1)` via `applyToBound` (a no-op when fewer than `index + 1` targets were actually picked, exactly the real 'UP TO' looseness this clause needs).",
    },
  ],
};
