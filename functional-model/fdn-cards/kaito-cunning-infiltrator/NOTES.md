# Kaito, Cunning Infiltrator — authoring notes

## Authoring background

Real Forge (kaito_cunning_infiltrator.txt): a real Planeswalker with a
native triggered ability plus three loyalty abilities (+1/-2/-9). No
Planeswalker loyalty-ability cost/activation vocabulary exists anywhere
in this engine (`CardDefinition.abilities[].cost` is mana/{T}-cost text
only, `mana.ts`) and no emblem mechanic (CR 701.42 — a persistent,
ownerless game object with its own triggered ability) exists either —
grepped the whole pool, confirmed zero hits for either. GENUINE CAPACITY
GAP for the -9 ultimate specifically; everything else below is real,
executable vocabulary, kept real rather than folded into one big
placeholder (same "mostly real, one documented no-op" shape curator-of-
destinies/divine-resilience already establish).

Real Forge: `Mode$ DamageDone | CombatDamage$ True | ValidSource$
Creature.YouCtrl | ValidTarget$ Player` — "Whenever a creature you
control deals combat damage to a player, put a loyalty counter on
Kaito." No `on` value exists for a combat-damage-to-player event; kept
as a name-only trigger (same convention every other not-yet-auto-fired
trigger in this pool already uses). The loyalty counter itself is a
real, mechanically tracked `putCounter` (not a placeholder — `state.ts`'s
own persistent per-card counter map is generic to any counterType
string).

Real Forge loyalty-ability costs (`Cost$ AddCounter<1/LOYALTY>` /
`SubCounter<2/LOYALTY>` / `SubCounter<9/LOYALTY>`) — no loyalty-cost
parsing exists anywhere in this engine; kept as descriptive text only
(`abilities[].cost` is a plain, unparsed string — same "not every
free-text constraint is mechanically enforced" convention
gogo-master-of-mimicry's own `{X}{X}, {T}` cost already establishes),
named abilities a scenario can invoke directly rather than a real
loyalty-gated activation.

Real Forge: `Triggers$ CastTrig | ... SpellDescription$ You get an
emblem with "Whenever a player casts a spell, you create a 2/1 blue
Ninja creature token."` GENUINE CAPACITY GAP: no emblem mechanic exists
anywhere in this engine. Documented no-op placeholder, not folded into
anything else.
