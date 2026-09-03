import type { SynergyFlow, SynergyNode, SynergyOwner } from '../types';

// Joins two cards' already-decomposed synergy-model nodes (SCHEMA.md §4
// Matching / §7 Queries) into a concrete list of "X interacts with Y, here's
// how" facts. Scoped to what a real worked example (Arahbo, the First Fang ×
// Slashing Tiger) needs — coarse-type/subtype-tag matching plus the handful
// of `cond:`/flag qualifiers those two cards' Forge scripts produce — not a
// general registry-backed matcher (no registries.json lookups here; a real
// build-out would resolve `thing` against that the same way the rest of the
// app does). Two genuinely different join shapes, not one:
//
// - RESOURCE: a `move`/`tap`/`trigger` node (a DEMAND) wants a `thing` that
//   some node elsewhere PRODUCES — an event (`emit`, or the occurrence an
//   `enters`/`cast` node implies) or a stock (`source`, or what `enters`
//   leaves behind while it lifetime > 0). SCHEMA §3's derivation table, but
//   only the two derivations these two cards actually need
//   (`enters → emit etb` + `source bf`).
// - RULE: a `modifier`/`tagger` node whose `thing` ISN'T `self` is a
//   broadcast over identity (SCHEMA §2: "`bearer` ... is derived from the
//   card's `tags`") — it has no producer/consumer shape at all. It just
//   applies to any OTHER card whose own type-line labels satisfy the
//   predicate. A `modifier` node whose `thing` IS `self` (a card buffing
//   only itself) is not a candidate for this join at all.

export interface CardFacts {
  name: string;
  typeLine: string;
  nodes: Record<string, SynergyNode>;
}

interface Fact {
  nodeId: string;
  thing: string; // registry key, coarse type, or a bare subtype-tag word
  owner: SynergyOwner;
  notSelf: boolean;
  token: 'token' | 'nontoken' | undefined; // from cond:token / cond:nontoken
}

interface Demand extends Fact {
  role: 'move' | 'tap' | 'trigger';
}

interface Rule extends Fact {
  role: 'modifier' | 'tagger';
  payload: string; // the cond: value after the key= (delta/tag/etc), for the description text only
}

function parseFlags(flags: string | undefined): { notSelf: boolean; token: 'token' | 'nontoken' | undefined; condPayload: string | undefined } {
  const parts = (flags ?? '').split(/\s+/).filter(Boolean);
  const notSelf = parts.includes('not:self');
  const token = parts.includes('cond:token') ? 'token' : parts.includes('cond:nontoken') ? 'nontoken' : undefined;
  const cond = parts.find((p) => p.startsWith('cond:') && p !== 'cond:token' && p !== 'cond:nontoken');
  return { notSelf, token, condPayload: cond?.slice('cond:'.length) };
}

// Real printed type line -> lowercase word set, the same "supplied for
// free" join SCHEMA.md §3 describes for `self` (Scryfall's own type_line
// already has every subtype/supertype a `tag` predicate would want to
// match against — Cat, Legendary, Creature, ...). Splits on non-letters so
// "Legendary Creature — Cat Avatar" -> {legendary,creature,cat,avatar}.
function selfLabels(typeLine: string): Set<string> {
  return new Set(
    typeLine
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean)
  );
}

// This whole join assumes a one-sided pool (every CardFacts is "your board")
// — there's no opposing pool to match an `owner: "opp"`/`"all"` fact
// against. Without this filter, an opponent-targeting removal/debuff (e.g.
// Downwind Ambusher's "target creature an opponent controls gets -1/-1",
// owner: "opp") would get treated as a friendly `provides` rule reaching
// every pool creature, same badge and framing as a real anthem — actively
// misleading, not just out of scope. `owner: "me"`/`"any"` are the only
// values that mean "something happening on your own side."
function inScope(owner: SynergyOwner): boolean {
  return owner === 'me' || owner === 'any';
}

function deriveDemands(nodes: Record<string, SynergyNode>): Demand[] {
  const demands: Demand[] = [];
  for (const [nodeId, n] of Object.entries(nodes)) {
    if (n.role !== 'move' && n.role !== 'tap' && n.role !== 'trigger') continue;
    if (n.thing === 'self' || n.thing.startsWith('self:')) continue; // wants its own arrival, not a cross-card fact
    if (!inScope(n.owner)) continue;
    const { notSelf, token } = parseFlags(n.flags);
    demands.push({ nodeId, thing: n.thing, owner: n.owner, notSelf, token, role: n.role as Demand['role'] });
  }
  return demands;
}

function deriveRules(nodes: Record<string, SynergyNode>): Rule[] {
  const rules: Rule[] = [];
  for (const [nodeId, n] of Object.entries(nodes)) {
    if (n.role !== 'modifier' && n.role !== 'tagger') continue;
    if (n.thing === 'self' || n.thing.startsWith('self:')) continue; // a self-only buff isn't a broadcast rule
    if (!inScope(n.owner)) continue;
    const { notSelf, token, condPayload } = parseFlags(n.flags);
    rules.push({ nodeId, thing: n.thing, owner: n.owner, notSelf, token, role: n.role as Rule['role'], payload: condPayload ?? '' });
  }
  return rules;
}

// Does a label set (a printed card's own type-line words, or a registry
// template's `labels`) satisfy a demand/rule's `(thing, cond)` predicate?
// `thing` is either one of SCHEMA §2's reserved coarse words or a bare
// subtype-tag (`cat`) — both just need to appear in `labels`. `isToken`
// decides which side of a `cond:token`/`cond:nontoken` qualifier passes —
// always `false` for a real printed CardFacts (never a token template).
function matchesPredicate(thing: string, tokenCond: 'token' | 'nontoken' | undefined, labels: Set<string>, isToken: boolean): boolean {
  if (!labels.has(thing.toLowerCase())) return false;
  if (tokenCond === 'token' && !isToken) return false;
  if (tokenCond === 'nontoken' && isToken) return false;
  return true;
}

export interface Interaction {
  from: string;
  to: string;
  kind: 'resource' | 'rule';
  viaFrom: string;
  viaTo: string | null;
  thing: string;
  description: string;
}

// `producer`'s own battlefield-arrival node — SCHEMA §3's `enters → emit
// etb` derivation, the only event shape every demand in this pool actually
// watches for (a `trigger-type: "enter"` predicate, ChangesZone→Battlefield).
// `cast` (SCHEMA §2: "unit arrives on STACK") is a genuinely different event
// — 702.x-style "whenever a creature enters" triggers never fire off a spell
// merely being cast — so it does NOT satisfy this kind of demand and must
// never be offered as a fallback here, even for a card with no `enters` node
// (a real gap for a future non-creature-spell demand, not something to paper
// over by matching the wrong event).
function findOccurrenceNode(producer: CardFacts): string | null {
  for (const [nodeId, n] of Object.entries(producer.nodes)) {
    if (n.role === 'enters' && (n.thing === 'self' || n.thing.startsWith('self:'))) return nodeId;
  }
  return null;
}

// One of `card`'s own demand/rule nodes (or, for a rule `card` merely bears,
// the OWNING card's node — bearing a rule has no node of `card`'s own, per
// the file header) plus every pool card that matches it. Groups
// findInteractions' pairwise output so a lord in a pool of N cats reads as
// "1 node, N matches" instead of N separate rows saying the same thing.
export interface InteractionGroup {
  kind: 'resource' | 'rule';
  // 'provides' — `card` is the source (its arrival feeds others' triggers,
  // or its own rule buffs others). 'benefits' — `card` is the sink (its own
  // trigger is fed by others' arrivals, or another card's rule reaches it).
  // Always from `card`'s own point of view (the card groupInteractionsForCard
  // was called with), never the matched partner's.
  direction: 'provides' | 'benefits';
  // Whose node this is — usually `card`'s own; for a rule `card` only BEARS
  // (see above), it's the rule owner's.
  nodeOwner: string;
  nodeId: string;
  thing: string;
  description: string;
  // set/collectorNumber/image are left undefined here — this library only
  // knows synergy-model facts, not Scryfall data. A caller that has both
  // (server/api/card/[set]/[number].ts, against its own CAT_POOL) fills
  // them in afterward so the UI can link/show real card art per match.
  matches: { name: string; viaNode: string | null; set?: string; collectorNumber?: string; image?: string | null }[];
}

// A `thing` that isn't `self`/coarse-type/a bare tag is a registry key (a
// shared token template, SCHEMA §3) — resolving it needs the registry, which
// this library deliberately doesn't import (see file header): a caller that
// has one (server/api/card/[set]/[number].ts, for CAT_POOL's own token
// scripts) supplies it here instead.
export type ThingResolver = (thing: string) => { labels: string[]; token: boolean; name: string } | null;

function describeOwnNode(node: SynergyNode, kind: 'resource' | 'rule'): string {
  if (kind === 'rule') {
    const { condPayload } = parseFlags(node.flags);
    return `${node.role} grants ${condPayload ?? '(?)'} to ${node.thing}`;
  }
  if (node.role === 'trigger') return `trigger watches for ${node.thing} entering`;
  return `${node.role} (${node.thing}) feeds other cards' triggers`;
}

// Every pool card's interactions with `card`, grouped by whichever node is
// `card`'s own (see InteractionGroup) — EXCEPT a rule `card` only bears
// (another card's anthem reaching it): `card` has no node of its own there
// (bearing isn't a node, per the file header), and grouping by the OWNER's
// node instead would fragment "N different lords all grant +1/+1" into N
// separate 1-match groups, one per lord, rather than one "affected by N
// cards" fact — so that case groups by the rule's own effect shape
// (`thing`+payload) instead, merging same-effect rules from different
// owners and keeping differently-worded ones apart.
export function groupInteractionsForCard(card: CardFacts, pool: CardFacts[], resolveThing?: ThingResolver): InteractionGroup[] {
  const groups = new Map<string, InteractionGroup>();
  const upsert = (key: string, make: () => InteractionGroup, match: { name: string; viaNode: string | null }) => {
    let group = groups.get(key);
    if (!group) {
      group = make();
      groups.set(key, group);
    }
    group.matches.push(match);
  };

  // Self-interaction (SCHEMA §7 "self-sufficiency"): a thing `card` itself
  // produces (a token from its own `enters` node) can satisfy `card`'s own
  // demand/rule nodes — Arahbo's anthem buffs the very Cat token its own
  // trigger just made. Folded into the SAME groups the cross-card pass below
  // builds (same key format), not a separate section — the token is just
  // another match under the same node, same as any pool card would be.
  if (resolveThing) {
    const ownProducers = Object.entries(card.nodes).filter(([, n]) => n.role === 'enters' && n.thing !== 'self' && !n.thing.startsWith('self:'));
    for (const [producerId, producerNode] of ownProducers) {
      const resolved = resolveThing(producerNode.thing);
      if (!resolved) continue;
      const labels = new Set(resolved.labels.map((l) => l.toLowerCase()));
      for (const d of deriveDemands(card.nodes)) {
        if (!matchesPredicate(d.thing, d.token, labels, resolved.token)) continue;
        upsert(
          `resource:${card.name}:${d.nodeId}`,
          () => {
            const node = card.nodes[d.nodeId];
            // `card`'s own trigger is the demand being satisfied — `card`
            // benefits from (consumes) the thing its own token supplies.
            return { kind: 'resource', direction: 'benefits', nodeOwner: card.name, nodeId: d.nodeId, thing: d.thing, description: node ? describeOwnNode(node, 'resource') : '', matches: [] };
          },
          { name: resolved.name, viaNode: producerId }
        );
      }
      for (const r of deriveRules(card.nodes)) {
        if (!matchesPredicate(r.thing, r.token, labels, resolved.token)) continue;
        upsert(
          `rule:${card.name}:${r.nodeId}`,
          () => {
            const node = card.nodes[r.nodeId];
            // `card`'s own rule reaches its own token — `card` provides the
            // buff (to the token), same direction as any other bearer.
            return { kind: 'rule', direction: 'provides', nodeOwner: card.name, nodeId: r.nodeId, thing: r.thing, description: node ? describeOwnNode(node, 'rule') : '', matches: [] };
          },
          { name: resolved.name, viaNode: producerId }
        );
      }
    }
  }

  for (const other of pool) {
    if (other.name === card.name) continue;
    for (const ix of findInteractions(card, other)) {
      const cardIsFrom = ix.from === card.name;
      if (!cardIsFrom && ix.to !== card.name) continue; // interaction doesn't involve `card` at all

      if (ix.kind === 'rule' && !cardIsFrom) {
        const ownerNode = other.nodes[ix.viaFrom];
        const { condPayload } = parseFlags(ownerNode?.flags);
        const payload = condPayload ?? '(?)';
        upsert(
          `rule-received:${ix.thing}:${payload}`,
          () => ({ kind: 'rule', direction: 'benefits', nodeOwner: card.name, nodeId: '(received)', thing: ix.thing, description: `affected by another card's rule: ${payload}`, matches: [] }),
          { name: other.name, viaNode: ix.viaFrom }
        );
        continue;
      }

      const nodeId = cardIsFrom ? ix.viaFrom : (ix.viaTo ?? ix.viaFrom);
      const partnerName = cardIsFrom ? ix.to : ix.from;
      const partnerNode = cardIsFrom ? ix.viaTo : ix.viaFrom;
      // `cardIsFrom` — card is the resource producer or the rule owner, so
      // it PROVIDES; otherwise (resource only — the rule case above always
      // has cardIsFrom true by construction) card's own trigger is being
      // fed by `other`, so it BENEFITS. Always from `card`'s own viewpoint.
      upsert(
        `${ix.kind}:${card.name}:${nodeId}`,
        () => {
          const node = card.nodes[nodeId];
          return { kind: ix.kind, direction: cardIsFrom ? 'provides' : 'benefits', nodeOwner: card.name, nodeId, thing: ix.thing, description: node ? describeOwnNode(node, ix.kind) : ix.description, matches: [] };
        },
        { name: partnerName, viaNode: partnerNode }
      );
    }
  }
  return [...groups.values()].sort((a, b) => b.matches.length - a.matches.length);
}

export function findInteractions(a: CardFacts, b: CardFacts): Interaction[] {
  const out: Interaction[] = [];

  const resourceOneWay = (demander: CardFacts, producer: CardFacts) => {
    for (const d of deriveDemands(demander.nodes)) {
      const labels = selfLabels(producer.typeLine);
      if (!matchesPredicate(d.thing, d.token, labels, false)) continue;
      const producerNode = findOccurrenceNode(producer);
      if (!producerNode) continue;
      out.push({
        from: producer.name,
        to: demander.name,
        kind: 'resource',
        viaFrom: producerNode,
        viaTo: d.nodeId,
        thing: d.thing,
        description: `${producer.name} entering feeds ${demander.name}'s ${d.role} node (${d.nodeId})`,
      });
    }
  };
  resourceOneWay(a, b);
  resourceOneWay(b, a);

  const ruleOneWay = (owner: CardFacts, bearer: CardFacts) => {
    for (const r of deriveRules(owner.nodes)) {
      if (r.notSelf && owner.name === bearer.name) continue;
      const labels = selfLabels(bearer.typeLine);
      if (!matchesPredicate(r.thing, r.token, labels, false)) continue;
      out.push({
        from: owner.name,
        to: bearer.name,
        kind: 'rule',
        viaFrom: r.nodeId,
        viaTo: null,
        thing: r.thing,
        description: `${owner.name}'s ${r.role} (${r.nodeId}) applies to ${bearer.name}: ${r.payload}`,
      });
    }
  };
  ruleOneWay(a, b);
  ruleOneWay(b, a);

  return out;
}

export type { SynergyFlow }; // re-exported for callers that want to walk flow alongside these facts
