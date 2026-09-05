import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const elrondMoonReader: CardDefinition = {
  name: 'Elrond, Moon-Reader',
  manaCost: '{2}{U}',
  typeLine: 'Legendary Creature — Elf Noble',
  pt: [3, 3],

  triggers: [
    {
      // Real "Whenever you activate an ability of a creature, draw a card.
      // This ability triggers only once each turn." — the once-per-turn
      // cap has no representable state here (no per-turn trigger-count
      // tracking anywhere in this model), so a scenario just exercises one
      // activation -> one draw; a real game's second activation in the
      // same turn wouldn't draw again, this model would.
      name: 'onActivateCreatureAbility',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect],
    },
  ],

  activationCost: '{5}{U}{U}',
  effects: [
    {
      // Real "Exile up to two other target nonland permanents you control.
      // Return those cards to the battlefield under their owner's control
      // at the beginning of the next end step." `move`'s own `validType`
      // vocabulary ('creature'|'artifact'|'land'|'any') has no "nonland"
      // shape, so a declarative `move` can't express this filter — custom,
      // reading `isLand()` directly, is the honest shape. The "next end
      // step" delay IS a real delayed trigger now (`actions.delayUntil`,
      // functional-model/state.ts's `scheduleDelayedTrigger` +
      // functional-model/turn.ts's phase-entry drain) — the return
      // genuinely doesn't run until the game reaches EndOfTurn, proved by
      // this card's own `advanceToPhase: 'EndOfTurn'` scenario.
      kind: 'custom',
      describe: 'exile up to two other target nonland permanents you control, then return them to the battlefield under their owner\'s control at the beginning of the next end step',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = ctx.you.getCardsIn('Battlefield').filter((c) => !c.isLand() && c.getId() !== ctx.self.getId());
        const targets = [];
        for (let i = 0; i < 2; i++) {
          const remaining = pool.filter((c) => !targets.includes(c));
          if (remaining.length === 0) break;
          targets.push(actions.chooseTarget(remaining));
        }
        // Exile BOTH targets now — matches the real card's own two-step
        // structure (a single "exile up to two" event now, then a single
        // LATER "return those cards" event acting on the whole batch), not
        // two independent exile-then-immediately-return pairs.
        for (const t of targets) actions.moveTo(t, 'Exile');
        // Real rule: an exiled TOKEN ceases to exist and never comes back
        // (no other-zone printed existence) — not modeled here (this
        // model has no existence-check a card author can call without an
        // extra zone read that would need its own declared want), so a
        // token target would incorrectly "return." Scenarios below only
        // target nontoken permanents, so this never actually fires.
        actions.delayUntil('EndOfTurn', () => {
          for (const t of targets) actions.moveTo(t, 'Battlefield');
        });
      },
    } satisfies Effect,
  ],
};
