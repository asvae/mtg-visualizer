import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

// A transforming DFC (Enchantment // Land) — same `backFace` shape jecht-
// reluctant-guardian-braska-s-final-aeon/crystal-fragments-summon-alexander
// already establish: a second, independent `CardDefinition`, reached via
// `Scenario.face: 'back'`.
export const sidequestCatchAFish: CardDefinition = {
  name: 'Sidequest: Catch a Fish',
  manaCost: '{2}{W}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onUpkeep',
      effects: [
        {
          kind: 'custom',
          // Real `DB$ PeekAndReveal` (look at the top card, conditionally
          // reveal+move it) — `dig`'s own declarative `validType` only
          // covers `'artifact' | 'any'`, never a creature-OR-artifact
          // union, and it has no notion of "look but leave in place if it
          // doesn't match" beyond its own qty/take split (which already
          // puts non-matches on the BOTTOM, not back on top) — `custom`,
          // reading the real top-of-library card directly, is the honest
          // shape. "Transform this enchantment" has no observable
          // consequence in this model (no card here tracks "which face is
          // currently showing" as state — same gap jecht's own front-face
          // comment already documents), so it stays text-only in
          // `describe`; this card's own `backFace`'s abilities are instead
          // exercised directly via `Scenario.face: 'back'`.
          describe: "look at the top library card; if it's an artifact or creature, may reveal it and put it into hand, create a Food token, then transform this enchantment (transform itself not tracked as state)",
          run: (ctx: EffectContext, actions: Actions) => {
            const [top] = ctx.you.getCardsIn('Library');
            if (!top) return;
            if (top.isCreature() || top.isArtifact()) {
              actions.moveTo(top, 'Hand');
              actions.createToken(ctx.you, TOKENS.c_a_food_sac, 1);
            }
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Cooking Campsite',
    manaCost: '',
    typeLine: 'Land',

    // {T}: Add {W} — a real mana ability. No Effect kind (nor any action in
    // interfaces.ts) models mana production anywhere in this system
    // (state.ts's own header rules out a full rules engine, and no other
    // card built so far — no basic land is among functional-model/cards/*
    // either) — genuinely out of scope, kept as text only, not flagged as
    // a gap to fix (this is a deliberate boundary, not an oversight).
    staticAbilities: ['{T}: Add {W}.'],

    // {3}, {T}, Sacrifice an artifact: Put a +1/+1 counter on EACH creature
    // you control. Activate only as a sorcery. The sacrifice is part of the
    // COST (text on `activationCost`, same convention phoenix-down's own
    // exile-self cost uses).
    activationCost: '{3}, {T}, Sacrifice an artifact (activate only as a sorcery)',
    effects: [{ kind: 'putCounterAll', predicate: 'creatures-you-control', counterType: '+1/+1', amount: 1 } satisfies Effect],
  },
};
