// One slug scheme for keywords/[[slug]].vue, shared by both directions —
// generating a sidebar entry's own link AND resolving an incoming route
// param back to a registry entry always run the SAME function over the
// SAME `entry.title` field, so there's no separate "reverse" parser to keep
// in sync (matching an incoming slug against every entry's own freshly
// slugified title, not attempting to reconstruct a title from a slug).
// `&` gets its own explicit " and " expansion before the generic
// non-alphanumeric collapse below — e.g. "Flying & Reach" -> "flying-and-
// reach", not "flying-reach" (that leaves out a whole word, worse for a
// human reading the URL) — every other punctuation (apostrophes in
// "Council's dilemma", exclamation marks in "For Mirrodin!", existing
// hyphens in "Jump-start", ...) just collapses to a single `-` like any
// other run of non-alphanumeric characters. Verified against the full
// registry (369 entries as of 2026-09-09): zero slug collisions.
export function slugifyKeywordTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
