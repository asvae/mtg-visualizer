import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import type { Card } from '../../interfaces';
import { TOKENS } from '../../tokens.ts';

export const aerithRescueMission: CardDefinition = {
  name: 'Aerith Rescue Mission',
  manaCost: '{3}{W}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Take the Elevator — create three 1/1 colorless Hero creature tokens',
          effects: [{ kind: 'createToken', token: TOKENS.c_1_1_hero, amount: 3 } satisfies Effect],
        },
        {
          describe: 'Take 59 Flights of Stairs — tap up to three target creatures, put a stun counter on one of them',
          effects: [
            {
              // Tap-N-then-counter-ONE-of-those-N needs the same chosen
              // targets bound across two steps — no declarative shape here
              // supports referencing "one of the targets from the PREVIOUS
              // effect," so this stays one combined custom rather than a
              // `tapTarget` followed by a `putCounterTarget` that can't
              // actually see which cards the first one picked.
              kind: 'custom',
              describe: 'tap up to three target creatures, then put a stun counter on one of them',
              run: (ctx: EffectContext, actions: Actions) => {
                const pool = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())];
                const tapped: Card[] = [];
                for (let i = 0; i < 3; i++) {
                  const remaining = pool.filter((c) => !tapped.includes(c));
                  if (remaining.length === 0) break;
                  const target = actions.chooseTarget(remaining);
                  tapped.push(target);
                  actions.tap(target);
                }
                if (tapped.length > 0) actions.putCounter(tapped[0]!, 'stun', 1);
              },
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
