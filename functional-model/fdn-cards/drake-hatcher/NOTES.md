# Drake Hatcher — authoring notes

## Authoring background

Real K:Vigilance, K:Prowess. `'Prowess'` is now a real `Keyword` union
member (2026-09-18, schema-completeness pass) — the base "this creature
has Prowess" structural fact is tracked via `keywords`. Still
recognized-but-inert: its own auto-fire half needs a real
`Trigger.on:'castNoncreatureSpell'` auto-fire dispatch that exists nowhere
in this engine for ANY card, granted or native — ENGINE_GAPS.md's own
"trigger-doubling ('Panharmonicon effect')" writeup already tracks this
bigger, still wholly-unbuilt trigger family directly (17+ real FIN cards
share it, same real gap Elementalist Adept's own identical Prowess line
also names — see `engine-support-registry.ts`'s own
`prowess-not-enforced` entry).

Real Forge: `Mode$ DamageDone | ValidSource$ Card.Self | ValidTarget$
Player | CombatDamage$ True`. No `on` value exists for a
combat-damage-to-player event; kept as a name-only trigger. `X` ("that
many") is a real per-trigger fixed fact supplied via
`EffectContext.triggerInput`, same convention bloodthirsty-conqueror's
own "that much life" already uses.

Real Forge: `A:AB$ Token | Cost$ SubCounter<3/INCUBATION>` — a
counter-removal cost, not mana/tap. `activationCost` is a plain, freeform
string (not mechanically parsed/enforced beyond mana/{T} — same "not
every free-text constraint is mechanically enforced" convention
gogo-master-of-mimicry's own `{X}{X}, {T}` cost and `crewCost`'s own doc
comment already establish), so this is real, documented text rather than
a fabricated mana/tap cost.
