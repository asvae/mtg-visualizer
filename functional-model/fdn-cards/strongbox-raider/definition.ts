import type { CardDefinition, Effect } from '../../card';

// Real Forge (strongbox_raider.txt): Raid ETB (`Trigger.on:'enter'` +
// `condition:{kind:'attackedThisTurn'}`, now real vocabulary) that exiles
// the top two library cards (real, expressible via `kind:'move'`) — the
// real gap is what happens next: `SVar:DBChoose:DB$ ChooseCard | ... |
// SubAbility$ DBEffect` / `SVar:DBEffect:DB$ Effect | ... | StaticAbilities$
// Play | Duration$ UntilTheEndOfYourNextTurn` — a genuine standing MayPlay
// permission on ONE chosen exiled card, lasting until the end of your NEXT
// turn. No such "you may play this specific card later" deferred-permission
// primitive exists anywhere in this engine (`interfaces.ts`'s own `play()`
// is tied specifically to `EffectContext.topLibraryCard`, not a general
// MayPlay grant — same real gap `zul-ashur-lich-lord`'s own castFromGraveyard
// ability already documents).
export const strongboxRaider: CardDefinition = {
  name: 'Strongbox Raider',
  manaCost: '{2}{R}{R}',
  typeLine: 'Creature — Orc Pirate',
  pt: [5, 2],

  triggers: [
    {
      name: 'onEnterRaid',
      on: 'enter',
      condition: { kind: 'attackedThisTurn' },
      effects: [
        {
          kind: 'move',
          owner: 'you',
          from: 'Library',
          to: 'Exile',
          qty: 2,
        } satisfies Effect,
      ],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: 'Choose one of them. Until the end of your next turn, you may play that card.',
      demand:
        'Needs a general "you may play this specific exiled card until a stated deadline" standing-permission primitive — `interfaces.ts`\'s `play()` only covers the library-top special action, no MayPlay-grant mechanism exists (same gap `zul-ashur-lich-lord`\'s castFromGraveyard ability already names).',
    },
  ],
};
