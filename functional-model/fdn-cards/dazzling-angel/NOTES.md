# Dazzling Angel — authoring notes

## Authoring background

"Whenever another creature you control enters, you gain 1 life." Trigger
condition "whenever ANOTHER creature you control enters" requires an
unbuilt trigger variant (no `on` value supports firing for other cards
matching a subtype/condition — see ENGINE_GAPS.md). Modeled as a named
trigger for manual scenario invocation until that gap closes.

(Flagged during the 2026-09-18 comment-cleanup sweep: this comment
predates the `Trigger.on:'otherPermanentEnters'`/
`otherPermanentEntersMatch` vocabulary added the same pass elsewhere in
this pool — see arahbo-the-first-fang/skyknight-squire. This card was not
migrated to it; worth checking whether it should be, out of scope for a
comment-relocation-only sweep.)
