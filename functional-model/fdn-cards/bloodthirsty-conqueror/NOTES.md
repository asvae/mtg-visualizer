# Bloodthirsty Conqueror — authoring notes

## Authoring background

Real Forge: `Mode$ LifeLost | ValidPlayer$ Opponent` — "Whenever an
opponent loses life, you gain that much life." No `on` value exists for
a life-loss event; kept as a name-only trigger (same convention every
other not-yet-auto-fired trigger in this pool already uses). `X` ("that
much life") is a real per-trigger fixed fact supplied via
`EffectContext.triggerInput`, the same convention Kain, Traitorous
Dragoon's own "that much damage" already establishes.
