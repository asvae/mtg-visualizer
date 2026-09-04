import type { CardDefinition, Effect } from '../../card';

export const tripleTriad: CardDefinition = {
  name: 'Triple Triad',
  manaCost: '{3}{R}{R}{R}',
  typeLine: 'Enchantment',

  triggers: [
    {
      // Real `DB$ Dig | Defined$ Player | DigNum$ 1 | ChangeNum$ All |
      // DestinationZone$ Exile` for EACH player — `move`'s own `owner:
      // 'each'` covers "each player exiles the top card of their library"
      // exactly. The follow-up "until end of turn, you may play the card
      // you own exiled this way and each other card exiled this way with
      // lesser mana value than it without paying their mana costs" is a
      // real, separate STATIC permission grant with no equivalent action
      // anywhere in this engine (no "grant permission to cast without
      // paying its cost" mechanism, and no cross-player mana-value
      // comparison tracking for exiled cards) — left unmodeled beyond this
      // comment, same "genuinely out of scope" treatment summon-brynhildr's
      // own chapter I "may play" permission gets.
      name: 'onUpkeep',
      effects: [{ kind: 'move', owner: 'each', from: 'Library', to: 'Exile', qty: 1, target: false } satisfies Effect],
    },
  ],
};
