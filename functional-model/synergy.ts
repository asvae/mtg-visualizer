// Real, execution-derived synergy matching — supersedes
// app/lib/synergyInteractions.ts (which computed matches from synergy-model's
// hand-authored/Forge-translated node graph) as the Interactions panel's own
// data source. A fact here comes from actually RUNNING a card's declarative
// CardDefinition through real game state (functional-model/state.ts) and
// recording what happened (functional-model/harness.ts's own LogEntry log),
// not from a human (or an AI standing in for one) annotating what a card
// "should" do. See the conversation this came out of for the full
// reasoning; the short version: this app's own SCHEMA.md §1 already argued
// "the join is the answer" (card-to-thing beats card-to-card) — this module
// is that same join, just fed by execution instead of annotation.
//
// The real, importable half of what was originally scripts/find-synergies.mjs
// — that script now imports factsFor/sideOf from here instead of defining
// its own copy, so the standalone-script path and the live server route can
// never drift apart.

export interface LogEntry {
  fn: string;
  [key: string]: unknown;
}

export interface PoolCard {
  name: string;
  facts: LogEntry[];
}

/**
 * One resolved interaction — same field shape as the old
 * app/lib/synergyInteractions.ts's own `InteractionGroup` (kind/direction/
 * nodeOwner/nodeId/description/matches) on purpose, so the existing Vue
 * template needed no changes to keep working: `nodeId` is this module's own
 * `key` string (e.g. `zone:Battlefield:Creature:you`) standing in for the
 * old synergy-node id, `nodeOwner` is always `card`'s own name (this system
 * has no "bearing a rule you don't own" concept the old one did).
 */
export interface InteractionGroup {
  kind: 'resource';
  direction: 'provides' | 'benefits';
  nodeOwner: string;
  nodeId: string;
  thing: string;
  description: string;
  matches: { name: string; viaNode: string | null; set?: string; collectorNumber?: string; image?: string | null }[];
}

// Token names this app already knows aren't creatures
// (functional-model/tokens.ts) — everything else `createToken` makes is
// assumed a creature token. A real version would look this up in tokens.ts
// directly instead of a hardcoded list; kept small and inline, same as the
// original script version.
const NON_CREATURE_TOKENS = new Set(['Treasure', 'Food', 'Sword', 'Cragflame']);

// Which SIDE (your own board vs. an opponent's) an entry is about — a real
// distinction an earlier version of this matcher got wrong: Braska's Final
// Aeon's chapter III makes the OPPONENT sacrifice creatures (an edict),
// which initially matched against The Final Days as if it "wanted"
// creatures on its OWN controller's battlefield to use as fodder —
// backwards, since an edict punishes an opponent's board, it isn't fed by
// your own. `player` (sacrifice/discard/reads) or `controller`
// (createToken) already carries this; `move`/`moveTo`/`enters` don't
// currently carry either field (every card in this corpus only ever moves
// its OWN controller's things, so defaulting to 'you' happens to be correct
// today) — flagged, not silently assumed universal.
export function sideOf(entry: LogEntry): 'you' | 'opp' {
  const who = (entry.controller ?? entry.player ?? 'you') as string;
  return who === 'you' ? 'you' : 'opp';
}

interface Fact {
  role: 'produces' | 'wants';
  key: string;
}

/**
 * Every synergy-relevant fact ONE log entry represents — an entry can yield
 * zero, one, or several (sacrifice both WANTS battlefield fodder and
 * PRODUCES graveyard stock, e.g.). `key` is real-Forge-grounded: a zone name
 * (Battlefield/Graveyard/Hand/Exile, straight from interfaces.ts's own
 * ZoneType) plus, where the entry says so, a coarse type word — plus WHICH
 * side's zone (see sideOf above), so an effect that only cares about an
 * OPPONENT's board never matches a card that produces things on ITS OWN.
 * Standing instruction from the conversation this came out of: when this
 * vocabulary would disagree with synergy-model's own registry names, Forge's
 * real names win — that's why these are real ZoneType/type words, not
 * synergy-model `thing` keys.
 */
export function factsFor(entry: LogEntry): Fact[] {
  const side = sideOf(entry);
  const facts: Fact[] = [];
  switch (entry.fn) {
    case 'createToken': {
      const token = entry.token as string;
      facts.push({ role: 'produces', key: `token:${token}` });
      if (!NON_CREATURE_TOKENS.has(token)) facts.push({ role: 'produces', key: `zone:Battlefield:Creature:${side}` });
      break;
    }
    case 'enters':
      facts.push({ role: 'produces', key: `zone:${entry.zone}:${side}` });
      break;
    case 'move':
    case 'moveTo':
      if (entry.to) facts.push({ role: 'produces', key: `zone:${entry.to}:${side}` });
      break;
    case 'sacrifice':
      facts.push({ role: 'wants', key: `zone:Battlefield:Creature:${side}` });
      facts.push({ role: 'produces', key: `zone:Graveyard:${side}` });
      break;
    case 'discard':
      facts.push({ role: 'wants', key: `zone:Hand:${side}` });
      facts.push({ role: 'produces', key: `zone:Graveyard:${side}` });
      break;
    case 'read:getCardsIn':
      if (entry.zone && typeof entry.creatureCount === 'number') facts.push({ role: 'wants', key: `zone:${entry.zone}:Creature:${side}` });
      break;
    case 'read:getCreaturesInPlay':
      facts.push({ role: 'wants', key: `zone:Battlefield:Creature:${side}` });
      break;
    case 'read:getLandsInPlay':
      facts.push({ role: 'wants', key: `zone:Battlefield:Land:${side}` });
      break;
  }
  return facts;
}

// Human-readable text for a `key` string — the Interactions panel's own
// `description` field. Parses the same small vocabulary factsFor() produces
// (`token:<name>` / `zone:<Zone>[:<Type>]:<side>`) rather than keeping a
// separate hand-written label per key, so a new factsFor() case never needs
// a matching new label case remembered separately.
export function describeKey(key: string): string {
  const [kind, ...rest] = key.split(':');
  if (kind === 'token') return `creates a ${rest.join(':')} token`;
  if (kind === 'zone') {
    const side = rest[rest.length - 1] === 'you' || rest[rest.length - 1] === 'opp' ? rest.pop() : undefined;
    const [zone, type] = rest;
    if (!zone) return key;
    const whose = side === 'you' ? 'your' : side === 'opp' ? "an opponent's" : 'the';
    return type ? `${type.toLowerCase()}s in ${whose} ${zone.toLowerCase()}` : `${whose} ${zone.toLowerCase()}`;
  }
  return key;
}

/**
 * Every interaction `cardName` participates in, across `pool` (every
 * functional-model card's own facts, itself included — self-matches are
 * filtered out below). One group per (direction, key) pair with at least
 * one real partner, `matches` listing every OTHER card that's the opposite
 * side of that same key.
 */
export function findInteractionsForCard(cardName: string, pool: PoolCard[]): InteractionGroup[] {
  const byKey = new Map<string, { producers: Set<string>; wanters: Set<string> }>();
  for (const { name, facts } of pool) {
    for (const entry of facts) {
      for (const { role, key } of factsFor(entry)) {
        if (!byKey.has(key)) byKey.set(key, { producers: new Set(), wanters: new Set() });
        byKey.get(key)![role === 'produces' ? 'producers' : 'wanters'].add(name);
      }
    }
  }

  const groups: InteractionGroup[] = [];
  for (const [key, { producers, wanters }] of byKey) {
    if (producers.has(cardName)) {
      const matches = [...wanters].filter((n) => n !== cardName).map((name) => ({ name, viaNode: key }));
      if (matches.length) groups.push({ kind: 'resource', direction: 'provides', nodeOwner: cardName, nodeId: key, thing: key, description: describeKey(key), matches });
    }
    if (wanters.has(cardName)) {
      const matches = [...producers].filter((n) => n !== cardName).map((name) => ({ name, viaNode: key }));
      if (matches.length) groups.push({ kind: 'resource', direction: 'benefits', nodeOwner: cardName, nodeId: key, thing: key, description: describeKey(key), matches });
    }
  }
  return groups;
}
