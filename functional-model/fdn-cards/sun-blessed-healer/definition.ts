import type { CardDefinition, Effect } from '../../card';

export const sunBlessedHealer: CardDefinition = {
  name: 'Sun-Blessed Healer',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Human Cleric',
  pt: [3, 1],

  keywords: ['Lifelink'],

  // Real Kicker {1}{W}. "Kicker" is not in this model's controlled
  // `Keyword` vocabulary (no such literal in card.ts's own `Keyword`
  // union) — kept as real printed text, same fallback CardDefinition's
  // own `staticAbilities` doc comment describes. `AlternateCost` doesn't
  // fit either (that shape is fixed to `from: 'graveyard'|'exile'` —
  // real Flashback/Jump-start territory; Kicker is an ADDITIONAL,
  // optional cost paid from hand, not a cost REPLACEMENT).
  staticAbilities: ['Kicker {1}{W} (You may pay an additional {1}{W} as you cast this spell.)'],

  // "When this creature enters, if it was kicked, return target nonland
  // permanent card with mana value 2 or less from your graveyard to the
  // battlefield." No field conditions a trigger's firing on whether an
  // alternate/additional cost was paid — modeled via the same
  // `modal`/`ctx.mode` convention chocobo-kick/vayne-s-treachery/
  // divine-resilience already use for Kicker (mode 0 = not kicked,
  // nothing happens; mode 1 = kicked, do the real return).
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'modal',
          modes: [
            { describe: 'Not kicked — nothing happens.', effects: [] },
            {
              describe:
                'If this creature was kicked, return target nonland permanent card with mana value 2 or less from your graveyard to the battlefield.',
              effects: [
                {
                  kind: 'move',
                  owner: 'you',
                  from: 'Graveyard',
                  to: 'Battlefield',
                  validType: 'any',
                  nonLand: true,
                  maxCmc: 2,
                  qty: 1,
                  target: true,
                } satisfies Effect,
              ],
            },
          ],
        } satisfies Effect,
      ],
    },
  ],
};
