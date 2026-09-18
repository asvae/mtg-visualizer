# Strongbox Raider — authoring notes

## Authoring background

Real Forge (strongbox_raider.txt): Raid ETB (`Trigger.on:'enter'` +
`condition:{kind:'attackedThisTurn'}`, now real vocabulary) that exiles
the top two library cards (real, expressible via `kind:'move'`) — the
real gap is what happens next: `SVar:DBChoose:DB$ ChooseCard | ... |
SubAbility$ DBEffect` / `SVar:DBEffect:DB$ Effect | ... | StaticAbilities$
Play | Duration$ UntilTheEndOfYourNextTurn` — a genuine standing MayPlay
permission on ONE chosen exiled card, lasting until the end of your NEXT
turn. No such "you may play this specific card later" deferred-permission
primitive exists anywhere in this engine (`interfaces.ts`'s own `play()`
is tied specifically to `EffectContext.topLibraryCard`, not a general
MayPlay grant — same real gap `zul-ashur-lich-lord`'s own castFromGraveyard
ability already documents).
