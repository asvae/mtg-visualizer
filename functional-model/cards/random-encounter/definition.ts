import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const randomEncounter: CardDefinition = {
  name: 'Random Encounter',
  manaCost: '{4}{R}{R}',
  typeLine: 'Sorcery',

  alternateCosts: [{ name: 'Flashback', cost: '{6}{R}{R}', from: 'graveyard', thenExile: true }],

  effects: [
    {
      // "Shuffle your library, then mill four cards. Put each creature card
      // milled this way onto the battlefield. They gain haste." Shuffle has
      // no observable consequence in this model (no real shuffle mechanic —
      // same "not modeled" treatment from-father-to-son's own "then
      // shuffle" already gets). The rest needs a REAL reference to exactly
      // which cards got milled (so only THOSE creature cards, not the whole
      // graveyard, enter the battlefield and gain haste) — no declarative
      // `move` call can branch a single batch into two different
      // destinations by type, so `custom`, using the real `Card[]` the
      // batch `actions.move` call itself returns, is the honest shape.
      kind: 'custom',
      describe: 'shuffle your library, then mill four cards; put each creature card milled this way onto the battlefield, and it gains haste',
      run: (ctx: EffectContext, actions: Actions) => {
        const milled = actions.move(ctx.you, 'Library', 'Graveyard', 4, 'any');
        for (const card of milled) {
          if (!card.isCreature()) continue;
          actions.moveTo(card, 'Battlefield');
          actions.grantKeyword(card, 'Haste');
        }
      },
    } satisfies Effect,
  ],

  triggers: [
    {
      // "At the beginning of the next end step, return those creatures to
      // their owner's hand" — a real delayed trigger (704's own DelayedTrigger
      // machinery); modeled as a separate NAMED trigger the same "turn-based
      // event as its own trigger" simplification jecht/summon-bahamut's own
      // Saga chapters already use. Each scenario run is its own independent
      // `runScenario` call (harness.ts) with no cross-run "remembered
      // objects" carried over (no Forge-style RememberedCard tracking
      // anywhere in this model), so this can't be scoped to specifically
      // the creatures THIS resolution put onto the battlefield — it returns
      // creature cards you control generally, same approximation weapons-
      // vendor/dragoon-s-lance's own always-first-candidate targeting
      // already accepts elsewhere.
      name: 'atNextEndStep',
      effects: [{ kind: 'move', owner: 'you', from: 'Battlefield', to: 'Hand', qty: 4, validType: 'creature', target: false } satisfies Effect],
    },
  ],
};
