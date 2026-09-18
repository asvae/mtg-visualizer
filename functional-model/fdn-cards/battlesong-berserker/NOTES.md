# Battlesong Berserker — authoring notes

## Authoring background

Real Forge (battlesong_berserker.txt): `Mode$ AttackersDeclared |
AttackingPlayer$ You` — "Whenever YOU attack" (fires once per combat when
the controller declares any attacker(s)), genuinely broader than
`Trigger.on: 'attacks'` (which only ever fires for THIS card's own
self-attack, `ValidCard$ Card.Self`). No auto-fire `on` value covers
"whenever you attack" — kept as a name-only trigger, same "manually
invoked by a scenario" convention every other not-yet-auto-fired trigger
in this pool already uses (Namazu Trader's own onAttack, e.g.).
