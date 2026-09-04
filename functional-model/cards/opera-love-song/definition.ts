import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import type { Card } from '../../interfaces';

export const operaLoveSong: CardDefinition = {
  name: 'Opera Love Song',
  manaCost: '{1}{R}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Exile the top two cards of your library. You may play those cards until your next end step.',
          effects: [
            // The zone change itself (library -> exile, an unchosen batch)
            // is real and modeled; "you may play those cards" is a granted
            // permission with no further resolvable consequence anything
            // downstream reads (no "play a card from exile" Effect kind
            // anywhere), same "described but not separately enforced"
            // treatment `move`/`dig`'s own `optional` fields already carry
            // for a different nuance.
            { kind: 'move', owner: 'you', from: 'Library', to: 'Exile', qty: 2, validType: 'any' } satisfies Effect,
          ],
        },
        {
          describe: 'One or two target creatures each get +2/+0 until end of turn.',
          effects: [
            {
              // "One or two target creatures" — `pumpTarget` only ever
              // targets ONE creature (no `qty`, unlike `move`/
              // `putCounterTarget`/`destroy`'s own up-to-N targeted
              // pattern). `custom`, reusing that exact up-to-N loop shape
              // by hand, is the honest fit — built entirely from the real
              // `chooseTarget`/`pump` actions, not a fabricated primitive.
              kind: 'custom',
              describe: 'up to two target creatures each get +2/+0 until end of turn',
              run: (ctx: EffectContext, actions: Actions) => {
                const pool = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())];
                const chosen: Card[] = [];
                for (let i = 0; i < 2; i++) {
                  const remaining = pool.filter((c) => !chosen.includes(c));
                  if (remaining.length === 0) break;
                  chosen.push(actions.chooseTarget(remaining));
                }
                for (const target of chosen) actions.pump(target, 2, 0);
              },
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
