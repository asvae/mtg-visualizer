import type { CardDefinition, Effect } from '../../card';

// Real Forge (tragic_banshee.txt): `SVar:X:Count$Morbid.13.1` — Morbid ("if
// a creature died this turn") is a real, live board-state condition with
// NO tracking mechanism anywhere in this engine (grepped functional-model/
// for "morbid": zero hits before this card; no `EffectContext` field like
// `firstPhaseGroupOccurrenceThisTurn` exists for "did a creature die this
// turn" either). GENUINE CAPACITY GAP, not a wrong-vocabulary mistake —
// reclassified from the cheap tier's invented `hasMorbid` placeholder
// boolean to a real, documented no-op. "Morbid" also isn't a `K:` line in
// the real script (it's prose naming the trigger's own condition), so it
// doesn't belong in `keywords` either.
export const tragicBanshee: CardDefinition = {
  name: 'Tragic Banshee',
  manaCost: '{4}{B}',
  typeLine: 'Creature — Spirit',
  pt: [5, 3],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe:
            'Morbid — target creature an opponent controls gets -1/-1 until end of turn. If a creature died this turn, that creature gets -13/-13 until end of turn instead. (no "did a creature die this turn"/Morbid tracking exists anywhere in this engine)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
