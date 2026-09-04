import type { CardDefinition, Effect } from '../../card';

export const iceMagic: CardDefinition = {
  name: 'Ice Magic',
  manaCost: '{1}{U}',
  typeLine: 'Instant',

  // Real K:Tiered (SP$ Charm with a per-mode ModeCost$) — an ADDITIONAL
  // cost that varies per mode chosen, not a genuine MTG "choose one" (a
  // real modal spell has no per-mode cost). `modal`'s `describe`/`effects`
  // shape still captures "which branch resolves," so it's reused here even
  // though the cost distinction itself isn't tracked (no field on
  // `modal`'s modes carries a cost) — the same "documentary text, no
  // mechanical enforcement" trade this codebase already accepts elsewhere
  // (e.g. `optional`/`notSelf` fields on other Effect kinds).
  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: "Blizzard — {0} — Return target creature to its owner's hand.",
          // Real ValidTgts$ Creature has no owner restriction (any
          // player's creature) — same cross-player-pool gap Eject's own
          // `move` effect hit (see that card's comment): `owner:
          // 'opponents'` stands in for the representative case.
          effects: [{ kind: 'move', owner: 'opponents', from: 'Battlefield', to: 'Hand', qty: 1, validType: 'creature', target: true } satisfies Effect],
        },
        {
          describe: "Blizzara — {2} — Target creature's owner puts it on their choice of the top or bottom of their library.",
          // Real AlternativeDecider$ TargetedOwner — the TARGET's owner
          // (not the caster) chooses top/bottom; this model has no
          // player-decision engine anywhere and `move`'s own Library
          // destination carries no top/bottom position field, so only the
          // real zone change (to Library) is tracked, not the choice.
          effects: [{ kind: 'move', owner: 'opponents', from: 'Battlefield', to: 'Library', qty: 1, validType: 'creature', target: true } satisfies Effect],
        },
        {
          describe: "Blizzaga — {5}{U} — Target creature's owner shuffles it into their library.",
          // "Shuffle" has no observable consequence anything downstream
          // reads in this model (no library-order tracking beyond
          // top/bottom-of-array) — same "not modeled, no consequence"
          // treatment from-father-to-son's own comment already documents.
          effects: [{ kind: 'move', owner: 'opponents', from: 'Battlefield', to: 'Library', qty: 1, validType: 'creature', target: true } satisfies Effect],
        },
      ],
    } satisfies Effect,
  ],
};
