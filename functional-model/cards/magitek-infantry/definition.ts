import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const magitekInfantry: CardDefinition = {
  name: 'Magitek Infantry',
  manaCost: '{W}',
  typeLine: 'Artifact Creature — Robot Soldier',

  // Conditional continuous P/T ability, presence-gated on ANOTHER artifact
  // (IsPresent$ Artifact.Other+YouCtrl) — same shape gaelicat's own comment
  // already documents (a fixed on/off threshold, not a count-scaling
  // `ptFormula` CDA), so it stays real text.
  staticAbilities: ['This creature gets +1/+0 as long as you control another artifact.'],

  // {2}{W}: Search your library for a card named Magitek Infantry, put it
  // onto the battlefield tapped, then shuffle. No declarative Effect kind
  // covers "search for a specifically NAMED card" (`move`'s own `validType`
  // is type-only — creature/artifact/any — never a name filter; `dig` looks
  // at the top of the library, not the whole thing) — `custom`, filtering
  // the real library by name, is the honest shape. The "then shuffle" has
  // no observable consequence in this model (no library-order tracking
  // beyond dig's own top-N slice), so it's text-only in `describe`.
  activationCost: '{2}{W}',
  effects: [
    {
      kind: 'custom',
      describe: 'search your library for a card named Magitek Infantry, put it onto the battlefield tapped, then shuffle (shuffle has no observable effect in this model)',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = ctx.you.getCardsIn('Library').filter((c) => c.getName() === ctx.self.getName());
        if (pool.length === 0) return;
        const found = actions.chooseTarget(pool);
        actions.moveTo(found, 'Battlefield');
        actions.tap(found);
      },
    } satisfies Effect,
  ],
};
