import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

// A transforming DFC (Enchantment // Land) — same `backFace` shape jecht-
// reluctant-guardian-braska-s-final-aeon/crystal-fragments-summon-alexander
// already establish: a second, independent `CardDefinition`, reached via
// `Scenario.face: 'back'`.
//
// Deliberately NOT the same transform MECHANIC as Dion/Jill/Jecht, though
// (2026-09-12, re-verified against the real oracle text while migrating this
// card's own facts to the unified Fact model): those three cards' own
// activated abilities literally read "Exile ~, then return it to the
// battlefield transformed" — a real, printed Battlefield→Exile→Battlefield
// double zone-change (`saga.ts`'s own `transformPermanent` covers the OTHER
// half of that specific case, not this one). This card's own trigger just
// says "...create a Food token and transform this enchantment" — CR 712.6's
// plain in-place flip, which is NOT a zone change at all (the permanent
// stays the same object, same zone, same everything except which face is
// showing). Modeling it as an exile/return pair here would misrepresent a
// real rules distinction this card's own printed text draws, not just skip
// an engine feature — correctly left text-only below instead (no zone facts
// authored for it), same as the `describe` comment already reasoned before
// this note was added.
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

    // {T}: Add {W} — a real mana ability. `card.ts` DOES have a real
    // `kind:'addMana'` Effect now (promoted 2026-09-05, same as `drawCard`)
    // — this stale comment used to say no such Effect kind existed at all;
    // it's simply not used HERE because a plain single-color "{T}: Add X."
    // static ability is the documented, accepted `verify-synergy.mjs`
    // exemption (`staticManaColorsFor`) that doesn't require a structured
    // Effect/real trace line to back its own `addMana` fact — no mana POOL
    // is modeled anywhere in this system either way (`state.ts`'s own
    // header rules out a full rules engine), so wiring the real Effect kind
    // here would add no executable behavior beyond what the fact already
    // (correctly) claims via the exemption.
    staticAbilities: ['{T}: Add {W}.'],

    // {3}, {T}, Sacrifice an artifact: Put a +1/+1 counter on EACH creature
    // you control. Activate only as a sorcery. The sacrifice is part of the
    // COST (text on `activationCost`, same convention phoenix-down's own
    // exile-self cost uses) — but unlike phoenix-down's/summon-bahamut's/
    // crystal-fragments' own self-sacrifice costs, this one sacrifices a
    // DIFFERENT permanent (any artifact you control, not this land itself).
    // Modeled as a real SOURCE fact (`event:'sacrifice', target:{types:
    // {has:['Artifact']}}`, no `subject:'self'`) — the same shape The Gold
    // Saucer's own "Sacrifice two artifacts: Draw a card" cost already
    // established for this exact "sacrifice something else as a cost"
    // class. Deliberately no `targeted` field on that fact: CR 601.2c
    // targeting never applies to a sacrifice COST (no hexproof/protection/
    // shroud relevance to choosing what to sacrifice), so this isn't a
    // "chosen target" vs. "unconditional broadcast" question at all — the
    // axis `targeted` distinguishes just doesn't exist here, same "omit,
    // don't force a boolean" reasoning `self-cast`/`self-enters` already
    // established for facts with no real bucket-of-candidates concept.
    activationCost: '{3}, {T}, Sacrifice an artifact (activate only as a sorcery)',
    effects: [{ kind: 'putCounterAll', predicate: 'creatures-you-control', counterType: '+1/+1', amount: 1 } satisfies Effect],
  },
};
