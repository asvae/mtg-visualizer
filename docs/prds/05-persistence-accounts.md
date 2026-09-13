# PRD 05 — Persistence & accounts

Status: draft. **Phase 2 (accounts) is planning-only — researched, not
greenlit for implementation.**

## Problem

All state today is URL query string + `localStorage`, per browser, with
no way to save/name/switch between multiple scope+filter+deck
combinations ("projects"), and no access from a different device. The
user also flagged the current URL-as-state approach as impractical for
this ("the link looks like shit") once real project state (a whole
deck, not just filter toggles) needs representing.

## Goals

### Phase 1 — local-first, structurally ready for Phase 2

- Introduce a **Project**: `{ scope definition, filter defaults, deck }`
  (PRD 01's Deck shape).
- Build this behind a small abstracted store interface (load/save/list
  project by id) with a `localStorage`/IndexedDB-backed implementation
  now. The interface is the only thing Phase 2 should need to touch.
- A project switcher UI (create/rename/delete/switch).
- Projects addressed by a short id in the URL (`?project=<id>`), not a
  full state dump — the actual project contents live in local storage
  keyed by that id, not in the query string.

### Phase 2 — accounts (not yet greenlit)

Per the `server` specialist's research (2026-09-13):

- **Default recommendation: Supabase (Postgres + Auth + Row Level
  Security)**, not Netlify Blobs — the deciding factor is per-user
  access: RLS enforces "only your own projects" at the database layer
  tied to Supabase's own Auth, rather than hand-rolled checks in every
  API route. Netlify Blobs is a legitimate fallback only if accounts get
  deferred further and a redeploy-durable store is wanted in the
  meantime (its default site-scoped store, not the deploy-scoped
  variant, does survive redeploys).
- Shape: a `projects` table (`id`, `user_id` FK → `auth.users`, `name`,
  `scope_definition jsonb`, `filter_defaults jsonb`, `decklist jsonb`,
  `visibility` ('public' | 'private', default 'private'), timestamps).
  RLS: SELECT allowed when `visibility = 'public' OR user_id = auth.uid()`;
  INSERT/UPDATE/DELETE always restricted to `user_id = auth.uid()` —
  a public project is readable by anyone with its link, never editable by
  anyone but its owner. Nitro API routes via `@supabase/supabase-js` or
  the `@nuxtjs/supabase` module (handles session cookies directly in
  Nuxt).
- **Public/private is a per-project toggle, not user-to-user sharing**
  (confirmed 2026-09-13): no specific-recipient sharing/collaboration for
  now (see Non-goals), just a visibility flag — a public project is
  viewable via its link by anyone, a private one only by its owner. This
  only means anything once Phase 2 exists (Phase 1's local-only projects
  have no other viewer to be public *to* — they're implicitly private).
- **Ballpark: 2-4 focused days** for this persistence slice alone
  (~0.5 day schema+RLS, ~1 day auth wiring, ~1-1.5 days CRUD routes +
  minimal UI, ~0.5 day polish) — additive to whatever the broader
  deck-builder UI work costs separately.
- **Known caveat:** Supabase's (and Neon's) free tier auto-pauses after
  ~1 week of inactivity; first request after a quiet stretch is slow or
  can fail until it wakes. Not a blocker for hobby-scale usage, just a
  known rough edge.

## Non-goals

- Sharing a project with another *specific* user (collaboration,
  per-user permissions, invite flows) — explicitly not wanted for now
  (confirmed 2026-09-13). Public/private (above) is the only visibility
  control; flag direct sharing as a future ask if it comes up, don't
  build toward it speculatively.
- **Payment/subscription of any kind — permanent hard no, not just
  undiscussed** (confirmed 2026-09-13). This is a fan project built on
  Wizards of the Coast IP; gating anything behind a paywall/subscription
  is inappropriate for that. Any future monetization (e.g. donations)
  stays entirely external to the app — never built in.

## Acceptance criteria

**Phase 1:**
- Done when multiple named projects can be created, switched between,
  and persist across browser restarts on the same device.
- Done when a project is addressed by a short id in the URL rather than
  a full state dump.
- Done when the store interface is the only integration point Phase 2
  needs to touch — verified by there being no UI-visible difference
  between "backed by localStorage" and a hypothetical swapped-in backend
  during Phase 1 development.

**Phase 2 (once greenlit):**
- Done when a user can sign in (magic link or email/password) and see
  the same projects from a different device/browser.
- Done when Row Level Security actually prevents seeing another user's
  *private* projects, verified by a direct API call attempt, not just
  absence of a UI path to it.
- Done when a project marked public is readable (not writable) by a
  signed-in user who isn't its owner — verified the same way, by direct
  API call, not just UI absence.
