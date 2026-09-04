import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const sazhKatzroy: CardDefinition = {
  name: 'Sazh Katzroy',
  manaCost: '{3}{G}',
  typeLine: 'Legendary Creature — Human Pilot',

  pt: [3, 3],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        // "search your library for a Bird or basic land card, reveal it,
        // put it into your hand" — `move`'s own declarative `validType`
        // has no Bird-OR-basic-land disjunctive filter (only
        // creature/artifact/land/any), so `'any'` is the closest fit, same
        // approximation Rydia's Return's own "permanent card" mode
        // already uses. `OptionalDecider$ You` -> `optional: true`
        // (documentary only, no player-decision engine here — see move's
        // own `optional` doc comment).
        { kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, validType: 'any', optional: true } satisfies Effect,
      ],
    },
    {
      name: 'onAttack',
      effects: [
        {
          // "put a +1/+1 counter on target creature, then double the
          // number of +1/+1 counters on that creature" — doubling depends
          // on the SAME chosen target's own live counter count after the
          // first counter is placed; no declarative Effect kind reads
          // "the counter count of whichever target putCounterTarget just
          // picked." `custom`, choosing the target once via the real
          // `chooseTarget` primitive and reading its real `getCounters()`
          // afterward, same live-read pattern Aerith Gainsborough's own
          // onDies trigger already establishes.
          kind: 'custom',
          describe: 'put a +1/+1 counter on target creature, then double the number of +1/+1 counters on that creature',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((o) => o.getCreaturesInPlay())];
            const target = actions.chooseTarget(pool);
            if (!target) return;
            actions.putCounter(target, '+1/+1', 1);
            actions.putCounter(target, '+1/+1', target.getCounters('+1/+1'));
          },
        } satisfies Effect,
      ],
    },
  ],
};
