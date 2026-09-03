// Generates a round-trip fidelity test packet for one card: everything a
// fresh, isolated agent needs to reconstruct the card's rules text from its
// node/flow decomposition alone (task instructions + an inline schema
// summary + registries.json + the card's own nodes/flow), and nothing else.
// No anonymization step needed — `thing: "self"` (and "self:front"/
// "self:back" for a DFC) means a card's own nodes never contain its name or
// a slug of it in the first place; this script just doesn't attach the
// `name` field from edges.json to the packet.
//
// The schema summary below is written fresh, not pulled from
// synergy-model/SCHEMA.md — that file still describes an earlier flat
// ability.step format and is deliberately frozen mid-rewrite (see this
// session's synergy-model design discussion). This script's own summary is
// the source of truth for what the current {nodes, flow} shape actually
// means, until SCHEMA.md itself gets its rewrite.
//
// Usage: node synergy-model/scripts/make-exam.mjs "<card name>"
//   Writes synergy-model/exams/<slug>.md — feed its full contents as the
//   entire prompt to a fresh, non-fork agent. See EXAM_PROCESS.md for the
//   rest of the loop (run it, judge it, save the result).

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: node synergy-model/scripts/make-exam.mjs "<card name>"');
  process.exit(1);
}

function slugify(word) {
  return word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const edgesData = JSON.parse(await readFile('synergy-model/data/edges.json', 'utf8'));
const q = query.toLowerCase();
const matches = edgesData.filter((e) => e.name.toLowerCase().includes(q));
if (matches.length === 0) {
  console.error(`No card with edges matches "${query}" — decompose it first (see REVIEW_PROCESS.md).`);
  process.exit(1);
}
if (matches.length > 1) {
  const exact = matches.find((e) => e.name.toLowerCase() === q);
  if (!exact) {
    console.error(`Ambiguous ("${query}") — candidates:\n` + matches.map((e) => `  ${e.name}`).join('\n'));
    process.exit(1);
  }
  matches.length = 0;
  matches.push(exact);
}
const entry = matches[0];

const registries = await readFile('synergy-model/data/registries.json', 'utf8');

// `self`/`self:front`/`self:back` resolve against Scryfall in a real
// consumer — simulate that join here so the examiner gets the same data a
// real consumer would, without ever seeing the card's own name. Obfuscated
// keys (name-1, name-2 for a DFC's two faces) stand in for the real
// name(s); the mapping is printed to the console, never written to the
// packet, so the caller can substitute real names back into the examiner's
// response after the fact.
const scryfallCards = JSON.parse(await readFile('data/fin/fin_scryfall.json', 'utf8'));
const scryfallEntry = scryfallCards.find((c) => c.name === entry.name);
if (!scryfallEntry) {
  console.error(`No Scryfall entry for "${entry.name}" in data/fin/fin_scryfall.json — needed for the self registry.`);
  process.exit(1);
}
const faces = scryfallEntry.card_faces ?? [scryfallEntry];
const selfNameMap = {};
const selfRegistry = {};
// name-1 -> self:front (or bare "self" for a single-faced card), name-2 -> self:back.
const faceKeys = faces.length > 1 ? ['self:front', 'self:back'] : ['self'];
faces.forEach((face, i) => {
  const key = `name-${i + 1}`;
  selfNameMap[key] = face.name ?? scryfallEntry.name;
  selfRegistry[faceKeys[i] ?? key] = {
    manaCost: face.mana_cost || undefined,
    typeLine: face.type_line,
    ...(face.power !== undefined ? { power: face.power, toughness: face.toughness } : {}),
  };
});
// Alternate-cost cast nodes (flashback, escape, "cast from graveyard for
// {X}") pay a DIFFERENT cost than the printed mana cost above — that's not
// something Scryfall's face data carries, so pull it from the node's own
// cost: flag and fold it into the same self-registry entry (keyed by the
// zone it's cast from) rather than leaving it on the node.
for (const node of Object.values(entry.nodes)) {
  if (node.role === 'cast' && node.from !== 'hand') {
    const m = (node.flags ?? '').match(/\bcost:(\S+)/);
    if (m) {
      const key = node.thing in selfRegistry ? node.thing : 'self';
      selfRegistry[key].altCost ??= {};
      selfRegistry[key].altCost[node.from] = m[1];
    }
  }
}
console.log("Self registry (real names — substitute back into the examiner's response, never shown to it):");
for (const [key, name] of Object.entries(selfNameMap)) console.log(`  ${key} -> ${name}`);

// Strip cost: from cast nodes (always redundant with the self registry now —
// default cost lives in manaCost, alternate-cost casts in altCost above) so
// the examiner reads cost from the registry, not the node.
const nodesForPacket = Object.fromEntries(
  Object.entries(entry.nodes).map(([id, node]) => {
    if (node.role !== 'cast' || !node.flags) return [id, node];
    const flags = node.flags.replace(/\bcost:\S+\s*/, '').trim();
    return [id, { ...node, flags: flags || undefined }];
  })
);

const SCHEMA_SUMMARY = `A card is a flat map of nodes (pure edge facts, no sequencing) plus a
separate \`flow\` graph describing how they depend on each other:

\`\`\`
{
  "nodes": { "<id>": { role, owner, from, to, thing, "trigger-type"?, flags? }, ... },
  "flow": {
    "roots": [ <id or combine-group>, ... ],
    "steps": { "<id>": [ <id or combine-group>, ... ], ... }
  }
}
\`\`\`

**Nodes** carry the actual facts:
- \`role\` (closed list): \`enters\` (arrives on the battlefield), \`cast\` (arrives
  on the stack, any spell type), \`source\` (anonymous stock becomes available —
  mill, surveil), \`tap\` (a cost — convoke/crew-style), \`becomes\` (identity/type
  change, or a real "exile then return" zone change — never a bare relabel if
  a real zone change is printed), \`move\` (a real zone-to-zone journey of a
  specific/anonymous object — sacrifice, discard, search, reanimation, a
  resolved spell's own resting zone), \`emit\` (an event with no lasting stock —
  draws a card, loses life, a lore counter added), \`trigger\` (a triggered
  ability itself becoming a stack object per rule 603.3b — carries a
  \`trigger-type\` naming the event: \`"enter"\`, \`"attack"\`, \`"deals-damage"\`,
  \`"saga-chapter"\`, etc.; always \`to: "stack"\`), \`amplify\`/\`suppress\` (pipes
  over another edge — "triggers again", "can't be countered"), \`sensor\`/
  \`scaler\` (a threshold read / a continuous read of game state), \`modifier\`/
  \`tagger\` (a static rule over a tag, or adding a tag).
- \`owner\`: \`me\`, \`opp\` (every opponent, symmetric), \`any\` (one side, not
  necessarily chosen by targeting — could be "whichever player was dealt
  damage"), \`all\` (both sides at once).
- \`from\`/\`to\` (zones): \`bf\`, \`gy\`, \`hand\`, \`exile\`, \`lib\`, \`stack\`, \`--\` (not
  applicable). \`cast\`/\`trigger\` nodes are always \`to: "stack"\` — that's what
  makes them real interruption points (603.3b: can be countered/Stifled
  before resolving).
- \`thing\`: a registry key (see Registries below), or one of three reserved
  words: \`self\` (this card's own body — or \`self:front\`/\`self:back\` for a
  double-faced card, disambiguating which face's data a lookup resolves to),
  a coarse type-line word (\`creature\`, \`artifact\`, \`land\`, etc. — never a
  specific subtype, which lives in \`cond:\` instead), or \`any\` (an
  unspecified card — mill, discard, search all move cards that could be
  anything).
- \`flags\` (free-text, space-separated, sparse): \`may\` (optional), \`copy\` (a
  spell copy, no graveyard afterlife), \`not:self\` ("another"), \`target\`
  (chosen via targeting, not "each"/automatic), \`combat\` (on a
  deals-damage trigger: combat damage specifically), \`cost:{...}\` (mana
  cost for anything other than a plain hand-cast — an activated ability, an
  alternate-cost cast), \`qty:N\` / \`qty:0..N\` (a fixed or ranged count —
  when this flag is ABSENT entirely, the count is exactly 1, not unlimited
  or unspecified),
  \`lifetime:turn\` (temporary), \`tapped\` (arrives tapped), \`cond:...\`
  (free-text game-state precondition, or a payload for \`modifier\`/\`tagger\`/
  \`becomes\` stating what actually changes — e.g. \`cond:equipped;delta=+1/+1\`).
  Two binding forms: \`<name>:=<label>\` on the node where a value is first
  fixed (a scaler's own measured count, or a trigger's own variable info —
  "that player," "that many," locked in at the moment it triggers, not
  re-evaluated later) declares a name for it; \`<field>=<label>\` on any node
  downstream (\`qty=<label>\`, \`player=<label>\`) binds that field to the
  named value. \`:=\` always declares, bare \`=\` always references.

**\`flow\`** describes dependency — the graph's own shape, not a flag pointing
at a coordinate:
- \`roots\`: ids (or combine-groups) with nothing pointing at them — they fire
  on their own, ungated by anything else on the card. A permanent's bare
  \`enters\` is always a root even when the card also has a \`cast\` node — a
  permanent can enter without being cast (reanimation, etc.).
- \`steps[id]\`: what follows \`id\`. Whether that's a *guaranteed* continuation
  or a *contingent* one is derived from \`id\`'s own \`to\` field: if
  \`to: "stack"\`, whatever follows only happens if \`id\` actually resolves
  (wasn't countered/Stifled) — a real interruption point. Otherwise it's
  automatic (nothing gets priority in the gap — e.g. a bare arrival and its
  own unconditioned trigger being placed on the stack are related this way,
  per 603.3b: no player gets priority between an event and its trigger
  reaching the stack).
- A step can be a plain id, or a **combine group**:
  \`{ "combine": "any" | <number>, "of": [ <id>, ... ] }\`. \`"any"\` means one
  occurrence satisfiable by any of the listed predicates (a disjunctive
  predicate on a single action — "sacrifice a creature or artifact" is one
  sacrifice, flexible about what qualifies, not a choice between effects). A
  number N means a genuine modal choice ("choose one —" is N=1): exactly N
  of the listed branches are picked, and only the picked branch(es)' own
  continuations happen.
- The same id can appear as a target from more than one place — that's a
  real fact (e.g. a shared follow-up effect reachable from either branch of
  an \`any\` group), not a bug to resolve into one path.

**Registries** (below): \`labels\` maps a shared \`thing\` (a token template, a
named object multiple cards could reference) to its label set (and, for a
token, its printed \`stats\`/\`subtype\`) — never a card's own identity, which is
always \`thing: self\` instead. \`actions\` expands a named keyword action (e.g.
\`surveil-N\`) into the edges it's shorthand for.`;

const packet = `# Card reconstruction task

You are given the structural decomposition of ONE Magic: the Gathering
card's rules text into a graph of typed nodes (per the schema below), plus
the registries those nodes reference. Your job: reconstruct the card,
formatted similarly to how a real card is displayed — EXCEPT its name,
which is unknown by design and must not be invented or stood in for with a
placeholder title.

Output format, in order:
1. **Mana cost** — using mana symbol notation exactly as given (\`{2}{B}\`,
   not "two generic and one black"), read off the self registry entry
   (below) that the card's \`cast\` node(s) resolve to: \`manaCost\` for a cast
   node whose \`from\` is \`hand\`, or \`altCost[<from>]\` for a cast node from
   anywhere else (an alternate cost — flashback, escape, casting from the
   graveyard, etc.). If the card has more than one named self (e.g. two
   faces) and/or more than one \`cast\` node, show each cost against the
   casting mode/face it belongs to.
2. **Type line** — the self registry entry's type line. Leave out anything
   neither the registry nor the nodes determine (supertype, rarity) rather
   than guessing.
3. **Rules text** — the reconstructed oracle-style text. Group nodes into
   printed abilities by following \`flow\` from each root: a root plus
   everything reachable from it via guaranteed (non-stack) steps forms one
   ability's own trigger/arrival condition; what follows a \`to: "stack"\`
   node (a real interruption point) is that ability's printed effect, one
   paragraph. Two faces of a double-faced card are two separate cards' worth
   of text — present them separately, in face order.

Then two labeled lists: "Assumptions" (a guess you made anyway, and why)
and "Could not derive" (anything the nodes genuinely don't determine, left
unfilled rather than guessed) — include both only if non-empty, but don't
skip listing something in "Could not derive" just because leaving it out
would look cleaner.

Rules:
- No internet access, no tools — reason only from the material below.
- If you think you recognize the specific printed card, ignore that
  instinct. Derive the wording only from the nodes given, not from outside
  knowledge of what this card "actually" says.
- This is a single attempt — there is no follow-up round, so do your best
  reasoning up front rather than leaving placeholders.
- Be strict. Do not guess or invent plausible-sounding specifics (numbers,
  named tokens, flavor, keyword names) that aren't actually derivable from
  the nodes and registries given. Where the nodes genuinely underdetermine
  something, don't paper over it with an invented value.

---

## Schema

${SCHEMA_SUMMARY}

---

## Registries (registries.json)

\`\`\`json
${registries.trim()}
\`\`\`

---

## Self registry

Every \`thing: self\`/\`self:front\`/\`self:back\` on this card's nodes resolves
to one of these entries (the same registry lookup a real consumer would do —
simulated here since you have no Scryfall access).

\`\`\`json
${JSON.stringify(selfRegistry, null, 2)}
\`\`\`

---

## Target card's nodes and flow

Rarity is deliberately withheld.

\`\`\`json
${JSON.stringify({ nodes: nodesForPacket, flow: entry.flow }, null, 2)}
\`\`\`
`;

await mkdir('synergy-model/exams', { recursive: true });
const slug = slugify(entry.name);
const outPath = `synergy-model/exams/${slug}.md`;
await writeFile(outPath, packet);
console.log(`Wrote ${outPath} (${Object.keys(entry.nodes).length} nodes, card name withheld from the packet).`);
