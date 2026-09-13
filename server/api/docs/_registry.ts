// Explicit allow-list of this repo's own markdown docs the dev-only
// `/docs` page (app/pages/docs/[[slug]].vue) may read — every top-level
// `*.md` in the repo root (except CHANGELOG.md, left out as low-value for
// an in-browser reading tool — a changelog is skimmed in git log, not
// navigated doc-style), everything under `docs/prds/`, and
// `functional-model/*.md`. Deliberately NOT a generic "serve any file"
// endpoint — `index.get.ts`/`[slug].get.ts` only ever resolve a request
// against one of the `relPath`s listed here, never an arbitrary path off
// the request.
export interface DocEntry {
  slug: string;
  title: string;
  group: string;
  /** Repo-root-relative path — resolved against `process.cwd()` only. */
  relPath: string;
}

export const DOC_REGISTRY: DocEntry[] = [
  { slug: 'readme', title: 'README', group: 'Project', relPath: 'README.md' },
  { slug: 'next-steps', title: 'Next Steps', group: 'Project', relPath: 'NEXT_STEPS.md' },
  { slug: 'wishlist', title: 'Wishlist', group: 'Project', relPath: 'WISHLIST.md' },
  { slug: 'set-status', title: 'Set Status', group: 'Project', relPath: 'SET_STATUS.md' },

  { slug: 'prd-readme', title: 'Overview', group: 'Deck-builder PRDs', relPath: 'docs/prds/README.md' },
  { slug: 'prd-01', title: '01 — Core Concepts', group: 'Deck-builder PRDs', relPath: 'docs/prds/01-core-concepts.md' },
  { slug: 'prd-02', title: '02 — Navigation', group: 'Deck-builder PRDs', relPath: 'docs/prds/02-navigation.md' },
  { slug: 'prd-03', title: '03 — Search', group: 'Deck-builder PRDs', relPath: 'docs/prds/03-search.md' },
  { slug: 'prd-04', title: '04 — List View', group: 'Deck-builder PRDs', relPath: 'docs/prds/04-list-view.md' },
  { slug: 'prd-05', title: '05 — Persistence & Accounts', group: 'Deck-builder PRDs', relPath: 'docs/prds/05-persistence-accounts.md' },

  { slug: 'prd-graph-edge-aggregation', title: 'Graph Edge Aggregation', group: 'Graph PRDs', relPath: 'docs/prds/graph-edge-aggregation.md' },

  { slug: 'fm-readme', title: 'README', group: 'Functional Model', relPath: 'functional-model/README.md' },
  { slug: 'engine-design', title: 'Engine Design', group: 'Functional Model', relPath: 'functional-model/ENGINE_DESIGN.md' },
  { slug: 'engine-gaps', title: 'Engine Gaps', group: 'Functional Model', relPath: 'functional-model/ENGINE_GAPS.md' },
  { slug: 'synergy-design', title: 'Synergy Design', group: 'Functional Model', relPath: 'functional-model/SYNERGY_DESIGN.md' },
  { slug: 'automated-authoring-prd', title: 'Automated Authoring PRD', group: 'Functional Model', relPath: 'functional-model/PRD_AUTOMATED_AUTHORING.md' },
];
