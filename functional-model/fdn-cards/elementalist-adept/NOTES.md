# Elementalist Adept — authoring notes

## Authoring background

Real K:Flash, K:Prowess. `'Prowess'` is now a real `Keyword` union member
(2026-09-18, schema-completeness pass) — the base "this creature has
Prowess" structural fact is tracked via `keywords`. Still
recognized-but-inert: its own auto-fire half ("whenever you cast a
noncreature spell, this creature gets +1/+1 until end of turn") needs a
real `Trigger.on:'castNoncreatureSpell'` auto-fire dispatch that exists
nowhere in this engine for ANY card, granted or native — ENGINE_GAPS.md's
own "trigger-doubling ('Panharmonicon effect')" writeup already tracks
this bigger, still wholly-unbuilt trigger family directly (17+ real FIN
cards share it) — not a new, separate gap of its own (see
`engine-support-registry.ts`'s own `prowess-not-enforced` entry).
