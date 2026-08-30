import * as d3 from 'd3';
import type { CardData, GraphFile, Role, ThemeData } from '../types';
import { ROLES } from '../types';
import { COLOR_MAP, COLORLESS, RARITY_COLOR } from './constants';
import { passesAttrFilters, computeWeakThemeIds, type AttrFilters } from './filters';

type CardNode = CardData & { kind: 'card'; isWeakOnly: boolean } & d3.SimulationNodeDatum;
type ThemeNode = ThemeData & { kind: 'theme'; roleCounts: Record<Role, number>; isWeak: boolean } & d3.SimulationNodeDatum;
// Two invisible, fixed points every theme is bound to (via anchorLinkForce) depending
// on whether it's weak or strong — see the comment above anchorLinkForce.
type AnchorNode = { kind: 'anchor'; id: string } & d3.SimulationNodeDatum;
type SimNode = CardNode | ThemeNode | AnchorNode;
type SimLink = d3.SimulationLinkDatum<SimNode> & { role: Role; weight: number };

const DASH_PATTERN = '5 5';

function emptyRoleCounts(): Record<Role, number> {
  return Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>;
}

function roleCountsTotal(rc: Record<Role, number>): number {
  return ROLES.reduce((sum, r) => sum + rc[r], 0);
}

export interface GraphFilters extends AttrFilters {
  selectedThemes: ReadonlySet<string>;
}

export interface ForceConfig {
  themeCharge: number; // repulsion strength for theme hubs (negative = repel)
  cardCharge: number; // repulsion strength for card nodes
  gravity: number; // pull toward center (forceX/forceY strength)
  linkStrength: number; // how tightly a link pulls its two ends together
  linkDistanceScale: number; // multiplies the weight-based link distance (1 = default)
  collidePadding: number; // multiplies the extra spacing enforced around each node
  alphaDecay: number; // how fast the simulation "cools" — lower keeps it moving longer
  velocityDecay: number; // friction — lower means more momentum/bounce
  anchorLinkStrength: number; // how firmly a theme gets pulled back once outside anchorFreeRadius
  anchorFreeRadius: number; // radius around its anchor where a theme feels ~0 pull, free to roam
  anchorSpread: number; // multiplies how far apart the two anchor points are (1 = baseline)
}

export const DEFAULT_FORCES: ForceConfig = {
  themeCharge: -2200,
  cardCharge: -220,
  gravity: 0.008,
  linkStrength: 0.05,
  // linkDistanceScale/collidePadding/velocityDecay are no longer user-tunable
  // (sliders removed) — fixed here. alphaDecay (settle speed) briefly got the same
  // treatment fixed at 0.75, but that cools the simulation almost before it has any
  // ticks to actually spread nodes out from their random start positions — first
  // load stayed clumped. Kept tunable.
  linkDistanceScale: 1,
  collidePadding: 1,
  alphaDecay: 0.02,
  velocityDecay: 0.4,
  // A theme within anchorFreeRadius of its anchor feels ~0 pull from it — free to
  // be positioned entirely by its own cards/links, same as any other theme. Only
  // once it strays past that radius does the anchor pull it back, growing with how
  // far outside the radius it's gotten. anchorSpread: 2 means the two anchors sit
  // twice as far apart as the original baseline placement.
  anchorLinkStrength: 0.15,
  anchorFreeRadius: 1000,
  anchorSpread: 2,
};

export interface GraphHandlers {
  onCardHover(card: CardData, themeEdges: { themeId: string; role: Role; weight: number }[], event: MouseEvent): void;
  onThemeHover(theme: ThemeData & { roleCounts: Record<Role, number> }, event: MouseEvent): void;
  onHoverMove(event: MouseEvent): void;
  onHoverEnd(): void;
  onCardClick(card: CardData): void;
  onThemeClick(theme: ThemeData, event: MouseEvent): void;
  onBackgroundClick(): void;
}

function cardFill(c: CardData): string {
  const ci = c.colorIdentity;
  if (ci.length === 0) return COLORLESS;
  return COLOR_MAP[ci[0]] ?? COLORLESS;
}

// Mana value is meaningless for lands (always 0), so they'd render as the smallest
// possible node next to 0-cost spells — give them a fixed, legible size instead.
function makeCardRadius(cmcScale: d3.ScaleContinuousNumeric<number, number>) {
  return (c: CardData) => (c.typeLine.includes('Land') ? 10 : cmcScale(c.cmc ?? 0));
}

// Multicolor cards render as pie sectors (one wedge per color in their identity)
// instead of a blended gold — gold reads as "a color" when it's actually "many colors".
function renderCardShape(sel: d3.Selection<SVGGElement, CardNode, any, any>, cardRadius: (c: CardData) => number) {
  sel.each(function (d) {
    const g = d3.select(this);
    const rad = cardRadius(d);
    const ci = d.colorIdentity;
    if (ci.length <= 1) {
      g.append('circle').attr('class', 'card-shape').attr('r', rad).attr('fill', cardFill(d));
    } else {
      const arcs = d3.pie<string>().value(() => 1).sort(null)(ci);
      const arcGen = d3.arc<d3.PieArcDatum<string>>().innerRadius(0).outerRadius(rad);
      g.selectAll('path')
        .data(arcs)
        .join('path')
        .attr('class', 'card-shape')
        .attr('d', arcGen)
        .attr('fill', (a) => COLOR_MAP[a.data] ?? COLORLESS);
    }
  });
}

// Rarity indicator: a colored letter (C/U/R/M) centered on the card, with a dark
// outline so it reads against any color-identity fill. Commons stay unmarked.
const RARITY_LABEL_FONT_SIZE = 9;

function renderRarityLabel(sel: d3.Selection<SVGGElement, CardNode, any, any>) {
  sel.each(function (d) {
    if (d.rarity === 'common') return;
    const color = RARITY_COLOR[d.rarity] ?? RARITY_COLOR.common;
    d3.select(this)
      .append('text')
      .attr('class', 'rarity-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      // Fixed regardless of the card's own radius (which scales with mana value) —
      // a rarity letter that shrinks along with a cheap card's small node becomes
      // illegible; readability matters more here than staying inside the circle.
      .attr('font-size', RARITY_LABEL_FONT_SIZE)
      .attr('fill', color)
      .text(d.rarity.charAt(0).toUpperCase());
  });
}

function drag(simulation: d3.Simulation<SimNode, SimLink>) {
  function dragstarted(event: any, d: SimNode) {
    if (!event.active) simulation.alphaTarget(0.2).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event: any, d: SimNode) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event: any, d: SimNode) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  return d3.drag<any, SimNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended);
}

// Owns the entire force-directed graph imperatively: node/edge state, the D3
// simulation, and all SVG rendering. Vue mounts the <svg> once and never touches
// its subtree again — render()/applySearch() mutate the same persistent node
// objects (keyed by id) across calls, so positions/zoom/drag state survive every
// filter or search change instead of getting reset by a template re-render.
export function createGraphRenderer(svgEl: SVGSVGElement, graph: GraphFile, handlers: GraphHandlers) {
  const width = svgEl.clientWidth || window.innerWidth;
  const height = svgEl.clientHeight || window.innerHeight - 60;

  const themeEdgesByCard = new Map<string, { themeId: string; role: Role; weight: number }[]>();
  const cardIdsByTheme = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (!themeEdgesByCard.has(e.card)) themeEdgesByCard.set(e.card, []);
    themeEdgesByCard.get(e.card)!.push({ themeId: e.theme, role: e.role, weight: e.weight });
    if (!cardIdsByTheme.has(e.theme)) cardIdsByTheme.set(e.theme, new Set());
    cardIdsByTheme.get(e.theme)!.add(e.card);
  }

  // weakThemeIds starts empty and is recomputed inside render() (see there) from
  // whichever cards CURRENTLY pass the color/rarity/type filters — the visualizer
  // has no business classifying a theme weak/strong using cards the user has
  // filtered out, so this is never computed from the full unfiltered graph.
  // isWeak/isWeakOnly on the persistent node objects below get corrected by the
  // first render() call (called synchronously right after construction), so the
  // brief all-false initial state here is never actually visible.
  let weakThemeIds = new Set<string>();
  const themeNodeById = new Map<string, ThemeNode>();
  for (const t of graph.themes) {
    themeNodeById.set(t.id, { ...t, kind: 'theme', roleCounts: emptyRoleCounts(), isWeak: false });
  }
  // A card whose EVERY tie is to a weak theme has no strong-theme link pulling it
  // toward center — it needs zero gravity too (see gravityFor below), or its own
  // individual center-gravity fights its link to a theme that's now off near the
  // weak anchor, leaving it stranded somewhere between the two instead of
  // clustering with its theme the same way any other card clusters with its hub.
  const cardNodeById = new Map<string, CardNode>();
  for (const c of graph.cards) cardNodeById.set(c.id, { ...c, kind: 'card', isWeakOnly: false });

  const forces: ForceConfig = { ...DEFAULT_FORCES };

  // Two fixed, invisible points every theme is bound to depending on category —
  // see anchorLinkForce below. Replaces several earlier, more elaborate attempts
  // (a hard pin per isolated theme, a forceRadial "ring" with mutual repulsion to
  // spread themes around it, live-measuring the main clump's extent every tick) —
  // all of which worked but accumulated a lot of interacting special cases. Two
  // fixed points or two links is far less to reason about, at the cost of the
  // separation no longer adapting to the clump's actual live size/shape.
  // ANCHOR_BASE_HALF_GAP * forces.anchorSpread is each anchor's offset from center
  // — spread 1 is the original baseline placement, 2 (the default) doubles it.
  const ANCHOR_BASE_HALF_GAP = width * 0.225;
  const strongAnchor: AnchorNode = { kind: 'anchor', id: '__strong-anchor__', fy: height / 2 };
  const weakAnchor: AnchorNode = { kind: 'anchor', id: '__weak-anchor__', fy: height / 2 };
  const anchorNodes: AnchorNode[] = [strongAnchor, weakAnchor];
  function applyAnchorSpread() {
    const halfGap = ANCHOR_BASE_HALF_GAP * forces.anchorSpread;
    strongAnchor.fx = width / 2 - halfGap;
    weakAnchor.fx = width / 2 + halfGap;
  }
  applyAnchorSpread();

  const cmcExtent = d3.extent(graph.cards, (c) => c.cmc) as [number, number];
  const radiusScale = d3.scaleSqrt().domain([0, cmcExtent[1] || 1]).range([4, 15]);
  const cardRadius = makeCardRadius(radiusScale);

  const edgeStrokeWidth = d3.scaleLinear().domain([1, 3]).range([1, 3.4]).clamp(true);

  // Domain recalibrated live inside render() (see there) from the same
  // currently-filtered roleCounts snapshot — never from the full unfiltered graph.
  // Placeholder [0, 1] here is corrected before the first paint.
  const themeRadius = d3.scaleSqrt().domain([0, 1]).range([20, 65]);
  function themeNodeRadius(t: ThemeNode): number {
    return themeRadius(roleCountsTotal(t.roleCounts));
  }

  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const root = svg.append('g');
  svg.call(
    d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 6])
      .on('zoom', (event) => root.attr('transform', event.transform))
  );
  // Clicking anywhere that isn't a card/theme node clears the theme selection —
  // including edge lines and empty space alike. The graph is dense enough that a
  // literal empty-pixel hit (checking event.target === svgEl) would rarely land;
  // checking for a card/theme ancestor instead makes "click background" reliable.
  svg.on('click', (event) => {
    const target = event.target as Element;
    if (!target.closest('.node-card, .theme')) handlers.onBackgroundClick();
  });

  const linkLayer = root.append('g');
  const themeLayer = root.append('g');
  const cardLayer = root.append('g');

  // Cards and themes both push hard against everything by default — that's what
  // actually spreads a dense multi-hub bipartite graph out instead of link pull
  // collapsing shared cards into the middle of their hubs. Exposed live via
  // setForces() so the values can be tuned interactively instead of only in code.
  // Weak vs. strong themes mostly differ in just one thing: which of the two
  // anchors (strongAnchor/weakAnchor above) they're bound to via anchorForce. Cards
  // aren't bound to anchors directly — they just follow whichever theme(s) they're
  // actually tied to via the normal card-theme links below, so a card naturally
  // ends up near whichever cluster its theme is in.
  // One remaining special case: a weak theme's own repulsion charge is zeroed (a
  // weak-only card's boosted tether, below, is what should determine spacing
  // around it — its own -1400 self-charge would otherwise shove its cards away
  // faster than that tether pulls them back in).
  const isWeakThemeNode = (d: SimNode) => d.kind === 'theme' && (d as ThemeNode).isWeak;
  const cardChargeFor = (d: SimNode) => (d.kind === 'card' ? forces.cardCharge : 0);
  const cardChargeForce = d3.forceManyBody<SimNode>().strength(cardChargeFor).distanceMax(900);
  const themeChargeFor = (d: SimNode) => (d.kind === 'theme' && !isWeakThemeNode(d) ? forces.themeCharge : 0);
  const themeChargeForce = d3.forceManyBody<SimNode>().strength(themeChargeFor).distanceMax(900);
  // Weak themes still need to repel EACH OTHER for breathing room (otherwise
  // collideForce alone is all that keeps them apart, and they end up the tightest-
  // packed cluster in the graph) — but not their own cards, which is exactly why
  // themeChargeFor above zeroes them out of the shared force entirely. A separate
  // force, node list restricted in render() (see weakMutualChargeForce.initialize)
  // to weak themes only on BOTH ends, gets the spacing without the side effect.
  const weakMutualChargeFor = (d: SimNode) => (isWeakThemeNode(d) ? forces.themeCharge : 0);
  const weakMutualChargeForce = d3.forceManyBody<SimNode>().strength(weakMutualChargeFor).distanceMax(900);
  // Every ACTIVE theme (matching whatever render() currently shows — see
  // themeAnchorMap below, rebuilt each render()) is bound to its category's
  // anchor — but NOT as a normal spring. A regular forceLink pulls even when
  // already sitting right on top of its target, competing with the theme's own
  // cards for control of its exact position. This is a threshold/leash instead:
  // zero pull inside anchorFreeRadius (the theme's own links are the "biggest
  // priority" there, fully free to arrange it), growing pull only once it strays
  // past that radius — the anchor's whole job is just keeping each category
  // roughly in its own area, not dictating exact placement within it.
  // A custom d3 force (a plain function + .initialize(nodes)) rather than
  // forceLink, since forceLink's strength/distance are fixed per-link at
  // initialize time — this needs to react to live per-tick distance instead.
  let anchorForceNodes: SimNode[] = [];
  const themeAnchorMap = new Map<string, AnchorNode>();
  function anchorForce(alpha: number) {
    for (const n of anchorForceNodes) {
      if (n.kind !== 'theme' || n.x == null || n.y == null) continue;
      const anchor = themeAnchorMap.get(n.id);
      if (!anchor || anchor.x == null || anchor.y == null) continue;
      const dx = anchor.x - n.x;
      const dy = anchor.y - n.y;
      const dist = Math.hypot(dx, dy) || 1e-6;
      const over = dist - forces.anchorFreeRadius;
      if (over <= 0) continue;
      const k = (forces.anchorLinkStrength * over * alpha) / dist;
      n.vx = (n.vx ?? 0) + dx * k;
      n.vy = (n.vy ?? 0) + dy * k;
    }
  }
  anchorForce.initialize = (nodes: SimNode[]) => {
    anchorForceNodes = nodes;
  };
  // Edge weight (1-3, how central a card is to that theme) scales both how close it
  // sits and how firmly it's held there: a weight-3 edge (e.g. Baron, Airship
  // Kingdom's self-defining tie to Towns Matter) pulls the card in tight against its
  // theme hub, while a weight-1 edge keeps the loose default spacing. linkDistanceScale
  // multiplies the whole thing so the base spacing itself stays tunable too.
  // A weak-only card's edge is boosted and short instead of normal — its theme has
  // zero self-charge (see themeChargeFor above) specifically so it doesn't shove its
  // OWN weak-only cards away, but a normal-strength link alone still wasn't enough
  // to overcome mutual repulsion AMONG a weak theme's own (often 20+) cards in the
  // comparatively empty space out past the main clump — nothing else constrains
  // them the way the dense clump constrains a strong theme's halo, so they'd spread
  // out much further before finding equilibrium. Boosting just their own tether
  // fixes that without touching how any other edge behaves.
  const WEAK_ONLY_LINK_STRENGTH_BOOST = 3;
  const WEAK_ONLY_LINK_DISTANCE_FACTOR = 0.4;
  const isWeakOnlyEdge = (d: SimLink) => (d.source as CardNode).isWeakOnly === true;
  const linkDistanceFor = (d: SimLink) => {
    const base = (200 - ((d.weight - 1) / 2) * 140) * forces.linkDistanceScale;
    return isWeakOnlyEdge(d) ? base * WEAK_ONLY_LINK_DISTANCE_FACTOR : base;
  };
  const linkStrengthFor = (d: SimLink) => {
    const base = forces.linkStrength * (0.6 + 0.4 * (d.weight / 3));
    return isWeakOnlyEdge(d) ? Math.min(1, base * WEAK_ONLY_LINK_STRENGTH_BOOST) : base;
  };
  const linkForce = d3.forceLink<SimNode, SimLink>().id((d) => d.id).distance(linkDistanceFor).strength(linkStrengthFor);
  // "Gravity" toward center instead of forceCenter's hard recentering — keeps the
  // graph roughly on-screen without crushing everything together. Themes get none
  // of it — anchorLinkForce is what determines a theme's general area, generic
  // center-gravity on top of that would just fight it (especially for weak themes,
  // pulling them back toward center against weakAnchor being off to the side).
  // Weak-only cards get none either, for the same reason — their only link is to a
  // theme that's off near the weak anchor, not centered, so their own individual
  // gravity would just pull them away from it instead of letting them cluster.
  const gravityFor = (d: SimNode) => (d.kind === 'card' && !(d as CardNode).isWeakOnly ? forces.gravity : 0);
  const xForce = d3.forceX<SimNode>(width / 2).strength(gravityFor);
  const yForce = d3.forceY<SimNode>(height / 2).strength(gravityFor);
  // collidePadding scales only the EXTRA spacing enforced around each node, not its
  // visual radius — 1 matches the original fixed +10 (theme) / +4 (card) padding.
  // Anchors aren't rendered and have no size, so they don't need collision at all.
  const collideRadiusFor = (d: SimNode) => {
    if (d.kind === 'anchor') return 0;
    return d.kind === 'theme' ? themeNodeRadius(d as ThemeNode) + 10 * forces.collidePadding : cardRadius(d as CardData) + 4 * forces.collidePadding;
  };
  const collideForce = d3.forceCollide<SimNode>(collideRadiusFor);

  const simulation = d3
    .forceSimulation<SimNode>()
    .force('link', linkForce)
    .force('anchor', anchorForce)
    .force('cardCharge', cardChargeForce)
    .force('themeCharge', themeChargeForce)
    .force('weakMutualCharge', weakMutualChargeForce)
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
    themeChargeForce.strength(themeChargeFor);
    weakMutualChargeForce.strength(weakMutualChargeFor);
    linkForce.distance(linkDistanceFor).strength(linkStrengthFor);
    // anchorForce reads forces.anchorLinkStrength/anchorFreeRadius live every tick
    // (see its closure over `forces`) — no explicit resync needed here.
    applyAnchorSpread();
    anchorVisual.selectAll<SVGCircleElement, AnchorNode>('circle').attr('cx', (d) => d.fx!).attr('cy', (d) => d.fy!);
    xForce.strength(gravityFor);
    yForce.strength(gravityFor);
    collideForce.radius(collideRadiusFor);
    simulation.alphaDecay(forces.alphaDecay).velocityDecay(forces.velocityDecay);
    simulation.alpha(0.5).restart();
  }

  function getForces(): ForceConfig {
    return { ...forces };
  }

  let link = linkLayer.selectAll<SVGGElement, SimLink>('g.link');
  let themeG = themeLayer.selectAll<SVGGElement, ThemeNode>('g.theme');
  let cardG = cardLayer.selectAll<SVGGElement, CardNode>('g.node-card');

  let searchQuery = '';
  let themeSelection = new Set<string>();

  function render(filters: GraphFilters) {
    const activeEdges = graph.edges.filter((e) => filters.selectedThemes.has(e.theme));
    const connectedCardIds = new Set(activeEdges.map((e) => e.card));

    // Every card has at least one edge now (untagged cards get a synthetic "No
    // Theme" edge from the tagger), so theme-filter visibility is just: is this
    // card connected to a currently-selected theme?
    const activeCardNodes = graph.cards
      .filter((c) => connectedCardIds.has(c.id) && passesAttrFilters(c, filters))
      .map((c) => cardNodeById.get(c.id)!);

    const activeCardIdSet = new Set(activeCardNodes.map((c) => c.id));
    const visibleEdges = activeEdges.filter((e) => activeCardIdSet.has(e.card));
    const activeLinks: SimLink[] = visibleEdges.map((e) => ({ source: e.card, target: e.theme, role: e.role, weight: e.weight }));

    // How many edges tie this exact card to this exact theme (e.g. a card that both
    // produces AND consumes the same theme) — more than one is itself worth flagging
    // visually, regardless of what either individual role's own dash rule says.
    const pairEdgeCount = new Map<string, number>();
    for (const e of visibleEdges) {
      const key = `${e.card}->${e.theme}`;
      pairEdgeCount.set(key, (pairEdgeCount.get(key) ?? 0) + 1);
    }

    // A theme left with zero visible cards after color/rarity/type filters is pure
    // noise — drop its node entirely even if its checkbox is still checked, rather
    // than showing an empty hub with nothing attached to it.
    const themeIdsWithVisibleCards = new Set(visibleEdges.map((e) => e.theme));
    const activeThemeNodes = graph.themes
      .filter((t) => filters.selectedThemes.has(t.id) && themeIdsWithVisibleCards.has(t.id))
      .map((t) => themeNodeById.get(t.id)!);

    // Filters shrink the actual collection fed to the graph — theme size and the
    // hover breakdown must reflect that same filtered collection, not the full
    // unfiltered set. Mutating the persistent ThemeNode objects in place means the
    // hover handler (which reads the same object) picks this up automatically.
    for (const t of graph.themes) {
      themeNodeById.get(t.id)!.roleCounts = emptyRoleCounts();
    }
    for (const e of visibleEdges) {
      themeNodeById.get(e.theme)!.roleCounts[e.role]++;
    }
    // Bubble size stays calibrated against whatever's currently visible, not a
    // fixed reference from the full unfiltered graph — otherwise sizes would look
    // arbitrary/uncalibrated relative to a heavily filtered-down set.
    const maxRoleTotal = Math.max(1, ...graph.themes.map((t) => roleCountsTotal(themeNodeById.get(t.id)!.roleCounts)));
    themeRadius.domain([0, maxRoleTotal]);

    // Weak/strong is recomputed from whatever the color/rarity/type filters
    // CURRENTLY show (see computeWeakThemeIds) — deliberately a separate pass from
    // the roleCounts above, which also folds in the theme-selection filter; weak
    // classification intentionally ignores that axis, same as the filter panel.
    weakThemeIds = computeWeakThemeIds(graph, filters);
    for (const t of graph.themes) themeNodeById.get(t.id)!.isWeak = weakThemeIds.has(t.id);
    for (const c of graph.cards) {
      const edges = themeEdgesByCard.get(c.id) ?? [];
      cardNodeById.get(c.id)!.isWeakOnly = edges.length > 0 && edges.every((e) => weakThemeIds.has(e.themeId));
    }

    // anchorNodes are always included, regardless of the current filter — they're
    // not rendered and every theme (even a currently-hidden one) still needs them
    // resolvable for anchorLinkForce.
    const activeNodes: SimNode[] = [...activeThemeNodes, ...activeCardNodes, ...anchorNodes];

    link = link
      .data(activeLinks, (d: any) => `${typeof d.source === 'object' ? d.source.id : d.source}->${typeof d.target === 'object' ? d.target.id : d.target}`)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'link');
        g.append('line').attr('class', (d) => `link-base link-${d.role}`);
        g.each(function (d) {
          const width = edgeStrokeWidth(d.weight);
          // Solid = a core resource flow (produce/consume); dashed = every other
          // relation type (atypical, and the former "modifiers" — grant/
          // magnifier — now that each is its own full-fledged role). Also dashed,
          // regardless of role, whenever this card ties to this theme via more
          // than one edge (e.g. both produce AND consume the same theme) — that's
          // its own signal worth flagging visually.
          const multiEdge = (pairEdgeCount.get(`${d.source}->${d.target}`) ?? 1) > 1;
          const needsDash = multiEdge || (d.role !== 'produce' && d.role !== 'consume');
          d3.select(this)
            .select('line.link-base')
            .attr('stroke-width', width)
            .attr('opacity', 0.55)
            .attr('stroke-dasharray', needsDash ? DASH_PATTERN : null);
        });
        return g;
      });

    themeG = themeG
      .data(activeThemeNodes, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'theme').call(drag(simulation) as any);
        g.append('circle')
          .attr('class', (d) => `node-theme${d.isWeak ? ' node-theme-weak' : ''}`)
          .attr('r', (d) => themeNodeRadius(d));
        g.append('text').attr('class', 'theme-label').attr('text-anchor', 'middle').attr('dy', 4).text((d) => d.label);
        g.on('mouseenter', (event, d) => handlers.onThemeHover(d, event))
          .on('mousemove', (event) => handlers.onHoverMove(event))
          .on('mouseleave', () => handlers.onHoverEnd())
          .on('click', (event, d) => handlers.onThemeClick(d, event));
        return g;
      });

    cardG = cardG
      .data(activeCardNodes, (d) => d.id)
      .join((enter) => {
        const g = enter
          .append('g')
          .attr('class', 'node-card')
          .call(drag(simulation) as any)
          .on('mouseenter', (event, d) => handlers.onCardHover(d, themeEdgesByCard.get(d.id) ?? [], event))
          .on('mousemove', (event) => handlers.onHoverMove(event))
          .on('mouseleave', () => handlers.onHoverEnd())
          .on('click', (_event, d) => handlers.onCardClick(d));
        renderCardShape(g, cardRadius);
        renderRarityLabel(g);
        return g;
      });

    simulation.nodes(activeNodes);
    // simulation.nodes() just re-initialized weakMutualChargeForce against the full
    // activeNodes list — restrict it back to weak themes only, on both ends.
    weakMutualChargeForce.initialize(
      activeNodes.filter((n) => n.kind === 'theme' && (n as ThemeNode).isWeak),
      Math.random
    );
    (simulation.force('link') as d3.ForceLink<SimNode, SimLink>).links(activeLinks);
    themeAnchorMap.clear();
    for (const t of activeThemeNodes) themeAnchorMap.set(t.id, weakThemeIds.has(t.id) ? weakAnchor : strongAnchor);
    simulation.alpha(0.6).restart();

    refreshHighlight();
  }

  // Search text, clicked-theme selection, and a single pinned "lookup" card (the
  // card-lookup dropdown) all feed the SAME highlight pass — they compound rather
  // than fight each other: matches from any source (and their direct neighbors)
  // glow, everything else dims. Dimming instead of hiding keeps context while
  // pointing at relevance.
  let lookupCardId: string | null = null;
  function refreshHighlight() {
    const q = searchQuery.trim().toLowerCase();
    const hasSearch = q.length > 0;
    const hasSelection = themeSelection.size > 0;
    const hasLookup = lookupCardId != null;

    if (!hasSearch && !hasSelection && !hasLookup) {
      cardG.classed('search-match', false).classed('search-dim', false);
      themeG.classed('search-match', false).classed('search-dim', false);
      link.classed('search-dim', false);
      return;
    }

    const matchedCardIds = new Set<string>();
    const matchedThemeIds = new Set<string>(themeSelection);
    if (hasSearch) {
      for (const c of graph.cards) if (c.name.toLowerCase().includes(q)) matchedCardIds.add(c.id);
      for (const t of graph.themes) if (t.label.toLowerCase().includes(q)) matchedThemeIds.add(t.id);
    }
    if (lookupCardId) matchedCardIds.add(lookupCardId);

    // A card can become relevant two different ways, and links behave differently
    // depending on which one applies:
    //  - directly matched (by name search, or the card-lookup pin) — show ALL of
    //    its links, including to non-matched themes; the point of matching a card
    //    is seeing everything it connects to.
    //  - only reachable via a matched THEME (a click, or a theme-name search hit)
    //    — show just the link(s) back to that matched theme, not the card's other
    //    edges to unrelated themes. Otherwise clicking one theme lights up every
    //    edge of every card it touches, including edges that have nothing to do
    //    with the theme that was actually clicked.
    const cardIdsFromCardMatch = new Set(matchedCardIds);
    const cardIdsFromThemeMatch = new Set<string>();
    const relevantThemeIds = new Set(matchedThemeIds);
    for (const cardId of matchedCardIds) {
      for (const { themeId } of themeEdgesByCard.get(cardId) ?? []) relevantThemeIds.add(themeId);
    }
    for (const themeId of matchedThemeIds) {
      for (const cardId of cardIdsByTheme.get(themeId) ?? []) cardIdsFromThemeMatch.add(cardId);
    }
    const relevantCardIds = new Set([...cardIdsFromCardMatch, ...cardIdsFromThemeMatch]);

    cardG.classed('search-match', (d) => matchedCardIds.has(d.id)).classed('search-dim', (d) => !relevantCardIds.has(d.id));
    themeG.classed('search-match', (d) => matchedThemeIds.has(d.id)).classed('search-dim', (d) => !relevantThemeIds.has(d.id));
    link.classed('search-dim', (d) => {
      const cardId = (d.source as SimNode).id;
      const themeId = (d.target as SimNode).id;
      if (cardIdsFromCardMatch.has(cardId)) return false;
      if (cardIdsFromThemeMatch.has(cardId) && matchedThemeIds.has(themeId)) return false;
      return true;
    });
  }

  function applySearch(query: string) {
    searchQuery = query;
    refreshHighlight();
  }

  function setThemeSelection(ids: ReadonlySet<string>) {
    themeSelection = new Set(ids);
    refreshHighlight();
  }

  function setLookupHighlight(cardId: string | null) {
    lookupCardId = cardId;
    refreshHighlight();
  }

  // Visual debug aid: marks the two fixed anchor points so it's visible (not just
  // inferred from where themes end up) where each category is actually being
  // pulled toward. They're fixed (fx/fy), so unlike the old ring-radius indicator
  // this never needs updating after being drawn once.
  const anchorVisual = root.insert('g', ':first-child').attr('class', 'anchor-visual');
  anchorVisual
    .selectAll('circle')
    .data(anchorNodes)
    .join('circle')
    .attr('class', (d) => `anchor-point anchor-point-${d.id === strongAnchor.id ? 'strong' : 'weak'}`)
    .attr('cx', (d) => d.fx!)
    .attr('cy', (d) => d.fy!)
    .attr('r', 10);

  simulation.on('tick', () => {
    link
      .selectAll<SVGLineElement, SimLink>('line')
      .attr('x1', (d) => (d.source as SimNode).x!)
      .attr('y1', (d) => (d.source as SimNode).y!)
      .attr('x2', (d) => (d.target as SimNode).x!)
      .attr('y2', (d) => (d.target as SimNode).y!);
    themeG.attr('transform', (d) => `translate(${d.x},${d.y})`);
    cardG.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  // "Rerender from the ground up" — clears every node's position (and any pinned
  // drag position) so the simulation starts over from d3's default random scatter
  // instead of wherever it previously settled, for when a layout got stuck clumped
  // up and no amount of force-slider tweaking un-sticks it. Clears ALL nodes (not
  // just the currently-active/filtered ones) so a theme hidden by the current
  // filter doesn't reappear still pinned to its old spot.
  function resetLayout(filters: GraphFilters) {
    for (const node of [...themeNodeById.values(), ...cardNodeById.values()]) {
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

  return { render, applySearch, setThemeSelection, setLookupHighlight, setForces, getForces, resetLayout, destroy };
}
