import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const battleMenu: CardDefinition = {
  name: 'Battle Menu',
  manaCost: '{1}{W}',
  typeLine: 'Instant',

  // Real multi-line modal ("Choose one —" plus 4 bullet modes) — see this
  // card's own `definition-annotations.json`, keyed `"effects"` for the
  // modal header and `"effects[0].modes[N]"` per mode.
  effects: [
    {
      kind: 'modal',
      modes: [
        {
          // Mechanization pass (2026-09-14): this mode's own
          // `entersBattlefield` SOURCE fact (subject: the Knight token)
          // stays hand-authored — see `aerith-rescue-mission`'s own
          // definition.ts comment for the full whole-pool "token creation"
          // finding (34 real `kind:'createToken'` effects, genuine real
          // printed-word order/presence variance a general recognizer can't
          // yet safely cover) — not repeated here.
          describe: 'Attack — create a 2/2 white Knight creature token',
          effects: [{ kind: 'createToken', token: TOKENS.w_2_2_knight, amount: 1 } satisfies Effect],
        },
        {
          // Real `SVar:DBAbility:DB$ Pump | ValidTgts$ Creature | NumDef$ +4`
          // (`res/cardsfolder/b/battle_menu.txt`'s own "Target creature gets
          // +0/+4 until end of turn") — `untilEndOfTurn: true` (2026-09-14)
          // closes the real gap this used to have: a bare `pumpTarget` was a
          // PERMANENT `layers.add` entry with no expiry at all, even though
          // the printed text says otherwise (`state.ts`'s own `pump`/
          // `clearUntilEndOfTurnPumps` doc comments). See `scenarios.ts` for
          // a real engine-piloted demonstration spanning a full Cleanup.
          //
          // Mechanization pass (2026-09-14): this mode's own `event:'pump'`
          // SOURCE fact, and its paired "wants a target creature present"
          // SINK, both stay hand-authored — see `ambrosia-whiteheart`'s own
          // definition.ts comment for the full whole-pool "fixed pump"
          // finding (genuine, confirmed real English template variance
          // across `pumpSelf`/`pumpTarget`/`pumpAll` — not attempted here).
          describe: 'Ability — target creature gets +0/+4 until end of turn',
          effects: [{ kind: 'pumpTarget', power: 0, toughness: 4, untilEndOfTurn: true } satisfies Effect],
        },
        {
          describe: 'Magic — destroy target creature with power 4 or greater',
          effects: [{ kind: 'destroy', validType: 'creature', qty: 1, minPower: 4 } satisfies Effect],
        },
        {
          describe: 'Item — you gain 4 life',
          effects: [{ kind: 'gainLife', amount: 4 } satisfies Effect],
        },
      ],
    } satisfies Effect,
  ],
};
