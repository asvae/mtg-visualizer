import type { CardDefinition, Effect } from '../../card';

// Real Forge (eager_trufflesnout.txt): `T:Mode$ DamageDone | ValidSource$
// Card.Self | ValidTarget$ Player | CombatDamage$ True` — "deals combat
// damage to a player." No `Trigger.on` value exists for this dispatch;
// kept as a bare name-only trigger (established convention). "Food" is a
// real Scryfall keyword tag on this card, not a real Forge `K:` line/this
// schema's `Keyword` — the actual token it creates is a plain noncreature
// Artifact — Food token (its own sac-for-3-life ability is real, printed
// token text; no P/T since it's not a Creature).
export const eagerTrufflesnout: CardDefinition = {
  name: 'Eager Trufflesnout',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Boar',
  pt: [4, 2],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onCombatDamageToPlayer',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Food', manaCost: '0', types: ['Artifact', 'Food'], basePower: 0, baseToughness: 0 },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
