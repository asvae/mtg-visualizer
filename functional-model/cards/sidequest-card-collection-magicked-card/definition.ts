import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (fin/73, transform DFC): front "Sidequest: Card Collection"
// ({3}{U}, Enchantment) — "When this enchantment enters, draw three cards,
// then discard two cards. / At the beginning of your end step, if eight or
// more cards are in your graveyard, transform this enchantment." Back
// "Magicked Card" (Artifact — Vehicle, 4/4) — "Flying / Crew 1." Migrated to
// the unified Fact model 2026-09-12, same shape jill-shiva-s-dominant-
// shiva-warden-of-ice/dion-bahamut-s-dominant-bahamut-warden-of-light
// already establish for a transforming DFC's front/back split — used
// directly as house-style precedent for the annotation/face conventions
// here.
//
// UNLIKE Jill/Dion/Jecht, this card's own transform is a PLAIN CR 712 face
// flip ("transform this enchantment") — no "Exile X, then return it to the
// battlefield transformed" clause at all, so there is no zone-change
// consequence to model with `actions.moveTo` the way those 3 cards' own
// front-face activated transforms need. `saga.ts`'s `transformPermanent`
// (which just re-registers `GameEngine.resolvedPermanents` to the new face,
// generalized to ANY `CardDefinition` — its own `advanceSaga` call
// genuinely no-ops for a non-Saga `newFace` like Magicked Card, `isSaga`
// checks the typeLine) covers this with zero extra machinery; a piloting
// caller still calls it explicitly right after the trigger fires, same
// "explicit signal, not auto-inferred" convention those 3 cards' own
// transforms already require (no card's own `custom` effect has a
// `GameEngine` reference to call it itself — `saga.ts`'s own header).
export const sidequestCardCollection: CardDefinition = {
  name: 'Sidequest: Card Collection',
  manaCost: '{3}{U}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onEnter',
      // Real 603.6b ETB — auto-fired by `engine.ts`'s own `resolveTop` the
      // moment this resolves onto the battlefield (ENGINE_GAPS.md, closed).
      on: 'enter',
      // Real loot shape (draw, then discard) — same real `drawCard`+
      // `discard` Effect pair qiqirn-merchant's own "cantrip" ability
      // already establishes (there, {1},{T}: draw a card, then discard a
      // card; here, a fixed draw-3-discard-2 ETB, no activation cost).
      effects: [{ kind: 'drawCard', amount: 3 } satisfies Effect, { kind: 'discard', owner: 'you', qty: 2 } satisfies Effect],
    },
    {
      name: 'onEndStep',
      // Real 603.6b "at the beginning of your end step" — auto-fired by
      // `engine.ts`'s own `fireOnPhaseEnterTriggers` (ENGINE_GAPS.md gap #3,
      // closed 2026-09-12) for the ACTIVE player's own permanents. This is
      // the FIRST real card in the pool to actually declare `on:'endStep'`
      // (checked — Yuna, Hope of Spira/Ultimecia, Time Sorceress, the two
      // cards ENGINE_GAPS.md's own gap #3 writeup cites as needing it, are
      // both still unmigrated).
      on: 'endStep',
      effects: [
        {
          kind: 'custom',
          describe:
            'if eight or more cards are in your graveyard, transform this enchantment — the intervening-if condition (CR 603.4) is genuinely checked here (a real board-state read, not a documentary stand-in), but the transform ITSELF has no in-model consequence to run: no zone change happens (unlike Jill/Dion/Jecht\'s own "exile, then return transformed" — see this file\'s own header), so a piloting caller calls saga.ts\'s transformPermanent explicitly once the condition holds, same explicit-signal convention those cards already use',
          run: (ctx: EffectContext, _actions: Actions) => {
            // Real read (logs `read:getCardsIn` for real, same evidence
            // shape golbez-crystal-collector's own analogous "if you
            // control four or more artifacts" gate already establishes) —
            // no generic (non-type-specific) graveyard-card-COUNT Fact
            // vocabulary exists in this model (only type-presence wants
            // like "a Creature card in your graveyard"), and this
            // condition has no zone movement of its own either, so it's
            // genuinely fact-less — see this card's own progress.json
            // knownGaps.
            const graveyardCount = ctx.you.getCardsIn('Graveyard').length;
            if (graveyardCount < 8) return;
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Magicked Card',
    manaCost: '',
    typeLine: 'Artifact — Vehicle',
    pt: [4, 4],
    // Flying — bare printed keyword, no fact (2026-09-12 standing rule,
    // SYNERGY_DESIGN.md — purely passive, no observable occurrence, same
    // treatment cargo-ship/the-lunar-whale's own bare Flying already get).
    keywords: ['Flying'],
    // Real "Crew 1" — the same real `crewCost`+`activationCost`+
    // `effects:[animate]` machinery magitek-armor/cargo-ship/the-lunar-
    // whale already establish (ENGINE_GAPS.md's Crew N entry, CLOSED):
    // `crewCost` is the structured N `canActivateAbility`/`activateAbility`
    // check for real (`crewedBy`); `activationCost` is a descriptive label
    // only, kept so `harness.ts`'s flat lifecycle (unused by this card's own
    // engine-piloted scenario, but checked for pool-wide consistency) would
    // still pick the correct activate-not-cast shape if ever driven that way.
    crewCost: 1,
    activationCost: 'Crew 1 (tap creatures with total power 1 or more)',
    effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] } satisfies Effect],
  },
};
