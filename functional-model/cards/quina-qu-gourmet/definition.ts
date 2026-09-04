import type { CardDefinition, Effect } from '../../card';

export const quinaQuGourmet: CardDefinition = {
  name: 'Quina, Qu Gourmet',
  manaCost: '{2}{G}',
  typeLine: 'Legendary Creature — Qu',

  pt: [2, 3],

  // Real `R:Event$ CreateToken | ReplaceWith$ DBReplace` — a replacement
  // effect on EVERY token-creation event under your control (not just this
  // card's own), genuinely cross-card in scope. No Effect kind models a
  // replacement effect that intercepts another ability's own resolution
  // (this model has no generic token-creation hook to attach a
  // replacement to) — kept as real printed text, same "continuous rule,
  // not a resolvable step" treatment `staticAbilities` already gives A
  // Realm Reborn's own granted mana ability.
  staticAbilities: ['If one or more tokens would be created under your control, those tokens plus a 1/1 green Frog creature token are created instead.'],

  // {2}, Sacrifice a Frog: Put a +1/+1 counter on Quina. `sacrifice`'s own
  // declarative `validType` has no subtype filter (only
  // creature/artifact/enchantment/any/creature-or-artifact), so
  // `'creature'` is the closest fit for "a Frog" — a real, documented
  // approximation (same class of loss `move`'s own subtype gap already
  // carries elsewhere). `notSelf: true` since the real cost can never
  // target Quina itself (it isn't a Frog).
  activationCost: '{2}, Sacrifice a Frog',
  effects: [
    { kind: 'sacrifice', owner: 'you', validType: 'creature', notSelf: true } satisfies Effect,
    { kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect,
  ],
};
