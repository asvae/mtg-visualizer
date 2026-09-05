import * as d3 from 'd3';
import type { CardData, GraphFile, GraphReason } from '../types';
import { COLOR_MAP, COLORLESS } from './constants';
import { passesAttrFilters, type AttrFilters } from './filters';

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
  weight: number | null;
}

// Average combined weight (see GraphReason's own doc comment — 1-25, or null
// for a reason predating the weight fields) across a pair's distinct reasons.
// Missing weights count as 1 (the real floor, "verified minimum-strength
// match") rather than being skipped — an unweighted reason is real, verified
// output, not a gap to ignore.
function linkQuality(d: SimLink): number {
  const total = d.reasons.reduce((sum, r) => sum + (r.weight ?? 1), 0);
  return total / d.reasons.length;
}

export interface ForceConfig {
  cardCharge: number; // repulsion strength for card nodes
  gravity: number; // pull toward center (forceX/forceY strength)
  linkStrength: number; // how tightly a link pulls its two ends together
  linkDistanceScale: number; // multiplies the link distance (1 = default)
  collidePadding: number; // multiplies the extra spacing enforced around each node
  alphaDecay: number; // how fast the simulation "cools" — lower keeps it moving longer
  velocityDecay: number; // friction — lower means more momentum/bounce
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
};

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
// the image already IS the shape once sized to this box. RECT_HEIGHT keeps
// the same overall footprint the old circle diameter had; RECT_WIDTH scales
// it by Scryfall's typical (not universal — real art_crop dimensions vary
// per card, some are portrait) art_crop aspect ratio, ~626x457.
const RECT_HEIGHT = 40;
const ART_ASPECT = 626 / 457;
const RECT_WIDTH = RECT_HEIGHT * ART_ASPECT;
const CORNER_RADIUS = 4;

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
  return RECT_WIDTH / 2;
}

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
    const y = -RECT_HEIGHT / 2;
    // Blurred glow drawn UNDER the art/fill — the opaque node covers its
    // inward half, so only the outward-blurred edge shows, like a soft glow
    // rather than a blur across the art itself. Four separate inset edge
    // segments (not a single rect outline) — a joined rect's corners get two
    // strokes overlapping at the 90° turn, and blurring that double coverage
    // reads as a bright hot spot; stopping each edge short of the corner
    // avoids the overlap, so the glow concentrates on the flat top/sides and
    // fades out approaching each corner instead.
    const glowGroup = g.append('g').attr('class', 'card-glow').attr('filter', 'url(#card-outline-glow)');
    const inset = 8;
    const edges: [number, number, number, number][] = [
      [x + inset, y, x + RECT_WIDTH - inset, y], // top
      [x + inset, y + RECT_HEIGHT, x + RECT_WIDTH - inset, y + RECT_HEIGHT], // bottom
      [x, y + inset, x, y + RECT_HEIGHT - inset], // left
      [x + RECT_WIDTH, y + inset, x + RECT_WIDTH, y + RECT_HEIGHT - inset], // right
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
    if (!art) {
      g.append('rect')
        .attr('class', 'card-shape')
        .attr('x', x)
        .attr('y', y)
        .attr('width', RECT_WIDTH)
        .attr('height', RECT_HEIGHT)
        .attr('rx', CORNER_RADIUS)
        .attr('fill', cardFill(d));
    } else {
      g.append('image')
        .attr('class', 'card-shape')
        .attr('href', art)
        .attr('x', x)
        .attr('y', y)
        .attr('width', RECT_WIDTH)
        .attr('height', RECT_HEIGHT)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        // `rx`/`ry` on <image> itself is inconsistently supported across
        // browsers — a clipPath (defined once in defs, reused by every node
        // via the same local coordinate space each node's own <g> transform
        // already provides) is the reliable way to round an image's corners.
        .attr('clip-path', 'url(#card-clip)');
    }
    g.append('rect')
      .attr('class', 'card-outline')
      .attr('rx', CORNER_RADIUS)
      .attr('x', x)
      .attr('y', y)
      .attr('width', RECT_WIDTH)
      .attr('height', RECT_HEIGHT)
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 0.3);

    // Scryfall shortcut — hidden until the node is hovered (see the
    // `.scryfall-link` CSS rule in GraphCanvas.vue), so it doesn't compete
    // with the art at rest. Its own click handler stops propagation so it
    // opens Scryfall instead of falling through to the node's own click
    // handler (which opens this card's OWN page — see onCardClick in
    // GraphCanvas.vue). Icon is lucide's own `external-link` glyph (same
    // one Nuxt Icon would render as `i-lucide-external-link`), inlined as a
    // raw path rather than going through the Icon component — this whole
    // node is a plain D3-appended <g>, not Vue template output.
    const scryfallBoxSize = 11;
    const scryfallX = x + RECT_WIDTH - scryfallBoxSize - 2;
    const scryfallY = y + 2;
    const scryfallCx = scryfallX + scryfallBoxSize / 2;
    const scryfallCy = scryfallY + scryfallBoxSize / 2;
    const scryfallIconSize = 7;
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
      const bw = 8 + badgeText.length * 5.5;
      const bh = 12;
      const bx = x + RECT_WIDTH - bw + 3;
      const by = y + RECT_HEIGHT - bh + 3;
      const badge = g.append('g').attr('class', 'card-qty-badge');
      badge.append('rect').attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh).attr('rx', 3).attr('fill', '#000').attr('fill-opacity', 0.78);
      badge
        .append('text')
        .attr('x', bx + bw / 2)
        .attr('y', by + bh / 2 + 3)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9)
        .attr('font-weight', 700)
        .attr('fill', '#fff')
        .text(badgeText);
    }
  });
}

function drag(simulation: d3.Simulation<CardNode, SimLink>) {
  function dragstarted(event: any, d: CardNode) {
    if (!event.active) simulation.alphaTarget(0.2).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event: any, d: CardNode) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event: any, d: CardNode) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  return d3.drag<any, CardNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended);
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
export function createGraphRenderer(svgEl: SVGSVGElement, graph: GraphFile, handlers: GraphHandlers) {
  const width = svgEl.clientWidth || window.innerWidth;
  const height = svgEl.clientHeight || window.innerHeight - 60;

  const linksByCard = new Map<string, { card: string; reasons: GraphReason[] }[]>();
  for (const l of graph.links) {
    if (!linksByCard.has(l.a)) linksByCard.set(l.a, []);
    linksByCard.get(l.a)!.push({ card: l.b, reasons: l.reasons });
    if (!linksByCard.has(l.b)) linksByCard.set(l.b, []);
    linksByCard.get(l.b)!.push({ card: l.a, reasons: l.reasons });
  }

  const cardNodeById = new Map<string, CardNode>();
  for (const c of graph.cards) cardNodeById.set(c.id, { ...c, kind: 'card' });

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

  // Rounds the art image's corners — clipPathUnits defaults to
  // userSpaceOnUse, so this rect's coordinates are read in whichever node
  // <g>'s local space is referencing it at render time, meaning one shared
  // clipPath (not one per node) works for every node.
  defs
    .append('clipPath')
    .attr('id', 'card-clip')
    .append('rect')
    .attr('x', -RECT_WIDTH / 2)
    .attr('y', -RECT_HEIGHT / 2)
    .attr('width', RECT_WIDTH)
    .attr('height', RECT_HEIGHT)
    .attr('rx', CORNER_RADIUS);

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
  const cardLayer = root.append('g');

  // A hub's total inward pull is the SUM of every one of its links' strength —
  // with ~12k links across ~290 cards (some cards matching on broad,
  // unconstrained facts have dozens of neighbors), a flat per-link strength
  // let that sum overwhelm a flat repulsion budget and crushed everything
  // toward the center regardless of cardCharge/gravity slider values. Charge
  // below scales with each node's own current-render linkCount (set on the
  // node in render(), before the simulation restarts): more negative (more
  // repulsive) with degree, so a high-degree hub pushes back harder — a
  // sparse 1-2-link card is unaffected either way (sqrt(1) ≈ 1).
  const cardChargeFor = (d: CardNode) => forces.cardCharge * (1 + 0.2 * Math.sqrt(d.linkCount ?? 0));
  const cardChargeForce = d3.forceManyBody<CardNode>().strength(cardChargeFor).distanceMax(900);

  // Distance/strength are driven by real match quality now (functional-model's
  // value field on both source and sink facts — see
  // functional-model/synergy.ts's factTotal and GraphReason.weight in
  // server/api/graph-links.ts — combined into linkQuality above), not a proxy
  // count of how many reasons happen to connect a pair. Goal (per this
  // session's design discussion): strongly-specific matches clump tight,
  // broad/generic ones spread out, distinct archetypes read as separated
  // where the data supports it. Exact constants below are a first pass,
  // expected to need retuning against how the real weighted pool actually
  // looks once rendered — not a principled derivation.
  //
  // quality's theoretical range is 1-25 (factTotal's own produce-strength ×
  // want-strength), but the real pool (checked live against the whole
  // graph-links.ts output)
  // only ever reaches ~10 — no pair currently maxes out both sides at once.
  // Divisors below are tuned against that REAL ~1-10 range, not the
  // theoretical ceiling (an earlier pass here divided by 6/3, tuned for a
  // stale ~1-21 estimate under the old 3-field weight scheme — that made the
  // strong end barely distinguishable from the weak end once the field
  // redesign shrank the real range further). sqrt still compresses the tail;
  // the "no boost, no penalty" crossover sits around quality ~2.5 now.
  const linkDistanceFor = (d: SimLink) => {
    const tighten = Math.min(1, Math.sqrt(linkQuality(d)) / 3.2);
    return (200 - tighten * 130) * forces.linkDistanceScale;
  };
  const linkStrengthFor = (d: SimLink) => {
    const s = d.source as CardNode;
    const t = d.target as CardNode;
    const avgDegree = Math.max(1, ((s.linkCount ?? 1) + (t.linkCount ?? 1)) / 2);
    const qualityBoost = Math.min(2, Math.sqrt(linkQuality(d)) / 1.6);
    return Math.min(1, (forces.linkStrength * qualityBoost) / Math.sqrt(avgDegree));
  };
  const linkForce = d3.forceLink<CardNode, SimLink>().id((d) => d.id).distance(linkDistanceFor).strength(linkStrengthFor);

  // "Gravity" toward center instead of forceCenter's hard recentering — keeps the
  // graph roughly on-screen without crushing everything together.
  const gravityFor = () => forces.gravity;
  const xForce = d3.forceX<CardNode>(width / 2).strength(gravityFor);
  const yForce = d3.forceY<CardNode>(height / 2).strength(gravityFor);
  const collideRadiusFor = () => cardRadius() + 4 * forces.collidePadding;
  const collideForce = d3.forceCollide<CardNode>(collideRadiusFor);

  const simulation = d3
    .forceSimulation<CardNode>()
    .force('link', linkForce)
    .force('charge', cardChargeForce)
    .force('x', xForce)
    .force('y', yForce)
    .force('collide', collideForce)
    .alphaDecay(forces.alphaDecay)
    .velocityDecay(forces.velocityDecay);

  function setForces(next: Partial<ForceConfig>) {
    Object.assign(forces, next);
    // Re-invoking each setter forces d3 to recompute its cached per-node/per-link
    // strength arrays — mutating `forces` alone wouldn't take effect until then.
    cardChargeForce.strength(cardChargeFor);
    linkForce.distance(linkDistanceFor).strength(linkStrengthFor);
    xForce.strength(gravityFor);
    yForce.strength(gravityFor);
    collideForce.radius(collideRadiusFor);
    simulation.alphaDecay(forces.alphaDecay).velocityDecay(forces.velocityDecay);
    simulation.alpha(0.5).restart();
  }

  function getForces(): ForceConfig {
    return { ...forces };
  }

  let link = linkLayer.selectAll<SVGPathElement, VisualEdge>('path.link');
  let cardG = cardLayer.selectAll<SVGGElement, CardNode>('g.node-card');

  let searchQuery = '';
  let cardSelection = new Set<string>();

  function render(filters: AttrFilters) {
    const activeCardNodes = graph.cards.filter((c) => passesAttrFilters(c, filters)).map((c) => cardNodeById.get(c.id)!);
    const activeCardIdSet = new Set(activeCardNodes.map((c) => c.id));

    const activeLinks: SimLink[] = graph.links
      .filter((l) => activeCardIdSet.has(l.a) && activeCardIdSet.has(l.b))
      .map((l) => ({ source: l.a, target: l.b, reasons: l.reasons, a: l.a, b: l.b }));

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
        weight: r.weight,
      }))
    );

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
      .join((enter) => enter.append('path').attr('class', 'link').attr('fill', 'none').attr('marker-end', 'url(#link-arrow)').attr('opacity', 0.4));

    cardG = cardG
      .data(activeCardNodes, (d) => d.id)
      .join((enter) => {
        const g = enter
          .append('g')
          .attr('class', 'node-card')
          .call(drag(simulation) as any)
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
    cardG.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  // "Rerender from the ground up" — clears every node's position (and any pinned
  // drag position) so the simulation starts over from d3's default random scatter
  // instead of wherever it previously settled, for when a layout got stuck clumped
  // up and no amount of force-slider tweaking un-sticks it.
  function resetLayout(filters: AttrFilters) {
    for (const node of cardNodeById.values()) {
      delete node.x;
      delete node.y;
      delete node.vx;
      delete node.vy;
      delete node.fx;
      delete node.fy;
    }
    render(filters);
    simulation.alpha(1).restart();
  }

  function destroy() {
    simulation.stop();
    svg.selectAll('*').remove();
  }

  return { render, applySearch, setCardSelection, setLookupHighlight, setForces, getForces, resetLayout, destroy };
}

