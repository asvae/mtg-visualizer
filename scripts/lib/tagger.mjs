// Core tagging pipeline: given ONE raw Scryfall card object, produces its theme
// edges (role/weight/modifiers) — regex-based theme detection, then that card's
// EXCEPTIONS overrides, then the "No Theme" fallback if nothing else matched.
//
// This is the single function scripts/review-tests/*.test.mjs snapshot against:
// each reviewed card gets a test asserting tagCard(rawCard) still returns exactly
// the edges confirmed correct during review, so a THEMES/EXCEPTIONS change that
// silently changes a previously-reviewed card's tagging fails a test instead of
// only showing up as a graph diff nobody reads closely.
//
// v1 heuristic tagger. Patterns are intentionally simple (regex over oracle_text).
// Expect noise -> that's what the "atypical" role and the graph review pass are for.
// Refine THEMES below after looking at the rendered graph, then re-run npm run tag.

import { EXCEPTIONS } from '../exceptions.mjs';

// Theme-agnostic signals for edge-weight (theme-centrality) scoring — deliberately
// generic so 21 themes don't need 21 bespoke weight patterns each. REPEAT_TRIGGER is
// also reused by tag-cards.mjs for the card-level power score.
export const REPEAT_TRIGGER = /\bwhenever\b|\bat the beginning of\b/i;
const SCALING_LANGUAGE = /\bfor each\b|\bequal to the number of\b|\bx is equal to\b|\bmultiplied by\b/i;

// Theme-agnostic modifier signals — orthogonal to role (produce/consume/both/
// atypical). Detected the same way as the weight signals above: scoped to the
// lines that actually matched the theme, not the whole card's text.
const CONDITIONAL = /\bif you control\b|\bas long as\b|\bonly if\b/i;
const MAGNIFIER = /twice (that|as)|double the|additional \+1\/\+1 counter|gets twice/i;

// Reused by tag-cards.mjs for the card-level power score, so exported here rather
// than duplicated.
export const REMOVAL = /destroy target|exile target|deals? \d+ damage to (target|any target)|counter target spell|-\d+\/-\d+ until end of turn|return target .{0,20} to (its owner's|their owner's) hand/i;

// Each theme: mention (broad detector), produce, consume (specific roles).
// self: { match, role } — if match hits, the card counts as that role (produce,
// consume, or both) regardless of the produce/consume regexes. Use 'both' only for
// mechanics the card genuinely both generates AND reads back (e.g. a Saga adding
// then reading its own lore counter). A card that merely IS an instance of a
// resource (a Town land, a Vehicle, an Equipment) only produces it — it doesn't
// consume anything just by existing. A card that only reacts to an external event
// (Landfall triggering off any land you control entering, not just its own) only
// consumes.
export const THEMES = [
  {
    id: 'job-select',
    label: 'Job Select',
    mention: /Job select|Hero creature token/i,
    self: { match: /Job select/i, role: 'produce' }, // creates + auto-equips a Hero — doesn't read Hero count itself
    // Bare "Hero" matched every card that merely creates one (still just producing),
    // including Job Select's own reminder text — only count genuine payoff language.
    consume: /Heroes? you control|for each Hero|another Hero|whenever a Hero/i,
    produce: /create .{0,40}Hero creature token/i,
  },
  {
    id: 'saga',
    label: 'Saga',
    mention: /\bSaga\b|lore counter/i,
    // Reading its own lore counter each turn is just how the mechanic works
    // structurally — same as Transform/Towns/Vehicles, not genuine consumption of
    // an external resource. Checked the actual data: all 24 self-matched Sagas were
    // ALSO the only 24 cards ever getting 'consume' — zero cards matched the
    // external consume regex below on its own. Almost nothing in the set actually
    // cares "how many Sagas you control" the way Sacrifice cares about creatures
    // dying or Landfall cares about lands entering. Produce-only.
    self: { match: (c) => /\bSaga\b/i.test(c.typeLine || ''), role: 'produce' },
    produce: /put a lore counter|add a lore counter/i,
    consume: /Saga you control|Saga (spell |card )?you|whenever a Saga/i,
  },
  {
    id: 'graveyard',
    label: 'Graveyard',
    mention: /graveyard/i,
    produce: /mill|discard a card|put .{0,20}into (your |target )?(?:owner's |their )?graveyard|whenever .{0,30} dies/i,
    consume: /from (your|a|target)? ?graveyard|graveyard you control|cards? in (your |target )?graveyard/i,
  },
  {
    id: 'counters',
    label: '+1/+1 Counters',
    mention: /\+1\/\+1 counter/i,
    produce: /put (a|an|one or more|x|\d+|two|three|four|five) \+1\/\+1 counters?/i,
    consume: /\+1\/\+1 counters? on (it|that|target)|for each \+1\/\+1 counter|remove .{0,15}\+1\/\+1 counter|proliferate/i,
  },
  {
    id: 'artifacts',
    label: 'Artifacts',
    mention: /\bartifacts?\b/i,
    self: { match: (c) => /Artifact/.test(c.typeLine || ''), role: 'produce' }, // being an artifact contributes to the count, same as Towns/Vehicles
    produce: /create .{0,25}artifact|becomes an artifact/i,
    consume: /for each artifact you control|artifacts you control|whenever .{0,20}artifact.{0,20}enters|artifact spell/i,
  },
  {
    id: 'sacrifice',
    label: 'Sacrifice',
    mention: /sacrifice/i,
    produce: /you may sacrifice .{0,40}:|sacrifice .{0,15}: (add|create|draw|deal|gain|search)/i,
    consume: /as an additional cost.{0,15}sacrifice|sacrifice (a|an|another|target|this)/i,
  },
  {
    id: 'exile',
    label: 'Exile',
    mention: /\bexile\b/i,
    produce: /exile the top|exile target|you may exile|exile a card from/i,
    consume: /cards? you('ve| have) exiled|exile zone|from among (cards |those cards )?exiled|play (the|it) .{0,15}exile/i,
  },
  {
    id: 'equipment',
    label: 'Equipment',
    mention: /Equipment|\bequip(ped)?\b/i,
    // granting its own equip bonus isn't "consuming" the theme; it only exists once
    // attached to a creature, so it's a granter (extends a bonus to another
    // permanent) rather than a direct producer the way a Saga is.
    self: { match: (c) => /Equipment/.test(c.typeLine || ''), role: 'produce', modifiers: ['granter'] },
    // "equipped creature gets/has ..." is boilerplate every Equipment card uses to
    // describe its own bonus — matching on it made nearly all Equipment "consume"
    // regardless of whether they engage with equipment-count/synergy at all.
    consume: /for each Equipment( you control)?|Equipment you control (get|have|has)|another Equipment/i,
  },
  {
    id: 'discard',
    label: 'Discard',
    mention: /discard/i,
    produce: /(each|target) (player|opponent) discards|discards? a card at random/i,
    consume: /whenever you discard|if you('ve| have) discarded|discard a card:/i,
  },
  {
    id: 'lifegain',
    label: 'Lifegain Payoff',
    mention: /gain[s]? .{0,15}life|life you('ve| have) gained/i,
    produce: /you gain \d+ life|gain life equal to/i,
    consume: /whenever you gain life|life you('ve| have) gained this/i,
  },
  {
    id: 'spells',
    label: 'Noncreature Spells',
    mention: /noncreature spell/i,
    consume: /whenever you cast a noncreature spell/i,
  },
  {
    id: 'landfall',
    label: 'Landfall',
    mention: /land you control enters|landfall/i,
    self: { match: /landfall/i, role: 'consume' }, // reacts to a land entering — doesn't produce lands itself
    consume: /whenever a land .{0,10}enters/i,
  },
  {
    id: 'flashback',
    label: 'Flashback / Cast from GY',
    mention: /flashback|cast .{0,20}from .{0,10}graveyard/i,
    self: { match: /flashback/i, role: 'both' }, // is its own graveyard-recursion source and beneficiary
    consume: /you may cast .{0,20}from .{0,10}graveyard/i,
  },
  {
    id: 'tiered',
    label: 'Tiered Magic',
    mention: /Tiered/i,
    // Choosing a tier + paying an additional cost doesn't read/consume anything
    // external — same reasoning as the Transform fix. Produce-only.
    self: { match: /Tiered/i, role: 'produce' },
  },
  {
    id: 'treasure',
    label: 'Treasure',
    mention: /Treasure/i,
    produce: /create .{0,15}Treasure/i,
    consume: /sacrifice .{0,15}Treasure|Treasure you control/i,
  },
  {
    id: 'mill',
    label: 'Mill',
    mention: /\bmill(s|ed|ing)?\b/i,
    produce: /mills? (a card|\d+|X|target)|puts? the top .{0,20}into .{0,10}graveyard/i,
    consume: /cards? milled|whenever .{0,15}mills?/i,
  },
  {
    // Ability/mechanic: this card transforms in response to some triggered
    // condition (combat damage, an activated ability, a graveyard threshold...).
    // Separate from the "double-faced" theme below — that one is the structural
    // fact of having two faces, which on this set happens to be the exact same
    // 27 cards, but they're different claims (a future set could have transform
    // triggers with no DFC, or DFCs — modal, meld — that never mention "transform").
    id: 'transform',
    label: 'Transform',
    mention: /transform/i,
    // Unlike Saga (reads its own lore counter every turn), transforming doesn't
    // read/consume anything — it's triggered by an external condition (combat,
    // an activated ability, a spell) and just becomes a new form. Produce-only.
    self: { match: /transform/i, role: 'produce' },
  },
  {
    // Structural: physically a two-faced card (Scryfall layout 'transform'),
    // independent of whatever its ability text says. Being a DFC alone doesn't
    // read/consume anything, so produce-only, same reasoning as Towns/Vehicles.
    id: 'double-faced',
    label: 'Double-Faced Cards',
    mention: /(?!)/, // never matches text — this theme is purely structural, no scope to scan for modifiers
    self: { match: (c) => c.layout === 'transform', role: 'produce' },
  },
  {
    id: 'towns',
    label: 'Towns',
    mention: /\bTowns?\b/i,
    self: { match: (c) => /Town/.test(c.typeLine || ''), role: 'produce' }, // just being a Town contributes to the count, doesn't read it
    produce: /search .{0,40}library for .{0,30}Town|Town cards? with different names/i,
    consume: /Affinity for Towns|Towns you control|control (two|three|four|five) or more Towns/i,
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    mention: /\bVehicles?\b/i,
    self: { match: (c) => /Vehicle/.test(c.typeLine || ''), role: 'produce' }, // same as Towns — just being one isn't consuming
    // Tutoring one into hand/battlefield is genuinely producing a Vehicle, same
    // reasoning as Towns' equivalent search line (e.g. From Father to Son: "Search
    // your library for a Vehicle card... put it into your hand" / onto the
    // battlefield via flashback) — was falling through to 'atypical' with no
    // produce regex to match.
    produce: /search .{0,40}library for .{0,30}Vehicle/i,
    consume: /Vehicles you control|crewed by/i,
  },
  {
    id: 'board-count',
    label: 'Board-Count Payoffs',
    mention: /for each creature you control|number of creatures you control/i,
    consume: /for each creature you control|number of creatures you control/i,
  },
  {
    id: 'lands-count',
    label: 'Lands-Count / Ramp',
    mention: /seven or more lands|number of lands you control|additional land|search .{0,30}library for .{0,20}(a |two )?(basic )?land/i,
    produce: /search .{0,30}library for .{0,20}(a |two )?(basic )?land card|you may play an additional land/i,
    consume: /seven or more lands|number of lands you control|for each land you control/i,
  },
  {
    id: 'removal',
    label: 'Removal',
    // Reuses the same signal already used for the card power score — destroying,
    // exiling, burning, or bouncing an opponent's stuff. No consume side for v1:
    // removal is something a card DOES, not a resource this set's cards read back.
    // If a genuine payoff shows up during review (e.g. "whenever a creature an
    // opponent controls dies"), add it then rather than inventing one now.
    mention: REMOVAL,
    produce: REMOVAL,
  },
];
// Note: "grants a keyword/ability to another permanent" is NOT its own theme here —
// it's a relation TYPE (the 'granter' modifier), the same way produce/consume/both
// are relation types, not subject-matter themes. It only shows up when it applies to
// an actual theme in this list (Equipment's self-match already carries it, since an
// Equipment's bonus only exists once attached to a creature). A card whose only
// ability is granting an evergreen keyword with no other thematic hook (a bare
// anthem effect) simply gets no edge here, same as any other untracked one-off line.

export function fullText(card) {
  let t = card.oracle_text || '';
  for (const f of card.card_faces || []) t += ' ' + (f.oracle_text || '');
  return t;
}

// Restricts the repeat-trigger/scaling-language check to the line(s) that actually
// matched the theme, so an unrelated "whenever" elsewhere on a multi-ability card
// doesn't inflate that theme's edge weight.
function themeRelevantLines(text, theme) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const regexes = [theme.mention, theme.produce, theme.consume].filter((r) => r instanceof RegExp);
  const matched = lines.filter((l) => regexes.some((r) => r.test(l)));
  // Falling back to the full text here used to be harmless (only the non-self-match
  // weight path read scope, and mention.test(text) being true there guarantees at
  // least one matching line in practice). Now that modifiers also read scope
  // unconditionally, a type-only self-match (Artifact/Town/Vehicle by typeLine, no
  // textual mention at all) would fall back to the WHOLE card text and pick up
  // conditional/magnifier language from a totally unrelated ability. Empty string
  // means "no theme-relevant text to scan" instead.
  return matched.join(' ');
}

function selfMatches(theme, context, text) {
  if (!theme.self) return false;
  return typeof theme.self.match === 'function' ? theme.self.match(context) : theme.self.match.test(text);
}

function regexThemeEdges(card) {
  const text = fullText(card);
  const context = { typeLine: card.type_line || '', layout: card.layout || '' };
  const edges = [];
  for (const theme of THEMES) {
    const isSelfMatch = selfMatches(theme, context, text);
    if (!theme.mention.test(text) && !isSelfMatch) continue;

    const scope = themeRelevantLines(text, theme);

    let produces = theme.produce?.test(text) ?? false;
    let consumes = theme.consume?.test(text) ?? false;
    if (isSelfMatch) {
      if (theme.self.role === 'produce') produces = true;
      else if (theme.self.role === 'consume') consumes = true;
      else if (theme.self.role === 'both') (produces = true), (consumes = true);
    }

    // Modifiers are orthogonal to role — detected from the same theme-relevant
    // scope used for weight. A magnifier match that would otherwise fall through to
    // 'atypical' counts as producing: amplifying a resource is a form of generating
    // more of it (this is exactly what was wrong with The Wind Crystal's lifegain
    // line — "gain twice that much life" matched no produce/consume pattern before).
    const modifiers = [];
    if (isSelfMatch && theme.self.modifiers) modifiers.push(...theme.self.modifiers);
    if (CONDITIONAL.test(scope)) modifiers.push('conditional');
    if (MAGNIFIER.test(scope)) {
      modifiers.push('magnifier');
      if (!produces && !consumes) produces = true;
    }

    // Edge weight (1-3): how central this card is to this specific theme, not just
    // whether it participates. Cards matching the theme's own self-definition max
    // out (it IS the mechanic); everything else scores from repeat-trigger / scaling
    // / mention-density in the lines that actually matched this theme.
    let weight = 1;
    if (isSelfMatch) {
      weight = 3;
    } else {
      if (REPEAT_TRIGGER.test(scope)) weight++;
      const mentionFlags = theme.mention.flags.includes('g') ? theme.mention.flags : theme.mention.flags + 'g';
      const mentionCount = (scope.match(new RegExp(theme.mention.source, mentionFlags)) || []).length;
      if (SCALING_LANGUAGE.test(scope) || mentionCount >= 2) weight++;
      weight = Math.min(weight, 3);
    }

    // Produce and consume are separate relations, not merged into a 'both' role —
    // a card that both produces and consumes a theme gets TWO edges (one of each),
    // so each relation is still a distinct, individually-colored/filterable line
    // rather than a third catch-all category.
    const dedupedModifiers = [...new Set(modifiers)];
    if (produces) edges.push({ card: card.id, theme: theme.id, role: 'produce', weight, modifiers: dedupedModifiers });
    if (consumes) edges.push({ card: card.id, theme: theme.id, role: 'consume', weight, modifiers: dedupedModifiers });
    if (!produces && !consumes) edges.push({ card: card.id, theme: theme.id, role: 'atypical', weight, modifiers: dedupedModifiers });
  }
  return edges;
}

// Exceptions take priority over the regex output: for each entry matching this
// card (by exact name), drop any regex-derived edge for that (card, theme) pair,
// then — unless role is null, which means "suppress this theme for this card" —
// add the exception's edge back.
function applyExceptions(card, edges) {
  const mine = EXCEPTIONS.filter((ex) => ex.card === card.name);
  if (mine.length === 0) return edges;
  const result = [...edges];
  for (const ex of mine) {
    const idx = result.findIndex((e) => e.theme === ex.theme);
    if (idx !== -1) result.splice(idx, 1);
    if (ex.role !== null) {
      result.push({ card: card.id, theme: ex.theme, role: ex.role, weight: ex.weight ?? 3, modifiers: ex.modifiers ?? [] });
    }
  }
  return result;
}

// Full per-card pipeline: regex theme detection -> this card's EXCEPTIONS overrides
// -> "No Theme" fallback if still untagged. `card` is one raw Scryfall card object
// (a data/<set>_cards.json entry) — same shape whether it comes from the real fetched
// set or a hand-written test fixture.
export function tagCard(card) {
  let edges = applyExceptions(card, regexThemeEdges(card));
  if (edges.length === 0) {
    edges = [{ card: card.id, theme: 'no-theme', role: 'atypical', weight: 1, modifiers: [] }];
  }
  return edges;
}
