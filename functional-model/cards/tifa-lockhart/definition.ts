import type { CardDefinition, Effect, EffectContext } from '../../card';

// Real script (tifa_lockhart.txt): `K:Trample` + a Landfall trigger,
// `DB$ Pump | NumAtt$ Double` — Forge's own "double current power" NumAtt
// shape, not a fixed delta.
export const tifaLockhart: CardDefinition = {
  name: 'Tifa Lockhart',
  manaCost: '{1}{G}',
  typeLine: 'Legendary Creature — Human Monk',

  pt: [1, 2],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onLandfall',
      effects: [
        {
          // `pumpSelf`'s own `power`/`toughness` fields are DELTAS, not
          // multipliers — "double" is modeled as a delta equal to self's
          // own live current power (new = current + delta == current +
          // current == 2x current), the same live-board-state-read shape
          // `Computed` is meant for. Toughness is unaffected (real text
          // only doubles power).
          kind: 'pumpSelf',
          power: (ctx: EffectContext) => ctx.self.getNetPower(),
          toughness: 0,
        } satisfies Effect,
      ],
    },
  ],
};
