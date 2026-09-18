# Felling Blow — authoring notes

## Authoring background

"Put a +1/+1 counter on target creature you control. Then that creature
deals damage equal to its power to target creature an opponent
controls." — the damage amount depends on the FIRST target's own live
power AFTER the counter is applied, a cross-effect reference no plain
declarative `Effect` field can express (no `Computed` has access to a
prior effect's own chosen target). Real, narrowly-scoped `custom`
closure instead — genuinely functional, not a placeholder (mirrors
`celestial-armor`'s own real Equip-attach closure).
