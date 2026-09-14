import type { CardDefinition, Effect } from '../../card';

export const ashePrincessOfDalmasca: CardDefinition = {
  name: 'Ashe, Princess of Dalmasca',
  manaCost: '{2}{W}',
  typeLine: 'Legendary Creature — Human Rebel Noble',

  triggers: [
    {
      name: 'onAttack',
      // Real Forge `TriggerType.Attacks` (`ValidCard$ Card.Self` —
      // `res/cardsfolder/a/ashe_princess_of_dalmasca.txt`'s own
      // `T:Mode$ Attacks | ValidCard$ Card.Self | Execute$ TrigDig | ...`),
      // now a real, closed-vocabulary auto-fire here too (ENGINE_GAPS.md —
      // attack-triggered-ability auto-dispatch; `card.ts`'s own
      // `Trigger.on: 'attacks'` doc comment) — `engine.ts`'s
      // `fireOnAttackTriggers` fires this for real off a genuine
      // `declareAttackers` call, no manual `pilotFireTrigger` needed
      // anymore (see `scenarios.ts`). This card's own "wants to attack"
      // sink used to need a tier-3 `CardDefinition.authoredFacts` escape
      // hatch specifically BECAUSE `Trigger.on` had no closed vocabulary
      // for "attacks" — now that it does, the fact is derived the normal
      // way instead, by `recognizers/attacks-trigger-structural.ts`
      // (`scripts/apply-recognizers.mjs`), straight into this card's own
      // `synergy.json` sink array with real `provenance`.
      on: 'attacks',
      effects: [{ kind: 'dig', qty: 5, take: 1, validType: 'artifact', optional: true } satisfies Effect],
    },
  ],
};
