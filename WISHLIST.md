# App wishlist

Personal thoughts about possible directions for the app. This is not a
roadmap, specification, implementation guide, or commitment to build these
features.

## 1. Support all of Magic

Support all Magic: The Gathering sets and card types represented in the
available card data, including Un-sets, Planechase planes, Archenemy schemes,
and other supplemental or unusual products.

## 2. Deckbuilding mode

- Import decks from all popular sources.
- Understand and display format information.
- Provide helpful error messages when an import is invalid or incomplete.
- Analyze whether a deck can actually convert its game plan into a win.
- Provide broader deck analysis with useful scoring.
- Suggest cards or changes to the deck.

## 3. Opposition analysis

Analyze which opposing synergies a card or deck counters, disrupts, or shuts
down.

## 4. Direct-link visualization mode

Offer an alternative to the current card-to-theme visualization: connect a
selected card directly to related cards, with an explanation of the link.

Consider reserving visual segments, lanes, or other regions for specific
relation types so the graph remains clear when several kinds of connections
are visible at once.

## 5. Descriptive, directional relations

Describe direct card-to-card relations in plain language from the perspective
of Card A as affected or supported by Card B. For example:

- **Gets +1/+1 when B is cast:** casting Card B gives Card A +1/+1.
- **Can produce mana to cast:** Card B can produce mana that helps cast Card
  A.

These relations should support directionality because Card B helping Card A
does not necessarily mean that Card A helps Card B. Their strength could also
be balanced or weighted against the cards' costs.

This may also help explain combos. A graph could expose circular chains where
cards repeatedly enable, trigger, or benefit one another, making combo loops
and their individual steps easier to observe.

## 6. Contextual card-value analysis

Analyze a card's general value according to what the user needs, such as:

- Constructed formats
- Limited
- Commander
- Other relevant formats or contexts

## 7. Prices and marketplaces

Potentially show prices and marketplace links. It is not yet clear whether
this is generally useful enough to prioritize.

## 8. Landing page and navigation

Create a polished, SEO-friendly landing page with clear navigation through
the app's different modes and features.

## 9. Promotion and education

Advertise the app and make a learning video demonstrating how it helps people
understand cards, themes, and decks.

One possible visual concept: magnetic stickers and physical cards being
placed on a whiteboard to mirror the visualizer's relationship graph.

## 10. Persistence and accounts

Maybe add persistence and user accounts eventually, but not in the near
term.

## 11. Extensions and integrations

- Create extensions for Draftsim and Moxfield.
- Connect to MTG Arena, potentially through an overlay.

## 12. Dedicated pages

- **Archetype page**
- **Card page:** for every interaction type, show all matching cards sorted by
  weight.
- **Theme page:** similarly show all matching cards sorted by weight.

## 13. More precisely defined weights

Define weights relative to all sets by analyzing every card that does the
same thing and placing the cards on a best-to-worst scale. The best card would
receive a weight of 10 and the worst a weight of 0.1.

Prefer rounded values. Use decimals only when they represent a meaningful
difference; avoid implying precision for very small differences.

## 14. Separate self-effects from effects on other cards

Distinguish what a card does to itself from what it does to or for other
cards. Use that distinction to provide a clearer, directional explanation of
exactly how one card connects to another, including which card causes the
interaction, which card is affected, and under what conditions it occurs.

## 15. Comprehensive-rules coverage and relation audit

Check the theme and relation model against the official Magic Comprehensive
Rules. Confirm that themes and relations are defined consistently and account
for unusual mechanics, rules-driven actions, state-based actions, replacement
effects, and other edge cases.

For example, represent interactions that return or otherwise save a Saga or
planeswalker when the game rules would cause it to be sacrificed or put into
its owner's graveyard. The explanation should identify the precise event and
timing involved rather than reducing every such interaction to generic
recursion or protection.

## 16. Performance limits and capacity testing

Profile and benchmark the application to understand its practical limits,
including how many cards and relationships can be displayed at once while the
interface remains responsive. Measure client-side rendering, memory use, and
interaction latency separately from server-side processing, memory, network,
and data-transfer load.

Test representative low-, medium-, and high-density views to identify
bottlenecks, establish useful performance budgets, and determine when the app
should paginate, virtualize, aggregate, progressively load, or limit results.

## 17. Card-text highlights for themes and relations

When the user hovers over or focuses a theme or relation, highlight the exact
rules text on the associated card that supports that classification or
connection. If several parts of the text contribute, highlight each relevant
part while keeping unrelated text visually distinct.

The same mapping should work in reverse where useful: hovering highlighted
card text could emphasize its corresponding themes and relations. Provide an
accessible non-hover interaction for touch and keyboard users.
