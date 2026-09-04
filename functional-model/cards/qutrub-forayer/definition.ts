import type { CardDefinition, Effect } from '../../card';

export const qutrubForayer: CardDefinition = {
  name: 'Qutrub Forayer',
  manaCost: '{2}{B}',
  typeLine: 'Creature — Zombie Horror',

  pt: [3, 2],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'modal',
          modes: [
            {
              // Real `ValidTgts$ Creature.wasDealtDamageThisTurn` — this
              // model tracks no per-creature damage-this-turn state at all
              // (state.ts's own header: damage to a creature "has no
              // observable persistent effect in this model," a deliberate
              // no-state-based-actions simplification), so the restriction
              // itself can't be checked; approximated as `'creature'`
              // (broader than real — any creature, not just a damaged one),
              // same category of approximation `minPower`/etc. already
              // accept elsewhere.
              describe: 'Destroy target creature that was dealt damage this turn.',
              effects: [{ kind: 'destroy', validType: 'creature', qty: 1 } satisfies Effect],
            },
            {
              // Real `TargetMax$2 | TargetsWithSameController$ True` — "up
              // to two target cards from a SINGLE graveyard" (either
              // player's). `move`'s own `owner` loops per-player
              // independently (an `'each'` here would wrongly allow up to
              // 2 from EACH graveyard at once, not up to 2 total from ONE);
              // narrowed to `'you'` as the closest single-graveyard,
              // single-owner-loop fit — real gap (no way to express "one
              // shared pool across a modal owner choice") flagged in this
              // batch's own final report.
              describe: 'Exile up to two target cards from a single graveyard.',
              effects: [{ kind: 'move', owner: 'you', from: 'Graveyard', to: 'Exile', qty: 2, validType: 'any', target: true } satisfies Effect],
            },
          ],
        } satisfies Effect,
      ],
    },
  ],
};
