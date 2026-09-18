# Soul-Shackled Zombie — authoring notes

## Authoring background

The "single graveyard" restriction (all chosen cards must share one
owner) isn't representable (accepted simplification); the conditional
life-swing genuinely depends on what the SAME effect just exiled, which
no declarative `move`+later-`Computed` chaining can read back — real,
non-empty `custom`, using the real `Player.loseLife`/`gainLife` methods
directly (not a placeholder).
