# Seeker's Folly — authoring notes

## Authoring background

"Target opponent discards two cards" — approximated to every opponent
(`owner: 'opponents'`), same established single-chosen-opponent
simplification al-bhed-salvagers/combat-tutorial already document (no
single-chosen-opponent Effect shape exists; only matters with 3+
players).

Real Forge: `DB$ PumpAll | ValidCards$ Creature.OppCtrl | NumAtt$ -1 |
NumDef$ -1` — `pumpAll`'s own `predicate` union has no "opponents'
creatures" shape (only 'creatures-you-control'|'attacking-creatures'), so
this needs `custom` — real, executable code (`actions.pump`, not the
nonexistent `actions.pumpTarget`), not a placeholder.
