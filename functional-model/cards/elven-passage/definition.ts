import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const elvenPassage: CardDefinition = {
  name: 'Elven Passage',
  manaCost: '',
  typeLine: 'Land',

  activationCost: '{T}, Pay 1 life, Sacrifice this land',
  effects: [
    { kind: 'loseLife', owner: 'you', amount: 1 } satisfies Effect,
    {
      // Real "Search your library for a basic land card, put it onto the
      // battlefield tapped, then shuffle. You may behold an Elf. If you
      // do, untap that land." Self-sacrifice (part of the activation
      // cost) plus a full-library search-to-battlefield have no
      // declarative shape (`sacrifice`'s own chooseTarget could pick a
      // DIFFERENT land than self; `dig`/`move` only reach hand/graveyard,
      // never battlefield) — custom, moving `ctx.self` directly and
      // reading the whole library. "Basic" isn't checked (no
      // supertype/hasSupertype anywhere in this model, only `isLand()`) —
      // matches any land, not just a basic one. The "behold an Elf" choice
      // (untap if you do) isn't modeled at all — no engine concept of
      // "reveal a card from hand" or a player's own free choice exists
      // here (chooseTarget is always deterministic) — the fetched land
      // simply stays tapped.
      kind: 'custom',
      describe: 'sacrifice this land, then search your library for a basic land card and put it onto the battlefield tapped (behold-an-Elf untap choice not modeled)',
      run: (ctx: EffectContext, actions: Actions) => {
        actions.moveTo(ctx.self, 'Graveyard');
        const [land] = ctx.you.getCardsIn('Library').filter((c) => c.isLand());
        if (land) {
          actions.moveTo(land, 'Battlefield');
          actions.tap(land);
        }
      },
    } satisfies Effect,
  ],
};
