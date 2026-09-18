# Valkyrie's Call — authoring notes

## Authoring background

Trigger: "Whenever a nontoken, non-Angel creature you control dies,
return that card to the battlefield under its owner's control with a
+1/+1 counter on it. It has flying and is an Angel in addition to its
other types."

GAP: Triggers on OTHER creatures (not self) are not yet supported by the
auto-fired trigger system. The `on` field currently only handles
self-targeted triggers like 'enter'. A broader "whenever ANY creature you
control dies" trigger would need engine support for board-wide
creature-death monitoring.

GAP: Returning a creature to the battlefield with a counter AND changing
its type/keywords conditionally is complex. Current vocabulary can handle
the move effect, but not the combined type-change + keyword-grant on the
returned card as one atomic operation.

(Flagged during the 2026-09-18 comment-cleanup sweep: this card's real
gap above is currently only documented as prose, not declared via a real
`missingSchemaFunctionality` entry the way other cards in this pool do —
worth a follow-up authoring pass to migrate it, out of scope for a
comment-relocation-only sweep.)
