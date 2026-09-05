import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const formidableSpeaker: CardDefinition = {
  name: 'Formidable Speaker',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [2, 4],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        // "You may discard a card. If you do, search your library for a
        // creature card..." — modeled as always discarding (if a card is
        // available) then always searching, same "no player-decision
        // engine" simplification the rest of this model's `optional`
        // fields already document.
        { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect,
        {
          // Full-library search (not top-N) has no declarative shape
          // (`dig` only reads the top of the library) — custom, same
          // pattern as elven-passage's own basic-land search.
          kind: 'custom',
          describe: 'search your library for a creature card and put it into hand',
          run: (ctx: EffectContext, actions: Actions) => {
            const [creature] = ctx.you.getCardsIn('Library').filter((c) => c.isCreature());
            if (creature) actions.moveTo(creature, 'Hand');
          },
        } satisfies Effect,
      ],
    },
  ],

  activationCost: '{1}, {T}',
  effects: [{ kind: 'untapTarget', validType: 'any', notSelf: true } satisfies Effect],
};
