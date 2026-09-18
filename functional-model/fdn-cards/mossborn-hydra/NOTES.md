# Mossborn Hydra — authoring notes

## Authoring background

Real Forge (mossborn_hydra.txt): `K:etbCounter:P1P1:1` ("This creature
enters with a +1/+1 counter on it") — modeled as a real `onEnter` trigger
putting the counter, same convention `goblin-boarders` already
establishes (printed base `pt` stays [0,0], the counter is what actually
brings it to 1/1). `SVar:TrigDouble:DB$ MultiplyCounter | Defined$ Self |
CounterType$ P1P1` — real "double the +1/+1 counters" doubling, expressed
honestly via `putCounter{target:'self', amount: (ctx) =>
ctx.self.getCounters('+1/+1')}` (adding a number equal to the current
count IS doubling it — a narrowly-scoped `Computed` closure, not a magic
string). Landfall kept as a bare name-only trigger (see `elfsworn-giant`'s
own comment for why `on:'otherPermanentEnters'` doesn't fit a
Land-typed watch).
