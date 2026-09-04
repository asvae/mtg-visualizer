import type { CardDefinition, Effect } from '../../card';

export const renoAndRude: CardDefinition = {
  name: 'Reno and Rude',
  manaCost: '{1}{B}',
  typeLine: 'Legendary Creature — Human Assassin',

  pt: [2, 1],
  keywords: ['Menace'],

  triggers: [
    {
      name: 'onDealsDamage',
      effects: [
        // "exile the top card of THAT PLAYER's library" — the damaged
        // player, i.e. an opponent (this model's combat-damage probes only
        // ever target an opponent — see harness.ts's own dealsCombatDamage
        // doc comment). An unchosen batch of 1 (no player choice in which
        // card), so the untargeted `move` branch, not `target: true`.
        { kind: 'move', owner: 'opponents', from: 'Library', to: 'Exile', qty: 1 } satisfies Effect,
        // "you may sacrifice another creature or artifact" — optional is
        // documentary only (see card.ts's own doc comment: no
        // legal-target-but-declined engine exists here).
        { kind: 'sacrifice', owner: 'you', validType: 'creature-or-artifact', notSelf: true, optional: true } satisfies Effect,
        // "If you do, you may play the exiled card this turn, and mana of
        // any type can be spent to cast it" — a granted PERMISSION
        // (MayPlay), not a state mutation; nothing in this model ever casts
        // a card from exile, so there's no action to hook this into. Kept
        // as a no-op custom purely so synergyTags() still sees the real
        // text, same treatment cecil-dark-knight's own Protect grant and
        // summon-shiva's own Diamond Dust get for an unrepresentable clause.
        {
          kind: 'custom',
          describe: 'if a creature or artifact was sacrificed, you may play the exiled card this turn, and mana of any type can be spent to cast it (no cast-from-exile/MayPlay tracking exists in this model)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
