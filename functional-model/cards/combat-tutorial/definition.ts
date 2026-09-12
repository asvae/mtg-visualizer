import type { CardDefinition, Effect } from '../../card';

export const combatTutorial: CardDefinition = {
  name: 'Combat Tutorial',
  manaCost: '{2}{U}',
  typeLine: 'Sorcery',

  effects: [
    // Real `ValidTgts$ Player` — any player, not necessarily you.
    // `drawCard` has no target-player field at all (unlike `loseLife`/
    // `discard`'s own `EffectOwner`) — same "no player-target-selection
    // primitive" gap stiltzkin-moogle-merchant's own comment already
    // documents for "target opponent." Simplified to you, the overwhelmingly
    // common real cast (drawing FOR an opponent is a rare, situational line).
    //
    // The synergy.json `event:'drawCard'` fact this effect backs is
    // authored to the REAL oracle text instead (`targeted:true`, no
    // `controller` restricting it to `'you'`) rather than to this
    // simplified implementation — same "honest fact, documented engine gap"
    // treatment auron-s-inspiration's own definition.ts already uses. Real
    // trace evidence can only ever show the `player:'you'` case (the
    // engine's own hardcoded side of this gap), which is fine: the fact's
    // omitted `controller` still matches that evidence (an unset `controller`
    // is satisfied by any real `side`), it just can't ALSO be verified
    // against a hypothetical `player:'opp'` trace this engine can't produce.
    { kind: 'drawCard', amount: 2 } satisfies Effect,
    // "up to one target creature you control" — TargetMin$0/TargetMax$1,
    // same pool-exhaustion shape Ashe's own optional dig already uses;
    // `putCounterTarget`'s pool spans both players (same established
    // looseness `dealDamageTarget`/`pumpTarget` already carry for "target
    // creature" text elsewhere in this batch), not narrowed to "you control."
    { kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, qty: 1 } satisfies Effect,
  ],
};
