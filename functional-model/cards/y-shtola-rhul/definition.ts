import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const yshtolaRhul: CardDefinition = {
  name: "Y'shtola Rhul",
  manaCost: '{4}{U}{U}',
  typeLine: 'Legendary Creature — Cat Druid',

  pt: [3, 5],

  triggers: [
    {
      name: 'onEndStep',
      effects: [
        {
          // "exile TARGET creature you control, then return it to the
          // battlefield" — `move`'s own declarative shape can only move a
          // batch to ONE destination per Effect entry, not exile-then-
          // immediately-return in one step; `custom`, choosing one real
          // target and moving it twice, is the honest shape (same pattern
          // jecht/dion's own self-only exile-then-return transform uses,
          // just with a CHOSEN target instead of always `self`).
          //
          // "Then if it's the first end step of the turn, there is an
          // additional end step after this step" — real turn/phase-
          // structure mechanism now exists (`turn.ts`'s own
          // `queueExtraPhase`/`isFirstPhaseGroupOccurrenceThisTurn`,
          // ENGINE_GAPS.md gap #17, closed 2026-09-12): `ctx
          // .firstPhaseGroupOccurrenceThisTurn` is the real, caller-supplied
          // fact (set for real by `engine.ts`'s own `fireOnPhaseEnterTriggers`
          // when this fires through the real engine; set by `scenarios.ts`
          // the same way `mode`/`castFrom` are for a plain harness trace),
          // and `actions.queueExtraPhase('EndOfTurn')` is the real
          // consequence — no longer documentary-only text.
          kind: 'custom',
          describe: "exile target creature you control, then return it to the battlefield under its owner's control. Then if it's the first end step of the turn, there is an additional end step after this step",
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = ctx.you.getCreaturesInPlay();
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            const wasToken = target.isToken();
            actions.moveTo(target, 'Exile');
            // Real rule 111.7: a token that leaves the battlefield ceases
            // to exist — `state.ts`'s own `GameState.move` already deletes
            // it from tracked state entirely the moment it's exiled, so it
            // never actually returns. Only a real (nontoken) card comes
            // back.
            if (!wasToken) actions.moveTo(target, 'Battlefield');
            if (ctx.firstPhaseGroupOccurrenceThisTurn) actions.queueExtraPhase('EndOfTurn');
          },
        } satisfies Effect,
      ],
    },
  ],
};
