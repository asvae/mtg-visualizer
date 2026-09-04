import type { CardDefinition, Effect } from '../../card';

// Real script (blitzball.txt): two independent activated abilities.
// "{T}: Add one mana of any color" is a real mana ability — no Effect kind
// (nor any action in interfaces.ts) models mana production anywhere in
// this system (same deliberate boundary white-auracite/cargo-ship's own
// "{T}: Add ..." abilities already document) — genuinely out of scope,
// kept as text only via `staticAbilities`.
//
// The second ("GOOOOAAAALLL!") ability IS modeled: draw two cards, cost
// {T}+sacrifice-self (cost text only, same "sacrifice is part of the
// cost, not an effect" convention qiqirn-merchant's own bigDraw ability
// uses). "Activate only if an opponent was dealt combat damage by a
// legendary creature this turn" is a real activation restriction with no
// per-turn-event-tracking anywhere in this model (no combat/attack-history
// state exists at all) — kept as real text on `activationCost`, same
// documentary-only treatment every other "activate only if/once" clause in
// this batch gets (crystal-fragments-summon-alexander's own "activate only
// as a sorcery," dark-knight-s-greatsword's own "activate only once each
// turn").
export const blitzball: CardDefinition = {
  name: 'Blitzball',
  manaCost: '{3}',
  typeLine: 'Artifact',

  staticAbilities: ['{T}: Add one mana of any color.'],

  activationCost:
    'GOOOOAAAALLL! — {T}, Sacrifice this artifact (activate only if an opponent was dealt combat damage by a legendary creature this turn)',
  effects: [{ kind: 'drawCard', amount: 2 } satisfies Effect],
};
