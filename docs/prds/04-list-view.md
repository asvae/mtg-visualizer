# PRD 04 — List view

Status: **confirmed** (2026-09-13) — functional parity with the graph view
is the explicit intent: everything the graph does (scope/filter/deck
add-remove, search, card navigation) works identically in the list, minus
whatever is inherently graph-only (edges/relationship visualization,
node-based layout). Not a stripped-down companion view — a first-class
alternate rendering of the same interactions.

## Problem

The force-directed graph is a poor surface for the mechanics of actual
deck construction: precise add/remove, scanning many cards at once,
comparing entries side by side. A named request from the planning
conversation: "a somewhat special page (think same selection as
visualizer), where we'll show a full list of in-scope cards + current
deck."

## Goals

A second view mode, sharing the exact same Scope/Filter/Deck state as
the graph (PRD 01's model), rendered as a sortable/filterable table
instead of nodes — functional parity with the graph view for everything
that isn't inherently edge/layout-based:

- Columns at minimum: name, mana cost/colors, type, current deck
  quantity, an add/remove-from-deck control per row, and an
  add/remove-from-scope control per row (parity with PRD 01's per-card
  scope editing).
- Search (PRD 03's find & discover) works identically from the list view
  — same dropdown, same discover-and-add behavior.
- Card navigation (PRD 02's panel/full page) works identically — clicking
  a row opens the same panel/page a graph node click would.
- A view-mode toggle (Graph / List) alongside existing header controls.
- Sortable by at least name and mana value; filterable by the same
  facets the graph already exposes (colors/rarities/types/themes).

## Non-goals

- This PRD does not add new filter facets or change filter semantics —
  it's a second renderer over the same filtered/scoped data, not a
  filter redesign.
- Column customization/configurability — a fixed, sensible column set is
  enough for v1.

## Acceptance criteria

- Done when switching Graph ↔ List preserves Scope/Filter/Deck state
  exactly — the same cards are visible under the same active filters in
  both views.
- Done when a deck quantity can be changed directly from a list row,
  without navigating to the card page or panel.
- Done when the list is sortable by name and mana value, and filterable
  by every facet the graph currently exposes.
