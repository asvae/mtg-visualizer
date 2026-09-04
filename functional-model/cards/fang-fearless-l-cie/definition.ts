import type { CardDefinition, Effect } from '../../card';

// Real script (fang_fearless_lcie.txt): `AlternateMode:Meld`,
// `MeldPair:Vanille, Cheerful l'Cie` — Fang MELDS with a separate card
// (Vanille, Cheerful l'Cie, not in this batch) into a THIRD card, Ragnarok,
// Divine Deliverance. Confirmed via both the Forge script and Scryfall (its
// own `all_parts` lists Fang as `meld_part`, Ragnarok as `meld_result`,
// alongside Vanille as the other `meld_part` — a real 3-card group, not a
// 2-card transforming DFC pair).
//
// This is NOT what `CardDefinition.backFace` models: `backFace` is
// documented (and every existing user — Jecht/Braska's Final Aeon, Dion/
// Bahamut — confirms this) as ONE object transforming into its own second
// face, reached via that SAME object's own ability (`ChangeZone` exile-then-
// return). Meld is mechanically different — TWO separate permanents (each
// independently cast, independently a real object with its own zone
// history) are exiled together and replaced by a THIRD, new object; neither
// original card "is" the melded result the way a DFC's back face "is" the
// same permanent. Authoring Ragnarok as Fang's own `backFace` would
// misrepresent it as reachable by Fang's own ability alone, when the real
// trigger lives on Vanille (a card this batch doesn't include) and requires
// both permanents. No CardDefinition field models "two permanents consume
// into a third" at all — flagged as a real gap in this batch's own final
// report, not worked around.
//
// So: Fang is authored here as its own standalone, real, independently
// castable card (all its own printed text is fully modelable on its own).
// Ragnarok, Divine Deliverance is SKIPPED rather than force-fit as a
// `backFace` that would misrepresent the mechanic.
export const fangFearlessLcie: CardDefinition = {
  name: "Fang, Fearless l'Cie",
  manaCost: '{2}{B}',
  typeLine: 'Legendary Creature — Human Warrior',

  pt: [2, 3],

  triggers: [
    {
      // "This ability triggers only once each turn" — no once-per-turn
      // firing limit is tracked anywhere in this model (a scenario firing
      // a named trigger already stands in for "the real triggering
      // condition was met," same as every other conditional trigger name in
      // this repo — Minwu's own `onLifeGained`, e.g.); the limit itself is
      // real text with no field to enforce it against, same documentary
      // treatment as `ActivationLimit$`-style caps elsewhere in this batch.
      name: 'onGraveyardCardsLeave',
      effects: [{ kind: 'drawCard' } satisfies Effect, { kind: 'loseLife', owner: 'you', amount: 1 } satisfies Effect],
    },
  ],
};
