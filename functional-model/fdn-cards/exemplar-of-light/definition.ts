import type { CardDefinition, Effect, Trigger } from '../../card';

export const exemplarOfLight: CardDefinition = {
  name: 'Exemplar of Light',
  manaCost: '{2}{W}{W}',
  typeLine: 'Creature — Angel',
  pt: [3, 3],
  keywords: ['Flying'],

  // Both triggers below use the new, preferred `cause`/`effects`-nested
  // `Trigger` shape (2026-09-19, even later still) — mirrors real Forge's
  // own structure directly: a `T:` line's condition params and its
  // `Execute$`-pointed effect are two separate real objects, not one flat
  // blob. This card is the one real, in-active-scope place this shape is
  // used today (`.claude/contracts/card-schema.md`'s own dated section).
  // Param-by-param audit of both real `T:` lines against what's modeled
  // here (including the two params NOT given fields — `ValidPlayer$ You`,
  // `TriggerZones$ Battlefield` — and why each is genuinely represented
  // anyway) lives in this card's own NOTES.md.
  triggers: [
    {
      name: 'onLifeGain',
      cause: { on: 'lifeGained' },
      effects: [
        {
          kind: 'putCounter',
          target: 'self',
          counterType: '+1/+1',
          amount: 1,
        } satisfies Effect,
      ],
    } satisfies Trigger,
    {
      name: 'onCounterAdded',
      cause: {
        on: 'counterAdded',
        counterAddedMatch: { counterType: '+1/+1', source: 'you' },
        activationLimit: 1,
      },
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
      ],
    } satisfies Trigger,
  ],
};
