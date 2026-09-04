import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const hasteMagic: CardDefinition = {
  name: 'Haste Magic',
  manaCost: '{1}{R}',
  typeLine: 'Instant',

  effects: [
    { kind: 'pumpTarget', power: 3, toughness: 1 } satisfies Effect,
    // Split from the pump above so `custom` stays narrow — `chooseTarget`'s
    // deterministic "always pick pool[0]" means both land on the SAME
    // creature (no board mutation happens in between), matching Forge's
    // real single targeted creature.
    { kind: 'grantKeywordTarget', keyword: 'Haste', validType: 'creature' } satisfies Effect,
    {
      // "Exile the top card of your library. You may play it until your
      // next end step." No declarative kind fits an UNCONDITIONAL single-
      // card exile (`dig` always sends its matches to hand, never exile —
      // see gilgamesh-master-at-arms' own comment on that same
      // hardcoding), so `custom`, reading the real top-of-library card
      // directly. The "may play it" permission has no representable
      // Effect/Action anywhere in this model (no such thing as a granted
      // play-from-exile permission) — real text only, not modeled.
      kind: 'custom',
      describe: 'exile the top card of your library; you may play it until your next end step (the play permission is not modeled)',
      run: (ctx: EffectContext, actions: Actions) => {
        const lib = ctx.you.getCardsIn('Library');
        if (lib.length === 0) return;
        actions.moveTo(lib[0]!, 'Exile');
      },
    } satisfies Effect,
  ],
};
