# Banishing Light — authoring notes

## Authoring background

Real Forge (banishing_light.txt): `SVar:TrigExile:DB$ ChangeZone | ... |
Duration$ UntilHostLeavesPlay` — the immediate exile is real,
expressible via `kind:'move'`; the "until this leaves the battlefield"
LINKED return duration (CR 603.6e) is a genuinely different mechanic from
`untilEndOfTurn` (a fixed 514.2 Cleanup expiry) — no primitive ties a
zone change's own duration to a SEPARATE permanent's own future
departure from the battlefield.
