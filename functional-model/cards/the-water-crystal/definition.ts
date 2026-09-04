import type { CardDefinition, Effect } from '../../card';

export const theWaterCrystal: CardDefinition = {
  name: 'The Water Crystal',
  manaCost: '{2}{U}{U}',
  typeLine: 'Legendary Artifact',

  staticAbilities: [
    // Real S:Mode$ ReduceCost — no cost-reduction machinery exists here
    // (same boundary travel-the-overworld/fate-of-the-sun-cryst already
    // document), real text only.
    'Blue spells you cast cost {1} less to cast.',
    // Real R:Event$ Mill ... ReplaceWith$ MillPlus4 — a genuine replacement
    // effect over ANY mill event an opponent would suffer (including one
    // this same card's own activated ability below causes), not a
    // resolvable step of anything. No replacement-effect framework exists
    // in this model (state.ts's own header rules out anything beyond the
    // action vocabulary card.ts/harness.ts use) — same "not mechanically
    // enforced" treatment the-darkness-crystal's own death-replacement
    // effect gets. Kept as real text, not executed by the activated
    // ability's own `move` effect below (which mills exactly the printed
    // amount, no +4).
    'If an opponent would mill one or more cards, they mill that many cards plus four instead.',
  ],

  // {4}{U}{U}, {T}: Each opponent mills cards equal to the number of cards
  // in your hand. Real Forge `DB$ Mill | NumCards$ Y | SVar:Y:Count$ValidHand`
  // — a live read of your own hand size at resolution, exactly what
  // `Computed<number>` exists for. Milling is modeled as `move` (library ->
  // graveyard, an unchosen batch — Forge itself has no dedicated Mill
  // Effect kind here, see card.ts's own `move` doc comment for the same
  // "unchosen batch" shape Malboro's own exile-top-three uses).
  activationCost: '{4}{U}{U}, {T}',
  effects: [
    {
      kind: 'move',
      owner: 'opponents',
      from: 'Library',
      to: 'Graveyard',
      qty: (ctx) => ctx.you.getCardsIn('Hand').length,
    } satisfies Effect,
  ],
};
