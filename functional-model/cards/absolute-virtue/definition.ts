import type { CardDefinition } from '../../card';

// Real Forge script, `tmp/mtg-forge/forge-gui/res/cardsfolder/a/absolute_virtue.txt`:
//   R:Event$ Counter | ValidCard$ Card.Self | ValidSA$ Spell | Layer$ CantHappen | Description$ This spell can't be countered.
//   K:Flying
//   S:Mode$ Continuous | Affected$ You | AddKeyword$ Protection:Player.Opponent:each of your opponents | Description$ You have protection from each of your opponents. (...)
// Only `K:Flying` is a real Forge `K:` line — modeled below as a
// structured `keywords: ['Flying']` fact, same as any other printed
// keyword in this pool.
export const absoluteVirtue: CardDefinition = {
  name: 'Absolute Virtue',
  manaCost: '{6}{W}{U}',
  typeLine: 'Legendary Creature — Avatar Warrior',

  pt: [8, 8],
  keywords: ['Flying'],

  staticAbilities: [
    // Real `R:` replacement on the Counter EVENT (`Layer$ CantHappen`), not
    // a resolvable effect and not a `K:` keyword line — no counterspell/
    // Counter-event machinery exists anywhere in stack.ts/engine.ts for
    // this to hook into (`card.ts`'s own `kind:'counter'` Effect is
    // log-only, per its own doc comment, precisely because no real
    // stack/object model exists to remove a target from — there is
    // nothing for a "can't be countered" check to intercept). Same
    // real-`R:`-line-stays-text treatment eject's own definition.ts
    // already established for the identical clause.
    "This spell can't be countered.",
    // Real `S:` line grants the keyword 'Protection' to the CONTROLLING
    // PLAYER (`Affected$ You`), not to this creature itself — a real CR
    // 702.16e "protection granted to a player" variant, mechanically
    // distinct from creature-level protection (which also implies
    // "can't be blocked," 702.16b; this card's own reminder text omits
    // that clause on purpose, since a player is never a blocker).
    // Deliberately NOT modeled as `keywords: ['Protection']` on this
    // CardDefinition: that field is always permanent-scoped
    // (`RealCard.keywords`/`continuousKeywordGrants` — see state.ts) and
    // setting it here would misrepresent the card as the CREATURE having
    // protection (implying unblockability it doesn't printed-grant).
    // This engine also has no player-level keyword-grant primitive at
    // all (`Affected$ You` has no analogue anywhere in card.ts), and
    // Absolute Virtue is the only FIN card that would ever use one — not
    // worth building narrow, inert machinery for a keyword this engine
    // enforces nowhere anyway (no chokepoint anywhere in state.ts reads
    // 'Protection' for damage/targeting/enchant purposes, same
    // "recognized-but-inert" category Ward/Hexproof already are). Stays
    // real, honest static-ability text instead, same category as the
    // Counter-replacement line above.
    "You have protection from each of your opponents. (You can't be dealt damage, enchanted, or targeted by anything controlled by your opponents.)",
  ],
};
