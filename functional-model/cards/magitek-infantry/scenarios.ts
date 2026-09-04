import type { Scenario } from '../../harness';

// harness.ts's `setupPlayer` has no PlayerState field to seed a library
// card with a SPECIFIC name (every generated library card is named
// `<player>-library-<i>`, never "Magitek Infantry") — so the "found a
// second copy" branch of this card's own tutor ability can't be exercised
// with today's harness fields. Both scenarios below exercise the real,
// common case instead (no second copy in library — the effect's own name
// filter correctly finds nothing and no-ops) plus the static ability's own
// presence-gate board state.
export const scenarios: Scenario[] = [
  { result: 'no second copy found in library, no-op', you: { libraryCount: 3 } },
  { result: 'empty library, no-op', you: { libraryCount: 0 } },
];
