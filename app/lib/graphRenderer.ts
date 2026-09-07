import * as d3 from 'd3';
import type { CardData, GraphFile, GraphReason } from '../types';
import { COLOR_MAP, COLORLESS } from './constants';
import { passesAttrFilters, computeNodeDegrees, isSourceSinkReason, reasonSource, reasonTarget, type AttrFilters } from './filters';
import { parseManaSegments } from './manaSegments';
import manaSymbolManifest from '../../data/mana_symbols/manifest.json';
import { ABILITY_ICON_PATHS, ABILITY_ICON_VIEWBOX } from './abilityIconPaths';

// linkCount is recomputed every render() call (the active link set changes
// with filters) and read by cardChargeFor/linkStrengthFor below — see their
// own comments for why a hub's degree has to feed back into both forces.
type CardNode = CardData & { kind: 'card'; linkCount?: number } & d3.SimulationNodeDatum;
// `a`/`b` are the original (pre-simulation) ids, kept alongside `source`/
// `target` — d3.forceLink mutates source/target from plain id strings into
// resolved CardNode object refs once the simulation starts, but VisualEdge
// below still needs a stable string identity per side (for its own key
// function and to resolve each reason's `from` into an actual direction).
type SimLink = d3.SimulationLinkDatum<CardNode> & { reasons: GraphReason[]; a: string; b: string };

// One rendered arrow per relation (not per pair) — VisualEdge is the fan-out
// of a SimLink's `reasons` array, purely for drawing; `parent` is shared by
// reference so a tick's position update reads the SAME source/target object
// d3.forceLink resolved for the underlying pair, without this layer
// duplicating any physics-relevant state of its own (see this file's own
// design note on GraphReason.from: arrows are visual only).
interface VisualEdge {
  parent: SimLink;
  fromA: boolean;
  laneIndex: number;
  laneCount: number;
  description: string;
}

// A "keyword hub" — a synthetic, non-card node that exists only while its
// keyword is checked in FilterPanel.vue's Keywords checklist (useGraphStore's
// `selectedKeywords`). Deliberately NOT part of `graph` (no buildGraph.ts
// involvement — this is a pure runtime augmentation, entirely contained in
// this renderer instance) and NOT a d3.SimulationNodeDatum in the main
// simulation's own node array either: widening CardNode's generic everywhere
// forceLink/forceManyBody/forceX/forceY/forceCollide are typed to it would
// touch most of this file for a feature that doesn't need a card's own
// physics (no charge/collision/drag of its own). Instead each hub eases
// toward the live centroid of its member cards' current positions every tick
// (keywordHubForce below), and a custom velocity nudge pulls each member
// toward it — real physics integration on the SAME simulation loop, just
// without formally being one of its "nodes." `x`/`y` are owned by
// keywordHubForce once a hub exists; render()/updateKeywordHubs only ever
// seed them once (on first appearance) and update `memberIds` afterward.
interface KeywordHubState {
  id: string; // the keyword itself (e.g. "Flying") — unique, doubles as the DOM/data key
  label: string;
  x: number;
  y: number;
  memberIds: string[];
  // Set true for the duration of an active drag (keywordDrag() below) — while
  // true, keywordHubForce leaves x/y alone (the drag handler owns them
  // directly) instead of easing them back toward the members' centroid every
  // tick, which would otherwise fight the cursor. Members still get pulled
  // toward wherever the hub currently is regardless of this flag, same as a
  // stationary hub — dragging one visibly tows its cluster along.
  dragging?: boolean;
}

interface KeywordLinkDatum {
  hub: KeywordHubState;
  cardId: string;
}

// render()'s own second parameter — edge/hub-level toggles that aren't
// per-card attributes (AttrFilters' own job) but still need to reach the
// renderer: keywordIds drives which keyword hubs exist right now.
// sourceSinkOnly === false is what actually narrows real synergy edges down
// to the pure-source->pure-sink subset (see isSourceSinkReason, and its
// consuming `if` in render() below for why the polarity reads this way) —
// `true` (checked) shows the full, untouched graph instead.
export interface RenderOptions {
  sourceSinkOnly?: boolean;
  keywordIds?: ReadonlySet<string>;
}
const EMPTY_KEYWORD_IDS: ReadonlySet<string> = new Set();

// One reason's own combined strength — each raw ratio (this match's slice of
// its source fact's total output / its sink fact's total demand, see
// GraphReason's own doc comment) times a user-tunable budget, so a fact
// matched by only one or two cards concentrates its whole budget into those
// few edges, while a generic fact matched by dozens spreads thin across all
// of them — exactly the "if there's 10 cards that support this, each edge
// gets 1/10 of it" calibration this was designed against; unequal values on
// either side raise or lower a specific match's own slice of that same
// total accordingly, not just an even split.
export function reasonWeight(r: GraphReason, forces: Pick<ForceConfig, 'sourceNormBudget' | 'sinkNormBudget'>): number {
  return r.sourceShareRatio * forces.sourceNormBudget * r.sinkShareRatio * forces.sinkNormBudget;
}

// A pair's own qty multiplier (deck-import mode only — `qty` is undefined
// everywhere else, so this is a no-op there) — more copies of either card in
// the pasted deck means more real chances for this specific interaction to
// actually come up in a game, so it's weighted stronger. Per-card factor is
// sqrt(qty), capped at 2 — a 4-of (sqrt(4) = 2) already hits that ceiling, so
// normal deck counts (1-4 copies) never need it — except a bulk count over 9
// (typically a basic land) gets a slightly higher ceiling of 3 instead of 2,
// so a 17-Island pairing doesn't get squashed all the way down to what a
// 4-of would score. `qtyBoost` scales how much the COMBINED (both sides'
// factors multiplied) effect matters overall: 0 disables it outright
// (multiplier pinned to 1), 1 is the full effect, above 1 exaggerates it
// further.
function qtyFactor(qty: number | undefined): number {
  const q = qty ?? 1;
  return Math.min(Math.sqrt(q), q > 9 ? 3 : 2);
}
export function qtyMultiplier(aQty: number | undefined, bQty: number | undefined, forces: Pick<ForceConfig, 'qtyBoost'>): number {
  const raw = qtyFactor(aQty) * qtyFactor(bQty);
  return 1 + forces.qtyBoost * (raw - 1);
}

// Average combined weight (reasonWeight above) across a pair's distinct
// reasons, scaled by that pair's own qty multiplier. Only meaningful once
// d3.forceLink has resolved `source`/`target` from plain id strings into
// real CardNode objects (true by the time anything below actually calls
// this — see linkStrengthFor's own identical cast).
function linkQuality(d: SimLink, forces: ForceConfig): number {
  const s = d.source as CardNode;
  const t = d.target as CardNode;
  const total = d.reasons.reduce((sum, r) => sum + reasonWeight(r, forces), 0);
  const avg = total / d.reasons.length;
  return avg * qtyMultiplier(s.qty, t.qty, forces);
}

export interface ForceConfig {
  cardCharge: number; // repulsion strength for card nodes
  gravity: number; // pull toward center (forceX/forceY strength)
  linkStrength: number; // how tightly a link pulls its two ends together
  linkDistanceScale: number; // multiplies the link distance (1 = default)
  collidePadding: number; // multiplies the extra spacing enforced around each node
  alphaDecay: number; // how fast the simulation "cools" — lower keeps it moving longer
  velocityDecay: number; // friction — lower means more momentum/bounce
  // "Budget" a single source/sink fact splits across every match it
  // participates in (see reasonWeight above) — higher makes generic,
  // widely-matched facts count for more overall; lower shrinks their
  // influence relative to narrow, specific ones.
  sourceNormBudget: number;
  sinkNormBudget: number;
  // How much a deck-import pair's own copy counts (qty) amplify its edge —
  // see qtyMultiplierFor above. 0 = ignore quantities entirely.
  qtyBoost: number;
}

export const DEFAULT_FORCES: ForceConfig = {
  cardCharge: -220,
  gravity: 0.02,
  linkStrength: 0.3,
  linkDistanceScale: 1,
  collidePadding: 1,
  // alphaDecay briefly got fixed at 0.75, but that cools the simulation almost
  // before it has any ticks to actually spread nodes out from their random start
  // positions — first load stayed clumped. Kept tunable.
  alphaDecay: 0.02,
  velocityDecay: 0.4,
  sourceNormBudget: 10,
  sinkNormBudget: 10,
  qtyBoost: 1,
};

// 'default' — the usual force-directed layout, gravity pulls toward center.
// 'manaCost' — a mana curve: cards sorted into fixed CMC columns (0/1/2/3/4/
// 5+), pulled to the top with a hard stop there, free to move only
// vertically within their own column (see manaCostColumnX/setGravityMode
// below).
export type GravityMode = 'default' | 'manaCost';

export interface GraphHandlers {
  onCardHover(card: CardData, links: { card: CardData; reasons: GraphReason[] }[], event: MouseEvent): void;
  onHoverMove(event: MouseEvent): void;
  onHoverEnd(): void;
  onCardClick(card: CardData, event: MouseEvent): void;
  onBackgroundClick(): void;
}

function cardFill(c: CardData): string {
  const ci = c.colorIdentity;
  if (ci.length === 0) return COLORLESS;
  return COLOR_MAP[ci[0]!] ?? COLORLESS;
}

// Every card node is the same fixed size — no mana-value scaling, no
// land-specific case (there's nothing left to special-case once size isn't
// derived from cmc at all). Rectangular, not circular — no clip-path needed,
// the image already IS the shape once sized to this box.
//
// NODE_SCALE is the one knob for the whole node's size — everything below
// (title bar, seam fade, mana pips, badges, the scryfall icon) is defined
// relative to it rather than as independent hardcoded pixel counts, so
// nudging this one number keeps all of them proportional instead of each
// needing its own re-tune. Bumped from the original 40px-tall base (sized to
// match the old circular node's footprint) to 60px — at 40px, title/seam/
// font tweaks were landing in 1-2px increments, too fine to dial in
// precisely.
const NODE_SCALE = 1.5;
const RECT_HEIGHT = 40 * NODE_SCALE;
const ART_ASPECT = 626 / 457; // Scryfall's typical (not universal — real art_crop dimensions vary per card, some are portrait) art_crop aspect ratio, ~626x457
const RECT_WIDTH = RECT_HEIGHT * ART_ASPECT;
const CORNER_RADIUS = 4 * NODE_SCALE;

// Title row is its own strip stacked directly above the art, flush against
// it (zero gap — see TOTAL_HEIGHT) rather than overlaid on top of the art
// itself. Both pieces share ONE clip-path spanning the combined height (see
// the `card-clip` def below), so the whole node still reads as a single
// rounded card — only the true outer corners round, the seam between title
// and art stays a plain straight edge, softened by a gradient fade
// (`card-title-fade`) rather than a hard color cut.
const TITLE_BAR_HEIGHT = 7.5 * NODE_SCALE;
const TOTAL_HEIGHT = RECT_HEIGHT + TITLE_BAR_HEIGHT;
// How far the fade extends onto the art — see card-title-fade's own stops
// below for the exact falloff curve.
const SEAM_FADE_HEIGHT = 8 * NODE_SCALE;
const MAX_TITLE_FONT_SIZE = 4 * NODE_SCALE;
const MIN_TITLE_FONT_SIZE = 2.25 * NODE_SCALE;
const MANA_PIP_SIZE = 4 * NODE_SCALE;
const MANA_PIP_GAP = 1 * NODE_SCALE;
const TITLE_PADDING = 3 * NODE_SCALE;
// Keyword ability icons (Flying/Trample/etc — see renderCardArt's own
// "Keyword ability icons" block below) — sized noticeably bigger than a mana
// pip: these are detailed illustrative glyphs (arbitrary path art, not a
// small flat mana symbol), and at pip size they'd be an illegible smudge.
const KEYWORD_ICON_SIZE = 7 * NODE_SCALE;
const KEYWORD_ICON_GAP = 1.5 * NODE_SCALE;
const KEYWORD_ICON_MARGIN = 3 * NODE_SCALE;
// Tried EB Garamond (the app's own "MTG-like" font, see FunctionalModelText.vue)
// here — reverted: its serifs make it barely legible at the small sizes
// these titles actually render at, worse than a plain sans-serif.
const TITLE_FONT_FAMILY = 'sans-serif';

// Shared across every node (title text width varies per card, per render) —
// one offscreen canvas 2d context, never attached to the DOM, reused rather
// than allocated per node.
let measureCtx: CanvasRenderingContext2D | null = null;
function measureTextWidth(text: string, fontSize: number): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * fontSize * 0.6; // no canvas support — rough fallback, never hit in a real browser
  // Must match the actual rendered <text>'s font exactly (weight/family) —
  // otherwise this measurement (used to pick a font size/truncation point
  // that fits) drifts from what really gets painted.
  measureCtx.font = `600 ${fontSize}px ${TITLE_FONT_FAMILY}`;
  return measureCtx.measureText(text).width;
}

// Longest prefix (+ "…") of `text` that fits `maxWidth` at `fontSize` —
// only reached once shrinking the font down to MIN_TITLE_FONT_SIZE still
// isn't enough (a genuinely long card name at the smallest column width).
function truncateToFit(text: string, fontSize: number, maxWidth: number): string {
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${text.slice(0, mid)}…`;
    if (measureTextWidth(candidate, fontSize) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? '…' : `${text.slice(0, lo)}…`;
}

// Shrinks the title font (half-point steps) until the name fits `maxWidth`,
// truncating with an ellipsis only if it still doesn't fit at the smallest
// readable size — "scale down font size depending on how much horizontal
// space we got", degrading to truncation rather than overflowing/wrapping.
// The graph is usually viewed zoomed WAY out (hundreds of nodes on screen at
// once) — at that scale a node's nominal "5px" title text can render at well
// under 2 actual device pixels tall, where browsers hint/snap glyph advances
// to the device pixel grid and the REAL rendered width ends up narrower than
// an ideal (canvas-measured) computation predicts — confirmed directly: the
// same <text> element's own getComputedTextLength() came back ~20% smaller
// at scale 0.35 than at scale 6 for an identical font-size attribute. A
// slack multiplier here would let a size "pass" the fit check somewhat over
// the exact reserved width to compensate — but that's backwards at HIGH
// zoom, exactly where a name is actually read closely: there, hinting
// compression fades and canvas's prediction is accurate, so any slack just
// becomes real, visible overflow into the mana pips (confirmed the hard
// way). Left at 1 (no slack) — some wasted space at extreme zoom-out beats
// overflow once actually zoomed in to read a name.
const TITLE_FIT_SLACK = 1;

function fitTitleText(name: string, maxWidth: number): { size: number; text: string } {
  let size = MAX_TITLE_FONT_SIZE;
  while (size > MIN_TITLE_FONT_SIZE && measureTextWidth(name, size) > maxWidth * TITLE_FIT_SLACK) size -= 0.5;
  size = Math.max(size, MIN_TITLE_FONT_SIZE);
  if (measureTextWidth(name, size) <= maxWidth * TITLE_FIT_SLACK) return { size, text: name };
  return { size, text: truncateToFit(name, size, maxWidth * TITLE_FIT_SLACK) };
}

const MANA_SYMBOL_MANIFEST = manaSymbolManifest as Record<string, { dataUri: string; english: string }>;
function manaPipCodes(manaCost: string | null): string[] {
  if (!manaCost) return [];
  return parseManaSegments(manaCost)
    .filter((seg): seg is { mana: string } => 'mana' in seg)
    .map((seg) => seg.mana)
    .filter((code) => MANA_SYMBOL_MANIFEST[code]);
}

// BADGE_KEYWORDS (buildGraph.ts) keeps Scryfall's own keyword spelling —
// including two-word keywords with a plain space ("First strike", "Double
// strike") — since that's what filters/tooltips already compare against;
// the ability-icon set's own keys are functional-model's PascalCase, no
// space ("FirstStrike", "DoubleStrike" — see abilityIconPaths.ts's own
// comment). Converts one to the other; a no-op for every single-word
// keyword, which is already exactly PascalCase to begin with (e.g. "Flying").
function abilityIconKey(keyword: string): string {
  return keyword
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

// How far apart parallel arrows fan out when the same pair has more than one
// relation — purely a drawing offset, never fed into the simulation.
const EDGE_LANE_SPACING = 7;
// Trims an arrow's arrival point this far short of the target node's edge
// (in addition to its radius) so the arrowhead marker renders just outside
// the node instead of underneath its opaque fill.
const EDGE_ARROW_GAP = 3;

// Collision/repulsion still reason in terms of a single "radius" — half the
// WIDER dimension, so neighboring rectangles get enough breathing room along
// their widest axis instead of just their height.
function cardRadius(): number {
  return Math.max(RECT_WIDTH, TOTAL_HEIGHT) / 2;
}

// Smaller than a card node (an earlier pass went bigger AND brighter —
// walked both back: this should read as a quiet, secondary landmark you
// glance at, not something competing for attention with the cards
// themselves) and drawn with a soft blurred glow + a fairly translucent
// fill (see its render() usage below) rather than a hard-edged disc, for the
// same "relaxed, not rigid" reasoning. Muted slate-violet — every hue
// already in use elsewhere is spoken for (WUBRG identity colors, rarity's
// own gold/orange/grey, and produce/consume/atypical/grant/magnifier's own
// green/blue/grey/cyan/pink — see main.css/constants.ts), so violet is the
// one family nothing else in this UI uses; kept low-saturation rather than
// a vivid purple to stay subtle rather than jump out.
const KEYWORD_HUB_RADIUS = cardRadius() * 0.55;
const KEYWORD_HUB_COLOR = '#7d739c';
// Icon sized well under the hub's own radius — the label stays the primary
// identifier (unlike a card-node keyword badge, where the icon IS the whole
// point), the icon is just a matching-glyph accent above it.
const KEYWORD_HUB_ICON_SIZE = KEYWORD_HUB_RADIUS * 0.55;

// Scryfall's art_crop (just the illustration, no card frame/text) for the
// front face, sized to a fixed rectangle (cropped to fill it via
// preserveAspectRatio="...slice", same as the old circle version) — falls
// back to the old flat color-identity fill for the rare card with no
// resolved art_crop (cardArtCrop() in buildGraph.ts returned null for it)
// rather than leaving an empty node. A thin dark outline rect is drawn on
// top either way, for definition against the dark canvas background.
function renderCardArt(sel: d3.Selection<SVGGElement, CardNode, any, any>) {
  sel.each(function (d) {
    const g = d3.select(this);
    const art = d.artCrop;
    const x = -RECT_WIDTH / 2;
    // Two y baselines now: `titleY` (top of the whole node) and `artY` (top
    // of the art, flush right below the title strip — TITLE_BAR_HEIGHT down,
    // zero gap). Everything that used to be anchored to the art's own top
    // (glow/outline/qty badge/scryfall icon) that should still track the
    // ART specifically (not the combined node) keeps using `artY`.
    const titleY = -TOTAL_HEIGHT / 2;
    const artY = titleY + TITLE_BAR_HEIGHT;

    // Blurred glow drawn UNDER everything — the opaque node covers its
    // inward half, so only the outward-blurred edge shows, like a soft glow
    // rather than a blur across the art itself. Four separate inset edge
    // segments (not a single rect outline) — a joined rect's corners get two
    // strokes overlapping at the 90° turn, and blurring that double coverage
    // reads as a bright hot spot; stopping each edge short of the corner
    // avoids the overlap, so the glow concentrates on the flat top/sides and
    // fades out approaching each corner instead. Spans the WHOLE node
    // (title + art), not just the art, now that they're one visual card.
    const glowGroup = g.append('g').attr('class', 'card-glow').attr('filter', 'url(#card-outline-glow)');
    const inset = 8 * NODE_SCALE;
    const edges: [number, number, number, number][] = [
      [x + inset, titleY, x + RECT_WIDTH - inset, titleY], // top
      [x + inset, titleY + TOTAL_HEIGHT, x + RECT_WIDTH - inset, titleY + TOTAL_HEIGHT], // bottom
      [x, titleY + inset, x, titleY + TOTAL_HEIGHT - inset], // left
      [x + RECT_WIDTH, titleY + inset, x + RECT_WIDTH, titleY + TOTAL_HEIGHT - inset], // right
    ];
    for (const [x1, y1, x2, y2] of edges) {
      glowGroup
        .append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.5)
        .attr('stroke-linecap', 'round');
    }

    // Title strip — its own flat, subdued backdrop (not the seam fade below)
    // stacked directly above the art with zero gap. Square corners of its
    // own (rx omitted) — clipped to `card-clip` (spans the WHOLE node), so
    // only its top-left/top-right actually end up rounded; the bottom edge
    // against the art stays a plain straight seam.
    g.append('rect')
      .attr('class', 'card-title-bg')
      .attr('x', x)
      .attr('y', titleY)
      .attr('width', RECT_WIDTH)
      .attr('height', TITLE_BAR_HEIGHT)
      // Same dark tone as the app's own --color-bg (main.css) — darker than
      // pure black would read as a harsh cutout, but still theme-matched
      // rather than flat #000.
      .attr('fill', '#14151a')
      .attr('clip-path', 'url(#card-clip)');

    // Faint grain overlay — see header-noise's own comment. White base color
    // is irrelevant on its own (feColorMatrix strips it to pure alpha before
    // this ever paints), just needs to be opaque going in.
    g.append('rect')
      .attr('class', 'card-title-noise')
      .attr('x', x)
      .attr('y', titleY)
      .attr('width', RECT_WIDTH)
      .attr('height', TITLE_BAR_HEIGHT)
      .attr('fill', '#fff')
      .attr('filter', 'url(#header-noise)')
      .attr('clip-path', 'url(#card-clip)');

    if (!art) {
      g.append('rect')
        .attr('class', 'card-shape')
        .attr('x', x)
        .attr('y', artY)
        .attr('width', RECT_WIDTH)
        .attr('height', RECT_HEIGHT)
        .attr('fill', cardFill(d))
        .attr('clip-path', 'url(#card-clip)');
    } else {
      g.append('image')
        .attr('class', 'card-shape')
        .attr('href', art)
        .attr('x', x)
        .attr('y', artY)
        .attr('width', RECT_WIDTH)
        .attr('height', RECT_HEIGHT)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        // `rx`/`ry` on <image> itself is inconsistently supported across
        // browsers — a clipPath (defined once in defs, reused by every node
        // via the same local coordinate space each node's own <g> transform
        // already provides) is the reliable way to round an image's corners
        // (here, only its BOTTOM two — see card-clip's own comment).
        .attr('clip-path', 'url(#card-clip)');
    }

    // Hairline cover — a solid 1px sliver in the SAME color as the header,
    // straddling the header/art boundary. Papers over the antialiasing
    // crack that otherwise sometimes shows between two adjacent rects
    // sharing an edge; kept as its own plain rect (not folded into the
    // gradient rect below) so that one's own 0%-100% span maps exactly onto
    // SEAM_FADE_HEIGHT, matching its stops precisely.
    const SEAM_FADE_OVERLAP = 1;
    g.append('rect')
      .attr('class', 'card-seam-cover')
      .attr('x', x)
      .attr('y', artY - SEAM_FADE_OVERLAP)
      .attr('width', RECT_WIDTH)
      .attr('height', SEAM_FADE_OVERLAP * 2)
      .attr('fill', '#14151a');

    // Seam fade — a plain rect laid over the TOP of the art (not the
    // header — that stays fully solid everywhere else), fading from the
    // header's own solid color down to transparent per card-title-fade's own
    // stops, so the header's bottom edge blends smoothly into the art
    // instead of a hard color cut. No clip-path needed: it's nowhere near
    // the node's rounded outer corners.
    g.append('rect')
      .attr('class', 'card-seam-fade')
      .attr('x', x)
      .attr('y', artY)
      .attr('width', RECT_WIDTH)
      .attr('height', SEAM_FADE_HEIGHT)
      .attr('fill', 'url(#card-title-fade)');

    const pipCodes = manaPipCodes(d.manaCost);
    const pipsWidth = pipCodes.length ? pipCodes.length * MANA_PIP_SIZE + (pipCodes.length - 1) * MANA_PIP_GAP : 0;
    const maxTitleWidth = RECT_WIDTH - TITLE_PADDING * 2 - (pipsWidth ? pipsWidth + TITLE_PADDING : 0);
    const { size: titleFontSize, text: titleText } = fitTitleText(d.name, maxTitleWidth);
    g.append('text')
      .attr('class', 'card-title-text')
      .attr('x', x + TITLE_PADDING)
      .attr('y', titleY + TITLE_BAR_HEIGHT / 2)
      .attr('dominant-baseline', 'central')
      .attr('font-family', TITLE_FONT_FAMILY)
      .attr('font-size', titleFontSize)
      .attr('font-weight', 600)
      .attr('fill', '#e8e8e8')
      .attr('fill-opacity', 0.9)
      .text(titleText);

    if (pipCodes.length) {
      let pipX = x + RECT_WIDTH - TITLE_PADDING - pipsWidth;
      const pipY = titleY + (TITLE_BAR_HEIGHT - MANA_PIP_SIZE) / 2;
      for (const code of pipCodes) {
        g.append('image')
          .attr('class', 'card-title-mana')
          .attr('href', MANA_SYMBOL_MANIFEST[code]!.dataUri)
          .attr('x', pipX)
          .attr('y', pipY)
          .attr('width', MANA_PIP_SIZE)
          .attr('height', MANA_PIP_SIZE)
          .attr('opacity', 0.9);
        pipX += MANA_PIP_SIZE + MANA_PIP_GAP;
      }
    }

    // Single outline around the WHOLE node (title + art together) — one
    // seamless card border, not two separate boxes each with their own.
    g.append('rect')
      .attr('class', 'card-outline')
      .attr('rx', CORNER_RADIUS)
      .attr('x', x)
      .attr('y', titleY)
      .attr('width', RECT_WIDTH)
      .attr('height', TOTAL_HEIGHT)
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 0.3);

    // Keyword ability icons — a vertical strip immediately to the RIGHT of
    // the node, outside the art rect entirely (past x + RECT_WIDTH), so it
    // never competes with anything drawn INSIDE the rect on that same side
    // (mana pips in the title bar, the scryfall link, the qty badge below —
    // all still exactly where they were). Stacks top-down starting flush
    // with the top of the art band (artY), not vertically centered — reads
    // as a fixed-position list rather than shifting position card to card
    // as the keyword count changes. Reuses the exact glyph set
    // AbilityIcon.vue renders (ABILITY_ICON_PATHS/VIEWBOX) — this whole node
    // is raw D3/SVG, not a Vue tree, so it references that data directly
    // instead of the component. A keyword with no matching glyph
    // (BADGE_KEYWORDS includes Crew, which the icon set doesn't cover) is
    // silently skipped, same as AbilityIcon.vue's own `v-if="path"`.
    // Uncapped: BADGE_KEYWORDS is a short, curated evergreen/combat list
    // (buildGraph.ts) — no real card stacks enough of them at once for this
    // to actually clutter.
    const iconKeys = d.keywords.map(abilityIconKey).filter((k) => ABILITY_ICON_PATHS[k]);
    if (iconKeys.length) {
      const iconX = x + RECT_WIDTH + KEYWORD_ICON_MARGIN;
      let iconY = artY;
      const keywordGroup = g.append('g').attr('class', 'card-keyword-icons');
      for (const key of iconKeys) {
        const cell = keywordGroup.append('g').attr('transform', `translate(${iconX},${iconY})`);
        cell
          .append('rect')
          .attr('width', KEYWORD_ICON_SIZE)
          .attr('height', KEYWORD_ICON_SIZE)
          .attr('rx', 1.5 * NODE_SCALE)
          .attr('fill', '#000')
          .attr('fill-opacity', 0.55);
        cell
          .append('svg')
          .attr('width', KEYWORD_ICON_SIZE)
          .attr('height', KEYWORD_ICON_SIZE)
          .attr('viewBox', ABILITY_ICON_VIEWBOX[key]!)
          .append('path')
          .attr('d', ABILITY_ICON_PATHS[key]!)
          .attr('fill', '#fff')
          .attr('fill-rule', 'evenodd');
        iconY += KEYWORD_ICON_SIZE + KEYWORD_ICON_GAP;
      }
    }

    // Scryfall shortcut — hidden until the node is hovered (see the
    // `.scryfall-link` CSS rule in GraphCanvas.vue), so it doesn't compete
    // with the art at rest. Its own click handler stops propagation so it
    // opens Scryfall instead of falling through to the node's own click
    // handler (which opens this card's OWN page — see onCardClick in
    // GraphCanvas.vue). Icon is lucide's own `external-link` glyph (same
    // one Nuxt Icon would render as `i-lucide-external-link`), inlined as a
    // raw path rather than going through the Icon component — this whole
    // node is a plain D3-appended <g>, not Vue template output.
    const scryfallBoxSize = 11 * NODE_SCALE;
    const scryfallX = x + RECT_WIDTH - scryfallBoxSize - 2 * NODE_SCALE;
    const scryfallY = artY + 2 * NODE_SCALE;
    const scryfallCx = scryfallX + scryfallBoxSize / 2;
    const scryfallCy = scryfallY + scryfallBoxSize / 2;
    const scryfallIconSize = 7 * NODE_SCALE;
    const scryfallIconScale = scryfallIconSize / 24;
    g.append('g')
      .attr('class', 'scryfall-link')
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent) => {
        event.stopPropagation();
        window.open(d.scryfallUri, '_blank', 'noopener');
      })
      .call((link) => {
        link
          .append('rect')
          .attr('x', scryfallX)
          .attr('y', scryfallY)
          .attr('width', scryfallBoxSize)
          .attr('height', scryfallBoxSize)
          .attr('rx', 2)
          .attr('fill', '#000')
          .attr('fill-opacity', 0.45);
        link
          .append('path')
          .attr('d', 'M15 3h6v6m-11 5L21 3m-3 10v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6')
          .attr('fill', 'none')
          .attr('stroke', '#fff')
          .attr('stroke-width', 3)
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round')
          .attr('transform', `translate(${scryfallCx},${scryfallCy}) scale(${scryfallIconScale}) translate(-12,-12)`);
      });

    // Deck-import qty badge — shown whenever this card is in the active deck
    // (qty is undefined outside deck mode, so nothing shows there).
    if (d.qty) {
      const badgeText = `×${d.qty}`;
      const bw = (8 + badgeText.length * 5.5) * NODE_SCALE;
      const bh = 12 * NODE_SCALE;
      const bx = x + RECT_WIDTH - bw + 3 * NODE_SCALE;
      const by = artY + RECT_HEIGHT - bh + 3 * NODE_SCALE;
      const badge = g.append('g').attr('class', 'card-qty-badge');
      badge
        .append('rect')
        .attr('x', bx)
        .attr('y', by)
        .attr('width', bw)
        .attr('height', bh)
        .attr('rx', 3 * NODE_SCALE)
        .attr('fill', '#000')
        .attr('fill-opacity', 0.78);
      badge
        .append('text')
        .attr('x', bx + bw / 2)
        .attr('y', by + bh / 2 + 3 * NODE_SCALE)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9 * NODE_SCALE)
        .attr('font-weight', 700)
        .attr('fill', '#fff')
        .text(badgeText);
    }
  });
}

// Owns the entire force-directed graph imperatively: node/edge state, the D3
// simulation, and all SVG rendering. Vue mounts the <svg> once and never touches
// its subtree again — render()/applySearch() mutate the same persistent node
// objects (keyed by id) across calls, so positions/zoom/drag state survive every
// filter or search change instead of getting reset by a template re-render.
//
// Cards-only, direct card<->card links (functional-model's real, verified synergy
// matches — see server/api/graph-links.ts) — no theme hub nodes. That's a
// deliberate simplification from the old bipartite card/theme-hub layout this
// replaced: themes may come back later purely as a visual highlighter (recolor
// matching cards), but NOT as a node the simulation itself reasons about — see
// this session's design discussion. Not scaffolded here ahead of that.
// Mana-cost gravity mode's own columns — 0/1/2/3/4/5, the last bucketing
// every cmc of 5 or more (same "curve" convention deckbuilding tools already
// use, rather than one column per real cmc value out to some rare 16).
const MANA_COST_COLUMNS = 6;
function cmcBucket(cmc: number): number {
  return Math.min(MANA_COST_COLUMNS - 1, Math.max(0, Math.round(cmc)));
}
// How far from the very top of the canvas a manaCost-mode node's forceY
// target sits, and (see the tick handler below) the hard floor its rendered
// y is clamped to — half RECT_HEIGHT-ish plus a little breathing room so the
// topmost row doesn't render flush against/clipped by the canvas edge.
const MANA_COST_TOP_MARGIN = 40 * NODE_SCALE;

export function createGraphRenderer(svgEl: SVGSVGElement, graph: GraphFile, handlers: GraphHandlers) {
  const width = svgEl.clientWidth || window.innerWidth;
  const height = svgEl.clientHeight || window.innerHeight - 60;
  // One evenly-spaced x per column, computed once against this render's own
  // canvas width — mana-cost mode pins every node to its own bucket's slot
  // via forceX's target function below (manaCostXFor), never touched again
  // after that (this mode never needs to know the real window width beyond
  // setup).
  function manaCostColumnX(cmc: number): number {
    const bucket = cmcBucket(cmc);
    return ((bucket + 0.5) / MANA_COST_COLUMNS) * width;
  }

  const linksByCard = new Map<string, { card: string; reasons: GraphReason[] }[]>();
  for (const l of graph.links) {
    if (!linksByCard.has(l.a)) linksByCard.set(l.a, []);
    linksByCard.get(l.a)!.push({ card: l.b, reasons: l.reasons });
    if (!linksByCard.has(l.b)) linksByCard.set(l.b, []);
    linksByCard.get(l.b)!.push({ card: l.a, reasons: l.reasons });
  }

  const cardNodeById = new Map<string, CardNode>();
  for (const c of graph.cards) cardNodeById.set(c.id, { ...c, kind: 'card' });

  // Computed once from the graph's FULL edge list, never recomputed per
  // render() — the Source-Sink filter's whole point is that a node's
  // "pure producer/root" or "pure consumer/leaf" status is a fixed fact
  // about this graph's topology, unaffected by which color/rarity/type
  // filters happen to be active right now (see filters.ts's own header
  // comment on computeNodeDegrees/isSourceSinkReason).
  const nodeDegrees = computeNodeDegrees(graph);

  // Keyword hubs — keyed by keyword id, persisted for this renderer
  // instance's whole lifetime (never reset/recreated wholesale) so an
  // already-settled hub's live x/y — owned by keywordHubForce below, never
  // written by render() past its first appearance — survives an unrelated
  // color/rarity/type filter toggle across the SAME set of checked keywords.
  // See KeywordHubState's own doc comment above for why these aren't real
  // d3 simulation nodes.
  const keywordHubsById = new Map<string, KeywordHubState>();
  // How strongly a member card gets nudged toward its hub each tick, and how
  // fast the hub itself eases toward its members' live centroid — both flat
  // constants (not user-tunable sliders, unlike ForceConfig) since this is a
  // first pass at the feature. Deliberately gentle (loose association, not a
  // tight magnet) — an earlier pass at 0.12/0.15 crushed members into a rigid
  // clump almost immediately; these values (~1/6 and ~1/3 of the old ones)
  // still visibly gather members toward the hub over several seconds while
  // leaving plenty of room for cardCharge/collide to keep them loosely
  // spread, same "gathered, not glued" feel a real (weak) synergy edge has.
  const KEYWORD_HUB_PULL_STRENGTH = 0.02;
  const KEYWORD_HUB_EASE = 0.05;

  // Refreshes hub membership for whichever keywords are currently checked —
  // called once per render(), same cadence as everything else filter-driven.
  // Adds a hub the first time its keyword is checked (seeded near its
  // members' current on-screen centroid, or screen center if none have
  // settled anywhere yet, rather than snapping in from a fixed corner),
  // drops a hub the moment its keyword is unchecked, and otherwise only ever
  // touches `memberIds` on an existing hub — never its `x`/`y`, which
  // keywordHubForce owns exclusively once a hub exists.
  function updateKeywordHubs(activeNodes: CardNode[], keywordIds: ReadonlySet<string>) {
    for (const kw of [...keywordHubsById.keys()]) if (!keywordIds.has(kw)) keywordHubsById.delete(kw);

    for (const kw of keywordIds) {
      const members = activeNodes.filter((c) => c.keywords.includes(kw)).map((c) => c.id);
      const existing = keywordHubsById.get(kw);
      if (existing) {
        existing.memberIds = members;
        continue;
      }
      let cx = width / 2;
      let cy = height / 2;
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const id of members) {
        const node = cardNodeById.get(id);
        if (node?.x != null && node?.y != null) {
          sx += node.x;
          sy += node.y;
          n++;
        }
      }
      if (n > 0) {
        cx = sx / n;
        cy = sy / n;
      }
      keywordHubsById.set(kw, { id: kw, label: kw, x: cx, y: cy, memberIds: members });
    }
  }

  // Registered as its own named force (alongside link/charge/x/y/collide
  // below) so it runs every tick the SAME way every other force does — real
  // integration into the simulation's own velocity, not a separate
  // requestAnimationFrame loop layered on top. A member with no settled
  // position yet, or a hub with zero current members, is skipped for that
  // tick rather than pulling toward/from a stale (0,0).
  function keywordHubForce(alpha: number) {
    for (const hub of keywordHubsById.values()) {
      if (hub.memberIds.length === 0) continue;
      // While the user is actively dragging this hub (keywordDrag below),
      // its x/y are the drag handler's to own — easing it back toward the
      // centroid here every tick would just fight the cursor.
      if (!hub.dragging) {
        let sx = 0;
        let sy = 0;
        let n = 0;
        for (const id of hub.memberIds) {
          const node = cardNodeById.get(id);
          if (node?.x == null || node?.y == null) continue;
          sx += node.x;
          sy += node.y;
          n++;
        }
        if (n > 0) {
          const cx = sx / n;
          const cy = sy / n;
          hub.x += (cx - hub.x) * KEYWORD_HUB_EASE;
          hub.y += (cy - hub.y) * KEYWORD_HUB_EASE;
        }
      }
      for (const id of hub.memberIds) {
        const node = cardNodeById.get(id);
        if (node?.x == null || node?.y == null) continue;
        node.vx = (node.vx ?? 0) + (hub.x - node.x) * KEYWORD_HUB_PULL_STRENGTH * alpha;
        node.vy = (node.vy ?? 0) + (hub.y - node.y) * KEYWORD_HUB_PULL_STRENGTH * alpha;
      }
    }
  }

  // Lets a hub be click-dragged like a card node (drag() above) — plain x/y
  // assignment straight from the event, not fx/fy pinning (a hub isn't a
  // real simulation node, nothing else would ever fight over its position
  // the way d3.forceLink/forceX would for a card), released back to
  // keywordHubForce's own centroid-follow on drag end.
  function keywordDrag() {
    function dragstarted(event: any, d: KeywordHubState) {
      if (!event.active) simulation.alphaTarget(0.2).restart();
      d.dragging = true;
    }
    function dragged(event: any, d: KeywordHubState) {
      d.x = event.x;
      d.y = event.y;
    }
    function dragended(event: any, d: KeywordHubState) {
      if (!event.active) simulation.alphaTarget(0);
      d.dragging = false;
    }
    return d3.drag<any, KeywordHubState>().on('start', dragstarted).on('drag', dragged).on('end', dragended);
  }

  const forces: ForceConfig = { ...DEFAULT_FORCES };

  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  // Shared by every node's glow rect below — one filter def, reused via
  // url(#card-outline-glow) rather than one <filter> per node.
  const defs = svg.append('defs');
  defs
    .append('filter')
    .attr('id', 'card-outline-glow')
    .attr('x', '-40%')
    .attr('y', '-40%')
    .attr('width', '180%')
    .attr('height', '180%')
    .append('feGaussianBlur')
    .attr('stdDeviation', 1.2);

  // Faint grain over the header — fractal noise turned into a pure-alpha
  // texture (feColorMatrix's own luminance-to-alpha, so the noise shows only
  // as texture, never as a color cast) via feComponentTransfer clamped to a
  // low ceiling — applied to a plain white rect drawn over the header at
  // very low opacity (see card-title-bg's own header-noise overlay below),
  // reading as a subtle card-stock texture rather than visible static.
  defs
    .append('filter')
    .attr('id', 'header-noise')
    .attr('x', '0%')
    .attr('y', '0%')
    .attr('width', '100%')
    .attr('height', '100%')
    .call((filter) => {
      filter.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', 0.9).attr('numOctaves', 2).attr('stitchTiles', 'stitch').attr('result', 'noise');
      filter.append('feColorMatrix').attr('in', 'noise').attr('type', 'luminanceToAlpha').attr('result', 'alphaNoise');
      filter
        .append('feComponentTransfer')
        .attr('in', 'alphaNoise')
        .call((transfer) => transfer.append('feFuncA').attr('type', 'linear').attr('slope', 0.35).attr('intercept', 0));
    });

  // Rounds the WHOLE node's corners (title strip + art together, not just
  // the art) — clipPathUnits defaults to userSpaceOnUse, so this rect's
  // coordinates are read in whichever node <g>'s local space is referencing
  // it at render time, meaning one shared clipPath (not one per node) works
  // for every node. Both the title bg and the art get clipped to this SAME
  // rect: since neither draws its own rx, only the true outer corners (top
  // of title, bottom of art) end up rounded — the seam between them, being
  // nowhere near a corner, stays a plain straight edge.
  defs
    .append('clipPath')
    .attr('id', 'card-clip')
    .append('rect')
    .attr('x', -RECT_WIDTH / 2)
    .attr('y', -TOTAL_HEIGHT / 2)
    .attr('width', RECT_WIDTH)
    .attr('height', TOTAL_HEIGHT)
    .attr('rx', CORNER_RADIUS);

  // Seam fade — a thin strip laid over the top of the art (see
  // card-seam-fade below), opaque at its own top in the SAME tone as the
  // header (#14151a — a seamless continuation of its solid fill) fading to
  // fully transparent by its bottom, so the header's edge blends into the
  // art instead of a hard color cut. Non-linear falloff (fast at first,
  // long tail) — explicit stops at each fraction of SEAM_FADE_HEIGHT:
  // 0/8→100%, 1/8→90%, 2/8→50%, 3/8→20%, 4/8→10%, 6/8→5%, 8/8→0%.
  // objectBoundingBox (the default) means these offsets map to whatever
  // rect this fill is applied to, so one shared gradient works at any
  // size/position.
  const titleFade = defs.append('linearGradient').attr('id', 'card-title-fade').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  const SEAM_FADE_STOPS: [number, number][] = [
    [0, 1],
    [1 / 8, 0.9],
    [2 / 8, 0.5],
    [3 / 8, 0.2],
    [4 / 8, 0.1],
    [6 / 8, 0.05],
    [1, 0],
  ];
  for (const [offset, opacity] of SEAM_FADE_STOPS) {
    titleFade
      .append('stop')
      .attr('offset', `${offset * 100}%`)
      .attr('stop-color', '#14151a')
      .attr('stop-opacity', opacity);
  }

  // Directional arrowhead for every link — `fill="context-stroke"` (a real
  // SVG2 keyword Chrome/Firefox both honor) picks up whatever `stroke` color
  // the referencing <path> has via CSS, so the arrowhead automatically
  // matches `.link`'s own color instead of needing its own copy of it.
  defs
    .append('marker')
    .attr('id', 'link-arrow')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 8.5)
    .attr('refY', 5)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto-start-reverse')
    .append('path')
    .attr('d', 'M0,0 L10,5 L0,10 z')
    .attr('fill', 'context-stroke');

  const root = svg.append('g');
  const zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.15, 6])
    .on('zoom', (event) => root.attr('transform', event.transform));
  svg.call(zoomBehavior);
  // Starts zoomed out instead of at 100% — the force layout spreads cards well
  // beyond one screenful, so a fresh load previously showed just whatever
  // happened to be near the top-left corner at identity transform.
  const INITIAL_ZOOM = 0.35;
  svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(INITIAL_ZOOM).translate(-width / 2, -height / 2));
  svg.on('click', (event) => {
    const target = event.target as Element;
    if (!target.closest('.node-card')) handlers.onBackgroundClick();
  });

  const linkLayer = root.append('g');
  // Keyword-hub links (hub -> member card) get their own layer, appended
  // right after the real synergy links so they sit in the same "under the
  // cards" plane but stay visually distinct (dashed, see the .keyword-link
  // CSS in GraphCanvas.vue) rather than mixing into the `.link` selection
  // applyEdgeStyle colors by match quality — a keyword-hub connection has no
  // quality/reasons of its own to color by.
  const keywordLinkLayer = root.append('g');
  const cardLayer = root.append('g');
  // Keyword-hub nodes render ABOVE cards (unlike keywordLinkLayer above) —
  // they're meant to read as a visible landmark you're pulling cards toward,
  // not something a pile of card art can bury.
  const keywordLayer = root.append('g');

  // See setGravityMode below — read by cardChargeFor/xForce/yForce (and the
  // tick handler's own hard top-clamp) to switch behavior; changing it alone
  // does nothing until setGravityMode also re-invokes each force's own
  // setter, same "mutating state doesn't take effect until d3 re-initializes"
  // reasoning setForces already relies on for the physics sliders.
  let gravityMode: GravityMode = 'default';

  // A hub's total inward pull is the SUM of every one of its links' strength —
  // with ~12k links across ~290 cards (some cards matching on broad,
  // unconstrained facts have dozens of neighbors), a flat per-link strength
  // let that sum overwhelm a flat repulsion budget and crushed everything
  // toward the center regardless of cardCharge/gravity slider values. Charge
  // below scales with each node's own current-render linkCount (set on the
  // node in render(), before the simulation restarts): more negative (more
  // repulsive) with degree, so a high-degree hub pushes back harder — a
  // sparse 1-2-link card is unaffected either way (sqrt(1) ≈ 1).
  //
  // Off entirely in manaCost mode — repulsion fighting the column pin (see
  // xForce below) would just waste force budget; forceCollide alone already
  // keeps same-column cards from overlapping.
  const cardChargeFor = (d: CardNode) => (gravityMode === 'manaCost' ? 0 : forces.cardCharge * (1 + 0.2 * Math.sqrt(d.linkCount ?? 0)));
  const cardChargeForce = d3.forceManyBody<CardNode>().strength(cardChargeFor).distanceMax(900);

  // Distance/strength are driven by real match quality now (each reason's
  // own share-ratio × budget, plus a deck-qty multiplier — see
  // reasonWeight/qtyMultiplier/linkQuality above), not a proxy count of how
  // many reasons happen to connect a pair. Goal (per this session's design
  // discussion): strongly-specific matches clump tight, broad/generic ones
  // spread out, distinct archetypes read as separated where the data
  // supports it. `qualityNorm` (see recomputeQualityRange above) does the
  // actual 0-1 compression against the active set's own real range; what's
  // left here is just mapping that 0-1 onto each force's own useful range.
  const linkDistanceFor = (d: SimLink) => {
    const tighten = qualityNorm(linkQuality(d, forces));
    return (200 - tighten * 130) * forces.linkDistanceScale;
  };
  const linkStrengthFor = (d: SimLink) => {
    const s = d.source as CardNode;
    const t = d.target as CardNode;
    const avgDegree = Math.max(1, ((s.linkCount ?? 1) + (t.linkCount ?? 1)) / 2);
    const qualityBoost = 0.3 + qualityNorm(linkQuality(d, forces)) * 1.7;
    return Math.min(1, (forces.linkStrength * qualityBoost) / Math.sqrt(avgDegree));
  };
  const linkForce = d3.forceLink<CardNode, SimLink>().id((d) => d.id).distance(linkDistanceFor).strength(linkStrengthFor);

  // Quality's raw range is enormous — a fact shared by hundreds of cards can
  // land in the thousandths once its budget splits that many ways, while a
  // fully exclusive 1:1 match can reach sourceNormBudget*sinkNormBudget — so
  // it's log-compressed here against the CURRENTLY ACTIVE link set's own
  // real min/max (not a fixed constant), which also makes it self-adjusting
  // whenever a filter changes what's on screen or a budget/qtyBoost slider
  // moves. Recomputed by recomputeQualityRange (called from both render()
  // and setForces() below) — qualityNorm() itself just reads the last
  // computed range. Used by linkDistanceFor/linkStrengthFor's own
  // qualityNorm calls below, and by the edge color/opacity gradient in
  // applyEdgeStyle further down.
  let qualityLogFloor = -3;
  let qualityLogCeil = 0;
  function recomputeQualityRange(links: SimLink[]) {
    if (!links.length) {
      qualityLogFloor = -3;
      qualityLogCeil = 0;
      return;
    }
    let min = Infinity;
    let max = -Infinity;
    for (const l of links) {
      const q = linkQuality({ ...l, source: cardNodeById.get(l.a)!, target: cardNodeById.get(l.b)! }, forces);
      if (q < min) min = q;
      if (q > max) max = q;
    }
    qualityLogFloor = Math.log10(Math.max(min, 1e-6));
    qualityLogCeil = Math.max(qualityLogFloor + 0.5, Math.log10(Math.max(max, 1e-6)));
  }
  function qualityNorm(q: number): number {
    if (qualityLogCeil <= qualityLogFloor) return 0.5;
    const v = (Math.log10(Math.max(q, 1e-6)) - qualityLogFloor) / (qualityLogCeil - qualityLogFloor);
    return Math.min(1, Math.max(0, v));
  }

  // "Gravity" toward center instead of forceCenter's hard recentering — keeps the
  // graph roughly on-screen without crushing everything together.
  //
  // manaCost mode leaves this force's own x untouched (irrelevant there —
  // see applyGravityModePins below) but repurposes y: pulls firmly toward
  // the top margin instead of center — strong enough to read as "gravity,"
  // gentle enough that forceCollide can still fight it into a stacked pile
  // rather than a jitter.
  const gravityFor = () => forces.gravity;
  const xForce = d3.forceX<CardNode>(width / 2).strength(gravityFor);
  const yTargetFor = () => (gravityMode === 'manaCost' ? MANA_COST_TOP_MARGIN : height / 2);
  // Deliberately gentle (0.05, not the ~0.7+ a "hard pin" might suggest) — a
  // real column can stack 50+ cards deep, and yForce pulls every single one
  // of them toward the SAME target y each tick; too strong and it wins
  // outright over forceCollide's own separation before collide can push
  // overlapping cards apart, compressing the whole pile into a tight
  // mutually-overlapping clump instead of a real, readably-tall stack. This
  // strength (plus collideForce's own raised iteration count below) is what
  // actually lets the pile grow downward.
  const yStrengthFor = () => (gravityMode === 'manaCost' ? 0.05 : forces.gravity);
  const yForce = d3.forceY<CardNode>(yTargetFor).strength(yStrengthFor);
  // manaCost mode's actual column lock — d3's own `fx` (a node with this set
  // completely ignores every x-directed force, forceLink's pull included —
  // there's no spring/strength to tune here, unlike the yForce above, so a
  // strongly-interlinked cluster's own mutual pull (kept fully active per
  // this mode's own design) can visibly tug at a lighter spring-based pin
  // but literally cannot move a fixed one). Applied to every node up front
  // (not just the active/filtered subset) since cardNodeById already holds
  // the WHOLE corpus — a card's column position shouldn't reset just because
  // it left and re-entered the active filter.
  // Also seeds `y` into an already-spread stack per column (instead of
  // leaving every node clumped at whatever y it last had) — collide/yForce
  // only need to fix small overlaps from there instead of untangling dozens
  // of coincident nodes, which is what made manaCost mode take ages to settle.
  function applyGravityModePins() {
    if (gravityMode === 'manaCost') {
      const columnCounts = new Array(MANA_COST_COLUMNS).fill(0);
      for (const node of cardNodeById.values()) {
        const bucket = cmcBucket(node.cmc);
        node.fx = manaCostColumnX(node.cmc);
        node.y = MANA_COST_TOP_MARGIN + columnCounts[bucket]! * (TOTAL_HEIGHT + 6);
        node.vy = 0;
        columnCounts[bucket]++;
      }
    } else {
      for (const node of cardNodeById.values()) delete node.fx;
    }
  }
  applyGravityModePins();
  const collideRadiusFor = () => cardRadius() + 4 * forces.collidePadding;
  // More relaxation passes per tick in manaCost mode — a single pass (d3's
  // own default) resolves a sparse, spread-out default-mode graph fine, but
  // a manaCost column can pack dozens of same-x cards fighting yForce's pull
  // toward one shared target; one pass a tick just isn't enough correction
  // for that many simultaneous overlaps to fully separate.
  // Arrow function (not an inline ternary at this top-level scope) — TS's
  // narrowing otherwise sees no reassignment of `gravityMode` yet this early
  // in the function body (setGravityMode's `gravityMode = mode` is defined
  // further down) and incorrectly narrows it to the literal 'default',
  // flagging the 'manaCost' comparison as unreachable.
  const collideIterationsFor = () => (gravityMode === 'manaCost' ? 4 : 1);
  const collideForce = d3.forceCollide<CardNode>(collideRadiusFor).iterations(collideIterationsFor());

  const simulation = d3
    .forceSimulation<CardNode>()
    .force('link', linkForce)
    .force('charge', cardChargeForce)
    .force('x', xForce)
    .force('y', yForce)
    .force('collide', collideForce)
    .force('keywordHub', keywordHubForce)
    .alphaDecay(forces.alphaDecay)
    .velocityDecay(forces.velocityDecay);

  function setForces(next: Partial<ForceConfig>) {
    Object.assign(forces, next);
    // Re-invoking each setter forces d3 to recompute its cached per-node/per-link
    // strength arrays — mutating `forces` alone wouldn't take effect until then.
    cardChargeForce.strength(cardChargeFor);
    linkForce.distance(linkDistanceFor).strength(linkStrengthFor);
    xForce.strength(gravityFor);
    yForce.strength(yStrengthFor);
    collideForce.radius(collideRadiusFor);
    simulation.alphaDecay(forces.alphaDecay).velocityDecay(forces.velocityDecay);
    simulation.alpha(0.5).restart();
    // sourceNormBudget/sinkNormBudget/qtyBoost all feed into linkQuality, so
    // the active set's own quality range (and therefore the edge gradient)
    // can shift even though the filtered set of links itself didn't change.
    recomputeQualityRange(currentActiveLinks);
    applyEdgeStyle();
  }

  function getForces(): ForceConfig {
    return { ...forces };
  }

  // Switches the whole layout style — see applyGravityModePins/yTargetFor/
  // cardChargeFor above for what actually changes per mode. Re-invoking each
  // setter (same "d3 caches per-node arrays at initialize time" reasoning
  // setForces above already relies on) is what makes yForce/cardCharge's new
  // strength actually take effect on the CURRENT node set.
  function setGravityMode(mode: GravityMode) {
    gravityMode = mode;
    applyGravityModePins();
    cardChargeForce.strength(cardChargeFor);
    yForce.strength(yStrengthFor);
    collideForce.iterations(collideIterationsFor());
    simulation.alpha(1).restart();
  }

  function getGravityMode(): GravityMode {
    return gravityMode;
  }

  // manaCost mode keeps every node's `fx` hard-pinned to its column
  // (applyGravityModePins) — without gating here, dragstarted/dragged would
  // stomp that pin with the raw cursor x, letting a dragged card wander off
  // its rail. `fy` behaves the same in both modes: pin while dragging, free
  // on release so the node re-settles under collide/gravity.
  function drag() {
    function dragstarted(event: any, d: CardNode) {
      if (!event.active) simulation.alphaTarget(0.2).restart();
      d.fx = gravityMode === 'manaCost' ? manaCostColumnX(d.cmc) : d.x;
      d.fy = d.y;
    }
    function dragged(event: any, d: CardNode) {
      if (gravityMode !== 'manaCost') d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event: any, d: CardNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = gravityMode === 'manaCost' ? manaCostColumnX(d.cmc) : null;
      d.fy = null;
    }
    return d3.drag<any, CardNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended);
  }

  let link = linkLayer.selectAll<SVGPathElement, VisualEdge>('path.link');
  let cardG = cardLayer.selectAll<SVGGElement, CardNode>('g.node-card');
  let keywordLink = keywordLinkLayer.selectAll<SVGLineElement, KeywordLinkDatum>('line.keyword-link');
  let keywordG = keywordLayer.selectAll<SVGGElement, KeywordHubState>('g.node-keyword');

  let searchQuery = '';
  let cardSelection = new Set<string>();

  // Last render()'s active link set — kept around so setForces() (a budget/
  // qtyBoost slider moving, with the filtered set unchanged) can recompute
  // the quality range and edge gradient without needing a fresh render().
  let currentActiveLinks: SimLink[] = [];

  // Visible strength gradient — dim/desaturated for a weak (widely-shared)
  // match, full `--color-produce` green for a strong (narrowly-specific)
  // one, opacity rising alongside it so the strongest edges also stand out
  // against the weakest rather than just changing hue. Colors interpolated
  // (not read from the CSS var) since d3's interpolator needs concrete
  // endpoints — kept in sync with main.css's own --color-produce by hand.
  const edgeColorScale = d3.interpolateRgb('#33383f', '#2ecc71');
  function applyEdgeStyle() {
    link
      .style('stroke', (d) => edgeColorScale(qualityNorm(linkQuality(d.parent, forces))))
      .style('opacity', (d) => 0.15 + qualityNorm(linkQuality(d.parent, forces)) * 0.65);
  }

  function render(filters: AttrFilters, options: RenderOptions = {}) {
    const { sourceSinkOnly = false, keywordIds = EMPTY_KEYWORD_IDS } = options;
    const activeCardNodes = graph.cards.filter((c) => passesAttrFilters(c, filters)).map((c) => cardNodeById.get(c.id)!);
    const activeCardIdSet = new Set(activeCardNodes.map((c) => c.id));

    const nodeFilteredLinks: SimLink[] = graph.links
      .filter((l) => activeCardIdSet.has(l.a) && activeCardIdSet.has(l.b))
      .map((l) => ({ source: l.a, target: l.b, reasons: l.reasons, a: l.a, b: l.b }));

    // Source-Sink mode narrows each link down to just its qualifying
    // directed reasons (a link whose OTHER reasons don't qualify still
    // shows, just with fewer lanes) and drops any link left with none —
    // done here, before this becomes both the simulation's own link set AND
    // the visual fan-out below, so an edge hidden by this filter also stops
    // pulling its two cards together physically, not just stops being drawn.
    //
    // Checkbox polarity is deliberately inverted from what its own
    // `showSourceSinkOnly` field name/label would suggest — UNCHECKED
    // (`sourceSinkOnly === false`) applies the isolate filter, CHECKED shows
    // the full untouched graph. Confirmed direction (not a leftover bug): a
    // prior pass had this the "natural" way round (checked = isolate) and
    // that was reported back as backwards, twice, against the live app — the
    // isolate/degree computation itself was independently verified correct
    // both times (filters.ts's isSourceSinkReason/computeNodeDegrees), so
    // this negation is the ONLY change; don't "fix" it back without
    // re-confirming against the live checkbox first.
    const activeLinks: SimLink[] = sourceSinkOnly
      ? nodeFilteredLinks
      : nodeFilteredLinks
          .map((l) => ({ ...l, reasons: l.reasons.filter((r) => isSourceSinkReason(reasonSource(l, r), reasonTarget(l, r), nodeDegrees)) }))
          .filter((l) => l.reasons.length > 0);

    // One VisualEdge per reason (not per pair) — this is the only place a
    // pair's relations fan out into separate arrows; `activeLinks` above
    // stays exactly one entry per pair, so the simulation below never sees
    // (and can't be affected by) how many relations a pair actually has.
    const activeEdges: VisualEdge[] = activeLinks.flatMap((l) =>
      l.reasons.map((r, i) => ({
        parent: l,
        fromA: r.from === 'a',
        laneIndex: i,
        laneCount: l.reasons.length,
        description: r.description,
      }))
    );

    currentActiveLinks = activeLinks;
    recomputeQualityRange(activeLinks);

    // Recomputed every render (filters change which links are active) and read
    // by cardChargeFor/linkStrengthFor above — must be set on the actual node
    // objects before simulation.nodes()/links() below, since d3 resolves link
    // source/target ids to node objects and computes the strength arrays
    // synchronously inside that same links() call.
    for (const node of activeCardNodes) node.linkCount = 0;
    for (const l of activeLinks) {
      cardNodeById.get(l.source as string)!.linkCount!++;
      cardNodeById.get(l.target as string)!.linkCount!++;
    }

    link = link
      .data(activeEdges, (d) => `${d.parent.a}-${d.parent.b}-${d.description}`)
      .join((enter) => enter.append('path').attr('class', 'link').attr('fill', 'none').attr('marker-end', 'url(#link-arrow)'));
    applyEdgeStyle();

    cardG = cardG
      .data(activeCardNodes, (d) => d.id)
      .join((enter) => {
        const g = enter
          .append('g')
          .attr('class', 'node-card')
          .call(drag() as any)
          .on('mouseenter', (event, d) => {
            const neighbors = (linksByCard.get(d.id) ?? [])
              .filter((n) => activeCardIdSet.has(n.card))
              .map((n) => ({ card: cardNodeById.get(n.card)!, reasons: n.reasons }));
            handlers.onCardHover(d, neighbors, event);
          })
          .on('mousemove', (event) => handlers.onHoverMove(event))
          .on('mouseleave', () => handlers.onHoverEnd())
          .on('click', (event, d) => handlers.onCardClick(d, event));
        renderCardArt(g);
        return g;
      });

    // Keyword hubs (see keywordHubForce/updateKeywordHubs above) — membership
    // is scoped to activeCardNodes (the same node-attr-filtered set the real
    // graph uses), so unchecking a color that happened to be a hub's only
    // member leaves that hub drawn but pulling nothing, same as a real
    // synergy edge would.
    updateKeywordHubs(activeCardNodes, keywordIds);
    const activeKeywordHubs = [...keywordHubsById.values()];
    const keywordLinkData: KeywordLinkDatum[] = activeKeywordHubs.flatMap((hub) => hub.memberIds.map((cardId) => ({ hub, cardId })));

    keywordLink = keywordLink
      .data(keywordLinkData, (d) => `${d.hub.id}::${d.cardId}`)
      .join((enter) => enter.append('line').attr('class', 'keyword-link'));

    keywordG = keywordG
      .data(activeKeywordHubs, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'node-keyword').call(keywordDrag() as any);
        // Per-datum (not one shared .attr/.text chain across the whole enter
        // selection) — whether a hub gets an icon at all depends on its own
        // label, so each hub's inner markup is built individually, same
        // pattern renderCardArt's own keyword-icon strip uses.
        g.each(function (d) {
          const cell = d3.select(this);
          // Soft blurred glow instead of a hard stroke, and a fairly
          // translucent (not fully opaque) fill — reads as a quiet, relaxed
          // landmark rather than a rigid disc competing with the crisp card
          // art around it. Reuses the SAME glow filter card nodes' own
          // outline uses (defs, near the top of this function) rather than a
          // second near-identical filter def.
          cell.append('circle').attr('r', KEYWORD_HUB_RADIUS).attr('fill', KEYWORD_HUB_COLOR).attr('fill-opacity', 0.62).attr('filter', 'url(#card-outline-glow)');

          // Reuses the exact glyph set the card-node keyword badge strip
          // uses (ABILITY_ICON_PATHS/VIEWBOX, abilityIconKey — see
          // renderCardArt's own "Keyword ability icons" block) so a hub's
          // icon matches its keyword's badge on every card carrying it,
          // rather than a second icon source. Silently omitted (label only,
          // same layout as before) for a keyword with no matching glyph
          // (BADGE_KEYWORDS' own "Crew" has none).
          const iconKey = abilityIconKey(d.label);
          const hasIcon = !!ABILITY_ICON_PATHS[iconKey];
          if (hasIcon) {
            cell
              .append('svg')
              .attr('x', -KEYWORD_HUB_ICON_SIZE / 2)
              .attr('y', -KEYWORD_HUB_RADIUS * 0.5)
              .attr('width', KEYWORD_HUB_ICON_SIZE)
              .attr('height', KEYWORD_HUB_ICON_SIZE)
              .attr('viewBox', ABILITY_ICON_VIEWBOX[iconKey]!)
              .attr('pointer-events', 'none')
              .append('path')
              .attr('d', ABILITY_ICON_PATHS[iconKey]!)
              .attr('fill', '#e9e6f2')
              .attr('fill-rule', 'evenodd');
          }

          // Label stays — the icon is an accent alongside it, not a
          // replacement (a hub's keyword name is still its primary
          // identifier, unlike a card's badge strip where the icon alone is
          // the point). Sits below the icon when one exists, otherwise
          // vertically centered same as before.
          cell
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('y', hasIcon ? KEYWORD_HUB_RADIUS * 0.4 : 0)
            .attr('fill', '#e9e6f2')
            .attr('font-size', 5.5 * NODE_SCALE)
            .attr('font-weight', 700)
            .attr('font-family', TITLE_FONT_FAMILY)
            .attr('pointer-events', 'none')
            .text(d.label);
        });
        return g;
      });

    simulation.nodes(activeCardNodes);
    (simulation.force('link') as d3.ForceLink<CardNode, SimLink>).links(activeLinks);
    simulation.alpha(0.6).restart();

    refreshHighlight();
  }

  // Search text and a single pinned "lookup" card (the card-lookup dropdown) feed
  // the same highlight pass — they compound rather than fight each other: matches
  // from any source (and their direct neighbors) glow, everything else dims.
  let lookupCardId: string | null = null;
  function refreshHighlight() {
    const q = searchQuery.trim().toLowerCase();
    const hasSearch = q.length > 0;
    const hasLookup = lookupCardId != null;
    const hasCardSelection = cardSelection.size > 0;

    if (!hasSearch && !hasLookup && !hasCardSelection) {
      cardG.classed('search-match', false).classed('search-dim', false);
      link.classed('search-dim', false);
      return;
    }

    const matchedCardIds = new Set<string>(cardSelection);
    if (hasSearch) {
      for (const c of graph.cards) if (c.name.toLowerCase().includes(q)) matchedCardIds.add(c.id);
    }
    if (lookupCardId) matchedCardIds.add(lookupCardId);

    // A matched card shows all of its links, including to non-matched neighbors —
    // the point of matching a card is seeing everything it connects to.
    const relevantCardIds = new Set(matchedCardIds);
    for (const cardId of matchedCardIds) {
      for (const { card } of linksByCard.get(cardId) ?? []) relevantCardIds.add(card);
    }

    cardG.classed('search-match', (d) => matchedCardIds.has(d.id)).classed('search-dim', (d) => !relevantCardIds.has(d.id));
    link.classed('search-dim', (d) => {
      const sourceId = (d.parent.source as CardNode).id;
      const targetId = (d.parent.target as CardNode).id;
      return !matchedCardIds.has(sourceId) && !matchedCardIds.has(targetId);
    });
  }

  function applySearch(query: string) {
    searchQuery = query;
    refreshHighlight();
  }

  function setCardSelection(ids: ReadonlySet<string>) {
    cardSelection = new Set(ids);
    refreshHighlight();
  }

  function setLookupHighlight(cardId: string | null) {
    lookupCardId = cardId;
    refreshHighlight();
  }

  // Straight line for a pair's only relation; a quadratic curve, offset
  // sideways by lane index, when more than one relation shares the same
  // pair — so each gets its own visible arrow instead of stacking into one
  // indistinguishable line. The arrival point is trimmed back by the
  // target's own radius (+ a small gap) so the arrowhead marker lands just
  // outside the node instead of underneath its opaque fill.
  function edgePath(d: VisualEdge): string {
    const s = (d.fromA ? d.parent.source : d.parent.target) as CardNode;
    const t = (d.fromA ? d.parent.target : d.parent.source) as CardNode;
    const sx = s.x!;
    const sy = s.y!;
    let tx = t.x!;
    let ty = t.y!;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const gap = cardRadius() + EDGE_ARROW_GAP;
    tx -= (dx / dist) * gap;
    ty -= (dy / dist) * gap;

    if (d.laneCount <= 1) return `M${sx},${sy}L${tx},${ty}`;
    const nx = -dy / dist;
    const ny = dx / dist;
    const offset = (d.laneIndex - (d.laneCount - 1) / 2) * EDGE_LANE_SPACING;
    const mx = (sx + tx) / 2 + nx * offset;
    const my = (sy + ty) / 2 + ny * offset;
    return `M${sx},${sy}Q${mx},${my} ${tx},${ty}`;
  }

  simulation.on('tick', () => {
    link.attr('d', edgePath);
    cardG.attr('transform', (d) => {
      // Hard stop at the top — yForce above only pulls toward it (a spring,
      // which can overshoot on its way there), this is the actual floor a
      // manaCost-mode node can never render past. Zeroing vy alongside it
      // (only when it's still pushing further up) stops it from building
      // unbounded upward velocity against a wall it can never cross — left
      // alone, that velocity would eventually fling the node back down hard
      // once something (a neighbor's collide) finally let it through.
      if (gravityMode === 'manaCost' && d.y! < MANA_COST_TOP_MARGIN) {
        d.y = MANA_COST_TOP_MARGIN;
        if ((d.vy ?? 0) < 0) d.vy = 0;
      }
      return `translate(${d.x},${d.y})`;
    });
    keywordG.attr('transform', (d) => `translate(${d.x},${d.y})`);
    keywordLink.each(function (d) {
      const member = cardNodeById.get(d.cardId);
      if (!member || member.x == null || member.y == null) return;
      d3.select(this).attr('x1', d.hub.x).attr('y1', d.hub.y).attr('x2', member.x).attr('y2', member.y);
    });
  });

  // "Rerender from the ground up" — clears every node's position (and any pinned
  // drag position) so the simulation starts over from d3's default random scatter
  // instead of wherever it previously settled, for when a layout got stuck clumped
  // up and no amount of force-slider tweaking un-sticks it.
  function resetLayout(filters: AttrFilters, options: RenderOptions = {}) {
    for (const node of cardNodeById.values()) {
      delete node.x;
      delete node.y;
      delete node.vx;
      delete node.vy;
      delete node.fx;
      delete node.fy;
    }
    // Any existing hub gets dropped too — its old x/y was a centroid of
    // positions that no longer exist, so keeping it around would seed the
    // fresh layout from a stale, meaningless spot instead of re-seeding
    // clean once cards resettle (updateKeywordHubs recreates it on the very
    // next render() call below, same as an initial check would).
    keywordHubsById.clear();
    // A "rerender" while in manaCost mode should still respect its own
    // column lock — without this, clearing fx above would have re-freed
    // every node to drift horizontally again until something else
    // re-applied it.
    applyGravityModePins();
    render(filters, options);
    simulation.alpha(1).restart();
  }

  function destroy() {
    simulation.stop();
    svg.selectAll('*').remove();
  }

  return { render, applySearch, setCardSelection, setLookupHighlight, setForces, getForces, setGravityMode, getGravityMode, resetLayout, destroy };
}

