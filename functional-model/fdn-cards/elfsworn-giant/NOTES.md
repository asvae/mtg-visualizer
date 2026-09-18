# Elfsworn Giant — authoring notes

## Authoring background

Real Forge (elfsworn_giant.txt): `T:Mode$ ChangesZone | ValidCard$
Land.YouCtrl | Execute$ TrigToken` — Landfall. Kept as a bare name-only
trigger, not `on:'otherPermanentEnters'`: that shape's own
`otherPermanentEntersMatch` only supports a creature SUBTYPE filter, no
general "must be a Land" type filter (land types like Forest/Island are a
different vocabulary this field was never built to read).
