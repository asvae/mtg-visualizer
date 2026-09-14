import type { CardDefinition, Effect } from '../../card';

export const ultimaOriginOfOblivion: CardDefinition = {
  name: 'Ultima, Origin of Oblivion',
  manaCost: '{5}',
  typeLine: 'Legendary Creature — God',

  keywords: ['Flying'],

  triggers: [
    {
      // Whole trigger+continuous-consequence clause as printed, one real
      // oracle line (data/fin/fin_scryfall.json) — the continuous "loses all
      // land types/abilities, has {T}: Add {C}" half is now REAL, typed,
      // functional engine behavior (closed, ENGINE_GAPS.md's own "Ultima,
      // Origin of Oblivion" writeup), not inert text: real Forge citation,
      // `res/cardsfolder/u/ultima_origin_of_oblivion.txt`:
      //   SVar:TrigPutCounter:DB$ PutCounter | ValidTgts$ Land | CounterType$ BLIGHT | CounterNum$ 1 | ... | SubAbility$ DBEffect
      //   SVar:DBEffect:DB$ Effect | RememberObjects$ Targeted | StaticAbilities$ BlightStatic | ForgetOnMoved$ Battlefield | ForgetCounter$ BLIGHT | Duration$ Permanent
      //   SVar:BlightStatic:Mode$ Continuous | Affected$ Card.IsRemembered | RemoveLandTypes$ True | RemoveAllAbilities$ True | AddAbility$ ColorlessMana
      //   SVar:ColorlessMana:AB$ Mana | Cost$ T | Produced$ C | SpellDescription$ Add {C}.
      // See `card.ts`'s own `CounterConditionalGrant` doc comment for the
      // full design (a real, LIVE, counter-presence-conditioned continuous
      // effect installed directly onto the target land, re-evaluated fresh
      // on every read) and its own `removeAllAbilities` field for the real,
      // named, only-PARTIALLY-enforced scope (mana abilities + printed
      // keywords + other activated abilities — NOT triggered abilities,
      // a real flagged gap). Own annotation (as of the
      // PRD_AUTOMATED_AUTHORING.md "definition-level annotation" migration,
      // 2026-09-13): `definition-annotations.json`, keyed `"triggers[0]"`.
      name: 'onAttack',
      effects: [
        {
          kind: 'putCounterTarget',
          validType: 'land',
          counterType: 'blight',
          amount: 1,
          qty: 1,
          grant: { removeLandTypes: true, removeAllAbilities: true, grantManaAbility: { colors: ['C'] } },
        } satisfies Effect,
      ],
    },
    {
      // Real Forge citation: `res/cardsfolder/u/ultima_origin_of_oblivion.txt`
      // — `T:Mode$ TapsForMana | ValidCard$ Land | Activator$ You |
      // Produced$ C | Execute$ TrigMana`. CLOSED 2026-09-14 (ENGINE_GAPS.md
      // gap #5) — this is now a REAL, auto-firing trigger
      // (`on: 'tapLandForMana'`, `tapLandForManaColor: 'C'`, see card.ts's
      // own `Trigger.on` doc comment for the full mechanism), no longer
      // manually fired by a scenario: `engine.ts`'s new
      // `fireOnTapLandForManaTriggers` genuinely detects a real land you
      // control being tapped for {C} (via `mana.ts`'s own `payMana`/
      // `sourceColors`) and fires this trigger for real. Only models the
      // "additional {C}" Ultima itself adds; the land's own base {C} is its
      // own real addMana line, not this trigger's job to reproduce. Own
      // annotation: `definition-annotations.json`, keyed `"triggers[1]"`.
      name: 'onTapLandForC',
      on: 'tapLandForMana',
      tapLandForManaColor: 'C',
      effects: [{ kind: 'addMana', color: 'C', amount: 1 } satisfies Effect],
    },
  ],
  // Former tier-3 `CardDefinition.authoredFacts` escape hatch for this
  // trigger's own real "wants a land tapped for {C}" want RETIRED
  // (2026-09-14, fact-parity pass) — `addMana-effect-structural.ts`'s own
  // paired-sink derivation now reads `on: 'tapLandForMana'` +
  // `tapLandForManaColor` directly (real, closed structural vocabulary that
  // didn't exist when this card's own `authoredFacts` entry was first
  // written) and produces the IDENTICAL real sink fact with genuine parser
  // provenance instead. Same "retire the escape hatch once the mechanism
  // becomes real" precedent Ashe, Princess of Dalmasca's own former
  // `authoredFacts` entry already established for `Trigger.on: 'attacks'`.
};
