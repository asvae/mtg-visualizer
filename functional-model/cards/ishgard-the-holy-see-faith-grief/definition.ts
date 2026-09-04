import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import type { Card } from '../../interfaces';

// Real script (ishgard_the_holy_see_faith_grief.txt): the Adventure layout
// (real `AlternateMode:Adventure`), NOT a transforming DFC like jecht-
// reluctant-guardian-braska-s-final-aeon/vincent-valentine-galian-beast —
// front face is "Land — Town" (the mana source), back face is a separate
// Sorcery you can cast from hand instead; only after resolving does the
// Adventure rule let you later play the land from exile. `backFace`/
// `scenario.face: 'back'` is reused purely as a structural vehicle for
// "the card's second named mode" (same repurposing zanarkand-ancient-
// metropolis-lasting-fayth's own doc comment, a different agent's own FIN
// batch, already establishes for this exact real mechanic), not an
// assertion that this transforms.
//
// Front face: same real "enters tapped" replacement effect and mana-
// ability-as-text treatment as treno-dark-city's own doc comment explains
// in full.
//
// Back face ("Faith & Grief"): "Return up to two target artifact and/or
// enchantment cards from your graveyard to your hand." `move`'s own
// declarative `target: true` shape only filters by ONE of
// 'creature'|'artifact'|'land'|'any' — no 'enchantment' option and no
// disjunctive artifact-OR-enchantment filter exists, so the up-to-two
// targeted zone change is expressed via `custom` instead, replicating
// `move`'s own real target-then-moveTo loop (card.ts's own `case 'move':
// target` branch) with an `isArtifact() || isEnchantment()` filter added —
// both real predicates (`Card.isArtifact()`/`Card.isEnchantment()`), used
// directly, not an invented capability.
export const ishgardTheHolySee: CardDefinition = {
  name: 'Ishgard, the Holy See',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['{T}: Add {W}.'],

  backFace: {
    name: 'Faith & Grief',
    manaCost: '{3}{W}{W}',
    typeLine: 'Sorcery — Adventure',

    effects: [
      {
        kind: 'custom',
        describe: 'return up to two target artifact and/or enchantment cards from your graveyard to your hand',
        run: (ctx: EffectContext, actions: Actions) => {
          const pool = ctx.you.getCardsIn('Graveyard').filter((c) => c.isArtifact() || c.isEnchantment());
          const targets: Card[] = [];
          for (let i = 0; i < 2; i++) {
            const remaining = pool.filter((c) => !targets.includes(c));
            if (remaining.length === 0) break;
            targets.push(actions.chooseTarget(remaining));
          }
          for (const target of targets) actions.moveTo(target, 'Hand');
        },
      } satisfies Effect,
    ],
  },
};
