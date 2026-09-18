# Giada, Font of Hope — authoring notes

## Authoring background

Real Forge (giada_font_of_hope.txt): `K:ETBReplacement:Other:
AddExtraCounter:...:Creature.Angel+YouCtrl+Other` — a CR 614 replacement
on ANOTHER qualifying permanent's own ETB counter count, scaled by a live
board count. `Trigger.on:'otherPermanentEnters'` only fires a NEW trigger
on this card's own controller — it has no way to reach into and modify
the ENTERING permanent's own replacement-effect ETB state (a genuinely
different mechanism, CR 614.12-style, from a reactive trigger). The mana
ability's own `RestrictValid$ Spell.Angel` ("spend this mana only to cast
an Angel spell") is left undeclared (documentary-only, unenforced,
same "no spendable mana pool" limitation every other mana ability`s
restriction already carries — not itself a novel gap).
