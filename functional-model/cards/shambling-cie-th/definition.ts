import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const shamblingCieTh: CardDefinition = {
  name: "Shambling Cie'th",
  manaCost: '{2}{B}',
  typeLine: 'Creature — Mutant Horror',

  pt: [3, 3],

  triggers: [
    {
      // "This creature enters tapped" (a real replacement effect, R:Event$
      // Moved) — modeled as an onEnter trigger tapping self via the same
      // pool-based `tapTarget` stuck-in-summoners-sanctum's own onEnter
      // trigger uses. Self is genuinely already on the battlefield by the
      // time a named trigger's effects run (see harness.ts's own selfZone
      // rule), so `owner: 'you'` finds exactly self as long as the scenario
      // sets up no other creatures for "you" (chooseTarget always takes the
      // first pool candidate — no real player-choice engine here).
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'creature', owner: 'you' } satisfies Effect],
    },
    {
      // "Whenever you cast a noncreature spell, you may pay {B}. If you do,
      // return this card from your graveyard to your hand" — a real
      // graveyard-zone trigger. This model's harness always places `self`
      // on the battlefield when a named `trigger` fires (no notion of
      // "trigger fired from a different starting zone" — see
      // harness.ts's own selfZone rule), so the declarative pool-filtered
      // `move` effect (which would need self to actually BE in the
      // Graveyard array) can't target self here; `actions.moveTo(ctx.self,
      // ...)` moves the specific object directly regardless of its current
      // zone, the same convention jecht-reluctant-guardian-braska-s-final-
      // aeon's own front-face transform uses for the identical "operate on
      // self specifically, not a pool" need.
      name: 'onNoncreatureSpellCast',
      effects: [
        {
          kind: 'custom',
          describe: 'you may pay {B} to return this card from your graveyard to your hand',
          run: (ctx: EffectContext, actions: Actions) => {
            actions.moveTo(ctx.self, 'Hand');
          },
        } satisfies Effect,
      ],
    },
  ],
};
