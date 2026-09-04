import type { CardDefinition, Effect, EffectContext } from '../../card';

// Real script (jidoor_aristocratic_capital_overture.txt): the Adventure
// layout, same real mechanic zanarkand-ancient-metropolis-lasting-fayth's
// own doc comment (a different agent's own FIN batch) explains in full —
// `backFace`/`scenario.face: 'back'` is reused as a structural vehicle for
// the card's second named mode, not an assertion that this transforms.
//
// Front face: same real "enters tapped" replacement effect and mana-
// ability-as-text treatment as treno-dark-city's own doc comment.
//
// Back face ("Overture"): "Target opponent mills half their library,
// rounded down." — real `SVar:X:TargetedPlayer$CardsInLibrary/HalfDown`, a
// genuinely dynamic amount read off the target's OWN current library size
// at resolution — exactly what `Computed<number>` exists for. Mill is
// `move`'s own real unchosen-batch shape (`from: 'Library', to:
// 'Graveyard'`), no `mill` Effect kind needed (see eden-seat-of-the-
// sanctum's own comment on this same point). `owner: 'opponents'` — this
// model has no single-opponent-choice targeting (every targeted effect
// here already accepts this same "any opponent" approximation, e.g.
// interfaces.ts's own `highest()` doc comment), correct 1:1 at a 1v1
// table.
export const jidoorAristocraticCapital: CardDefinition = {
  name: 'Jidoor, Aristocratic Capital',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['{T}: Add {U}.'],

  backFace: {
    name: 'Overture',
    manaCost: '{4}{U}{U}',
    typeLine: 'Sorcery — Adventure',

    effects: [
      {
        kind: 'move',
        owner: 'opponents',
        from: 'Library',
        to: 'Graveyard',
        qty: (ctx: EffectContext) => Math.floor((ctx.opponents[0]?.getCardsIn('Library').length ?? 0) / 2),
      } satisfies Effect,
    ],
  },
};
