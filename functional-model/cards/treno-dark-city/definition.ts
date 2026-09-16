import type { CardDefinition, Effect } from '../../card';

// Real script (treno_dark_city.txt): "This land enters tapped" — a real
// replacement effect, modeled as an onEnter trigger tapping self, same
// pool-based `tapTarget` convention elixir's own onEnter trigger uses
// (self is genuinely already on the battlefield by the time a named
// trigger's effects run — see harness.ts's own selfZone rule — so
// `owner: 'you'` finds exactly self as long as the scenario sets up no
// other land for "you"). `validType: 'land'` since Treno is a Land, not
// elixir's own Artifact.
//
// "{T}: Add {U} or {B}" is a real, structured `manaAbilities` entry
// (`Cost$ T | Produced$ Combo U B`, real Forge citation:
// `res/cardsfolder/t/treno_dark_city.txt`) — a genuine CHOICE-of-color
// source: `mana.ts`'s `assignManaRequirements` lets it pay EITHER color a
// cost needs, via real backtracking (closed 2026-09-14, superseding the
// old regex-over-`staticAbilities`-text path this comment used to
// describe; ENGINE_GAPS.md gap #5). Every other real FIN Town-cycle land
// in this batch (Gohn/Gongaga/Guadosalam/Insomnia/Rabanastre/Sharlayan/
// Vector/Windurst, plus Baron/Balamb Garden's own front faces) shares this
// exact real shape, just with a different color pair — each references
// THIS card's own comment rather than repeating it.
export const trenoDarkCity: CardDefinition = {
  name: 'Treno, Dark City',
  manaCost: '',
  typeLine: 'Land — Town',

  // recognizer-exception: entersBattlefield-self-trigger-structural — real
  // CR 614.12 "This land enters tapped" replacement effect, modeled as an
  // onEnter self-tap trigger (see treno-dark-city's own doc comment for the
  // full convention). No "When/Whenever <self> enters" clause exists in the
  // real printed text at all, so this recognizer correctly declines rather
  // than asserting a false sink fact.
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  manaAbilities: [{ colors: ['U', 'B'] }],
};
