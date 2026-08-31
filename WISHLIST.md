# App wishlist

Personal thoughts about possible directions for the app. This is not a
roadmap, specification, implementation guide, or commitment to build these
features.

## Card and relation model

### Support all of Magic

Support all Magic: The Gathering sets and card types represented in the
available card data, including Un-sets, Planechase planes, Archenemy schemes,
and other supplemental or unusual products.

### Descriptive, directional relations

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

### Separate self-effects from effects on other cards

Distinguish what a card does to itself from what it does to or for other
cards. Use that distinction to provide a clearer, directional explanation of
exactly how one card connects to another, including which card causes the
interaction, which card is affected, and under what conditions it occurs.

### Comprehensive-rules coverage and relation audit

Check the theme and relation model against the official Magic Comprehensive
Rules. Confirm that themes and relations are defined consistently and account
for unusual mechanics, rules-driven actions, state-based actions, replacement
effects, and other edge cases.

For example, represent interactions that return or otherwise save a Saga or
planeswalker when the game rules would cause it to be sacrificed or put into
its owner's graveyard. The explanation should identify the precise event and
timing involved rather than reducing every such interaction to generic
recursion or protection.

### More precisely defined weights

Define weights relative to all sets by analyzing every card that does the
same thing and placing the cards on a best-to-worst scale. The best card would
receive a weight of 10 and the worst a weight of 0.1.

Prefer rounded values. Use decimals only when they represent a meaningful
difference; avoid implying precision for very small differences.

### Computed theme groups

Derive useful theme groups from structured card facts instead of requiring
every membership to be manually tagged. Examples could include card-type and
supertype groupings, noncreature spells, power/toughness bands, colors, mana
values, and other mechanically knowable categories. Preserve the underlying
specific type where useful, such as Battle or planeswalker, rather than
collapsing every noncreature spell into one undifferentiated group.

### Connected theme groups

Model explicit relationships between themes, including cases where one theme
produces, consumes, enables, or benefits another. For example, blink produces
enter-the-battlefield events, which in turn enable ETB payoffs.

This is related to but distinct from computed theme groups: computed groups
derive membership from card data, while connected groups describe semantic or
mechanical edges between themes. A computed group may participate in these
connections, but neither concept replaces the other.

### Power/toughness and color themes

Add first-class themes derived from power and toughness, including exact
values, useful ranges, comparisons, and variable values where appropriate.
Also add color and color-identity themes, covering monocolor, multicolor,
colorless, and relevant combinations without requiring manual tagging.

### Concise card text

Improve the readability of displayed card text by replacing long or repeated
rules phrases with recognized keywords or compact labels where the meaning is
equivalent. Preserve the original Oracle text and make it readily available so
the simplified presentation never hides rules-relevant differences.

## Synergy analysis

### Direct-link visualization mode

Offer an alternative to the current card-to-theme visualization: connect a
selected card directly to related cards, with an explanation of the link.

Consider reserving visual segments, lanes, or other regions for specific
relation types so the graph remains clear when several kinds of connections
are visible at once.

### Negative synergy

Represent anti-synergies within a deck: cards, themes, costs, or restrictions
that interfere with one another or make one another less effective. Explain
the direction and reason for each conflict rather than showing only a generic
negative score.

### Opposition analysis

Analyze which opposing synergies a card or deck counters, disrupts, or shuts
down.

### Enemy synergy

Represent interactions with an opponent's cards and themes, including cases
where an enemy card enables, strengthens, weakens, or otherwise changes the
value of one of the user's cards. Keep this distinct from opposition analysis:
an opponent's strategy can accidentally synergize with the user's plan rather
than merely being countered by it.

### Graph-derived scores

Compute higher-level qualities such as how parasitic, central, isolated,
replaceable, or broadly enabling a card or theme is by analyzing the relation
graph. Define each score in understandable terms, expose the evidence behind
it, and avoid presenting graph heuristics as objective card quality.

## Application experience

### Landing page and navigation

Create a polished, SEO-friendly landing page with clear navigation through
the app's different modes and features.

### Dedicated pages

- **Archetype page**
- **Card page:** for every interaction type, show all matching cards sorted by
  weight.
- **Theme page:** similarly show all matching cards sorted by weight.

### Wishlist and immediate-plans page

Add an application page that presents the longer-term wishlist separately
from the project's immediate, actively planned work. Keep the distinction
clear so exploratory ideas are not mistaken for committed or scheduled
features.

### Card-text highlights for themes and relations

When the user hovers over or focuses a theme or relation, highlight the exact
rules text on the associated card that supports that classification or
connection. If several parts of the text contribute, highlight each relevant
part while keeping unrelated text visually distinct.

The same mapping should work in reverse where useful: hovering highlighted
card text could emphasize its corresponding themes and relations. Provide an
accessible non-hover interaction for touch and keyboard users.

### Favicon and app icons

Create a recognizable favicon that fits the graph visualizer's identity and
remains legible at small sizes. Provide the relevant browser favicon, touch
icon, and web-app manifest variants for consistent display across platforms.

### Used libraries

Add an accessible place in the app that lists the main libraries, tools, and
data sources used by the project, with links and any required license or
attribution information.

## Integrations

### Extensions and integrations

- Create extensions for Draftsim and Moxfield.
- Connect to MTG Arena, potentially through an overlay.
- Integrate with Tabletop Simulator, such as by importing and exporting decks
  or synchronizing a visualized deck with a tabletop session.

## Quality and engineering

### Automated UI and application testing

Build broader Storybook coverage for visual components, unit tests for
isolated behavior and graph logic, and end-to-end tests for important user
flows. Include regression cases for dense graphs, unusual card layouts,
imports, filtering, and relation explanations.

### Performance limits and capacity testing

Profile and benchmark the application to understand its practical limits,
including how many cards and relationships can be displayed at once while the
interface remains responsive. Measure client-side rendering, memory use, and
interaction latency separately from server-side processing, memory, network,
and data-transfer load.

Test representative low-, medium-, and high-density views to identify
bottlenecks, establish useful performance budgets, and determine when the app
should paginate, virtualize, aggregate, progressively load, or limit results.

## Operations and outreach

### Privacy-preserving analytics

Add minimal analytics to understand aggregate feature usage and operational
health without introducing accounts, cookies, behavioral profiles, or storage
of user-submitted card and deck data. Prefer server-side-only measurement,
such as anonymous request and feature-event counts, if it can provide enough
information while keeping the client free of tracking scripts.

Document exactly what is measured, retain it only as long as needed, and keep
analytics optional if the available hosting or tooling cannot meet these
privacy constraints.

### Promotion and education

Advertise the app and make a learning video demonstrating how it helps people
understand cards, themes, and decks.

One possible visual concept: magnetic stickers and physical cards being
placed on a whiteboard to mirror the visualizer's relationship graph.
