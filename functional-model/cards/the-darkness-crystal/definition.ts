import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const theDarknessCrystal: CardDefinition = {
  name: 'The Darkness Crystal',
  manaCost: '{2}{B}{B}',
  typeLine: 'Legendary Artifact',

  staticAbilities: [
    // Real S:Mode$ ReduceCost — no cost-reduction machinery exists here
    // (same boundary the-water-crystal's own analogous static gets), real
    // text only.
    'Black spells you cast cost {1} less to cast.',
    // Real R:Event$ Moved ... ReplaceWith$ Exile — a genuine replacement
    // effect over "a nontoken creature an opponent controls would die" (any
    // cause, not something this card's own effects/triggers resolve). No
    // replacement-effect framework exists in this model (same boundary
    // the-water-crystal's own mill-replacement static gets) — real text
    // only, NOT executed by `state.destroy`/`state.move` anywhere.
    'If a nontoken creature an opponent controls would die, instead exile it and you gain 2 life.',
  ],

  // {4}{B}{B}, {T}: Put target creature card exiled with The Darkness
  // Crystal onto the battlefield tapped under your control with two
  // additional +1/+1 counters on it. Real Forge's own `ExiledWithSource`
  // target restriction (which cards THIS permanent specifically put into
  // exile) has no tracked equivalent here — the replacement effect above
  // that would populate that real pool isn't executed either (see this
  // file's own comment) — so the candidate pool is approximated as "any
  // creature card in your exile zone." `move`'s own targeted branch has no
  // field for entering tapped or with counters (same gap phoenix-down's own
  // comment documents for its own graveyard-recursion effect), so this is
  // `custom`.
  activationCost: '{4}{B}{B}, {T}',
  effects: [
    {
      kind: 'custom',
      describe:
        'put target creature card exiled with The Darkness Crystal onto the battlefield tapped under your control with two additional +1/+1 counters on it (exiled-by-this-source tracking not modeled — filtered by exile zone + creature type only)',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = ctx.you.getCardsIn('Exile').filter((c) => c.isCreature());
        if (pool.length === 0) return;
        const target = actions.chooseTarget(pool);
        actions.moveTo(target, 'Battlefield');
        actions.tap(target);
        actions.putCounter(target, '+1/+1', 2);
      },
    } satisfies Effect,
  ],
};
