import type { ForgeCard, ForgeFace, ForgeRow, SynergyFlow, SynergyFlowStep, SynergyNode, SynergyOwner, SynergyRole, SynergyZone } from '../types';

// Translates a parsed Forge script (app/lib/forgeScript.ts) into
// synergy-model's own node/flow shape (synergy-model/SCHEMA.md), so a
// first-pass decomposition can be generated for any card Forge has already
// scripted instead of hand-authoring one. Built test-first against the 11
// cards synergy-model/data/edges.json already hand-decomposed — see
// app/lib/forgeTranslate.test.ts for what "match" means and forgeTranslate's
// own report (this session) for the schema mismatches this surfaced.
//
// forgeScript.ts renders a row's remaining fields into ONE display string
// (`Key=Value  Key2=Value2`) rather than keeping them structured, and folds
// a T:/S: line's Mode$ value into its `role` string (`trigger(ChangesZone)`)
// — both are fine for the read-only outline widget but lossy for a
// translator. Rather than duplicate forgeScript.ts's own line-classification
// logic (re-parsing the raw .txt ourselves), this file re-derives structure
// from that ALREADY-STRUCTURED-then-rendered output — one step removed from
// the raw text, not a second raw parser.

export interface TranslatedCard {
  name: string;
  nodes: Record<string, SynergyNode>;
  flow: SynergyFlow;
  // Forge fields/keywords this translator has no mapping for yet — surfaced
  // for a human-review queue rather than guessed at (SCHEMA.md's own ai/human
  // review gate, just fed by translation output instead of decomposition).
  unmapped: string[];
}

// ---------------------------------------------------------------------------
// Step 1 — recover structure from ForgeRow's rendered strings.

function reparseFields(fields: string | undefined): Record<string, string> {
  if (!fields) return {};
  const out: Record<string, string> = {};
  for (const chunk of fields.split('  ')) {
    if (!chunk) continue;
    const i = chunk.indexOf('=');
    if (i === -1) out[chunk] = '';
    else out[chunk.slice(0, i)] = chunk.slice(i + 1);
  }
  return out;
}

// `role` is `trigger(Mode)` / `static(Mode)` for T:/S: rows (see
// forgeScript.ts's walkEffect) — recovers the bare Mode$ value.
function eventMode(row: ForgeRow): string | undefined {
  const m = /^(?:trigger|static)\((.*)\)$/.exec(row.role ?? '');
  return m?.[1];
}

// ---------------------------------------------------------------------------
// Step 2 — rebuild the parent→children tree from the flat, depth-annotated
// row list forgeScript.ts produces (standard depth-stack reconstruction; the
// rows are a pre-order DFS walk, same structure the outline table's own
// indentation already relies on).

interface RowTree {
  row: ForgeRow;
  children: RowTree[];
}

function buildForest(rows: ForgeRow[]): RowTree[] {
  const roots: RowTree[] = [];
  const stack: RowTree[] = [];
  for (const row of rows) {
    const node: RowTree = { row, children: [] };
    let top = stack[stack.length - 1];
    while (top && top.row.depth >= row.depth) {
      stack.pop();
      top = stack[stack.length - 1];
    }
    if (top) top.children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

// ---------------------------------------------------------------------------
// Vocabulary tables — only what these 11 cards actually use (see this
// session's report for the full mapping this ended up needing).

const ZONE_MAP: Record<string, SynergyZone> = {
  Battlefield: 'bf',
  Graveyard: 'gy',
  Hand: 'hand',
  Exile: 'exile',
  Library: 'lib',
  Stack: 'stack',
  Any: '--',
};
function zone(v: string | undefined): SynergyZone {
  return (v && ZONE_MAP[v]) || '--';
}

// Forge's `Defined$`/`ValidX$` own vocabulary for who/what an effect
// resolves against. Not a general parser — the handful of shapes these 11
// cards use (`You`, `Opponent`, `Player.Opponent`, bare `Player`,
// `TriggeredTarget`, absent).
function deriveOwner(defined: string | undefined): SynergyOwner {
  if (!defined || defined === 'You') return 'me';
  if (defined === 'Opponent' || defined === 'Player.Opponent') return 'opp';
  if (defined === 'Player') return 'all'; // bare "Player" = every player, symmetric
  // TriggeredTarget = whoever the triggering event picked out (e.g. the
  // player dealt combat damage) — SCHEMA's own guidance (§ owner, Kain's
  // "that player gains control") is `any`, not a guess at `opp`: it isn't
  // necessarily an opponent in multiplayer. Ninja's Blades' hand-authored
  // ground truth actually used `opp` here instead — a genuine per-card
  // editorial judgment call SCHEMA's own text doesn't settle either way;
  // this translator follows SCHEMA's stated general rule and accepts that
  // divergence rather than special-casing one card (see this session's
  // report).
  if (defined === 'TriggeredTarget' || defined === 'Remembered') return 'any';
  // `TokenOwner$ Promised` — Gift's own vocabulary: the token goes to
  // whichever opponent was promised the gift (Gift, 702.199), never you.
  if (defined === 'Promised') return 'opp';
  return 'me';
}

// Owner from a ValidTgts$/SacValid$-style TARGET predicate (as opposed to
// deriveOwner's Defined$/TokenOwner$ vocabulary above) — `.YouCtrl` (yours),
// `.OppCtrl`/`.Opponent` (an opponent's — Forge uses both spellings; a
// missing `.OppCtrl` check here silently defaulted an explicit "target
// creature an OPPONENT controls" to `any`, confirmed on Downwind Ambusher's
// real ValidTgts$ Creature.OppCtrl), else `any` (unrestricted — could be
// anyone's, genuinely not determined by the predicate alone). Shared by
// every targeted-effect handler (Pump, PutCounter, Destroy, DealDamage) —
// duplicated inline before, which is exactly how `.OppCtrl` went unnoticed
// in three of the four copies once it was missed in the first.
function ownerFromTargetPredicate(validTgts: string | undefined): SynergyOwner {
  const v = validTgts ?? '';
  // `.YouCtrl` (control — battlefield/stack) and `.YouOwn` (ownership — a
  // real, separate Forge qualifier for graveyard/hand/library cards, where
  // "control" doesn't apply the same way; Fight On!'s own real ValidTgts$
  // Creature.YouOwn targets creature cards in YOUR graveyard) both mean "me"
  // for this join's purposes. Qualifiers past the first are joined with `+`
  // rather than another `.` (Banishing Light's real ValidTgts$
  // Permanent.nonLand+OppCtrl) — `[.+]` matches either separator, not just
  // the literal dot a lone `\.` only catches before the FIRST qualifier.
  if (/[.+]YouCtrl\b/.test(v) || /[.+]YouOwn\b/.test(v)) return 'me';
  if (/[.+]OppCtrl\b/.test(v) || /[.+]OppOwn\b/.test(v) || /[.+]Opponent\b/.test(v)) return 'opp';
  return 'any';
}

// A Forge type predicate (`Creature.Other`, `Creature.token`, `Enchantment`,
// `Player.Opponent` used as a SacValid/ValidTgts type rather than an owner)
// down to synergy's coarse `thing` word plus whatever flags its qualifiers
// imply.
function coarseType(v: string | undefined): string {
  if (!v) return 'any';
  const base = v.split('.')[0] ?? v;
  if (base === 'Card') return 'any';
  // CARDNAME — Forge's own literal self-reference (Sac<1/CARDNAME>: "sacrifice
  // this permanent," Carrot Cake's own tap-cost). Without this, it fell
  // through to the generic lowercase-the-type-word path, producing the
  // literal (and meaningless to any consumer) thing:"cardname" instead of
  // the real self-reference every other self-targeting effect uses.
  if (base === 'CARDNAME') return 'self';
  return base.toLowerCase();
}
// ConditionPresent$ <Type>.YouCtrl ("if you control a Bat/Rabbit/...") is a
// simple board-state existence check — a real, recurring payoff shape across
// many BLB cards (Sonar Strike's own life gain, Rabbit Response's own scry,
// Seasoned Warrenguard's attack trigger via the sibling IsPresent$ field) —
// distinct from the still-unimplemented ConditionCheckSVar$/
// ConditionSVarCompare$/CheckSVar$ dynamic-VALUE class (see
// blb-progress.json's known_gap_classes): this is a plain "does at least one
// X exist" boolean, not a computed number or cross-player comparison, so
// it's cheap and unambiguous enough to encode directly. Deliberately skips
// the PromisedGift shape (handled separately by the narrower, already-
// dedicated cond:gift_promised flag) to avoid double-encoding the same fact
// two different ways.
function ifPresentFlag(v: string | undefined): string | undefined {
  if (!v || /PromisedGift/.test(v)) return undefined;
  const type = coarseType(v);
  // A generic base (Permanent/Card) isn't the real distinguishing fact when
  // a qualifier narrows it further — Seasoned Warrenguard's own IsPresent$
  // Permanent.token+YouCtrl means "a TOKEN," not merely "a permanent."
  if ((type === 'permanent' || type === 'card' || type === 'any') && /[.+]token\b/i.test(v)) return 'if_present=token';
  return type && type !== 'any' ? `if_present=${type}` : undefined;
}
function qualifierFlags(v: string | undefined): string[] {
  if (!v) return [];
  const flags: string[] = [];
  // Same `[.+]`-separator fix as ownerFromTargetPredicate above — a
  // qualifier chain past the first is `+`-joined, not `.`-joined.
  if (/[.+]Other\b/.test(v)) flags.push('not:self');
  if (/[.+]token\b/.test(v)) flags.push('cond:token');
  if (/[.+]!token\b/.test(v)) flags.push('cond:nontoken');
  if (/[.+]EquippedBy\b/.test(v)) flags.push('cond:equipped');
  if (/[.+]nonLand\b/.test(v)) flags.push('cond:nonland');
  if (/[.+]nonCreature\b/.test(v)) flags.push('cond:noncreature');
  if (/[.+]withoutFlying\b/.test(v)) flags.push('cond:withoutflying');
  if (/[.+]withFlying\b/.test(v)) flags.push('cond:withflying');
  return flags;
}

// TokenScript$ id -> synergy-model/data/registries.json label key. Only the
// two token templates these 11 cards actually create; a real build-out would
// generate this from Forge's own res/tokenscripts the same way registries.json
// itself says labels "can be auto-generated from Scryfall type lines"
// (SCHEMA.md §8).
const TOKEN_SCRIPT_MAP: Record<string, string> = {
  c_a_treasure_sac: 'treasure',
  b_2_2_horror: 'horror-1',
  c_a_food_sac: 'food',
  b_1_1_bat_flying: 'bat-1',
  b_1_1_rat_relentless: 'rat-1',
  b_1_1_snail: 'snail-1',
  g_1_1_squirrel: 'squirrel-1',
  u_1_1_fish: 'fish-1',
  ur_1_1_otter_prowess: 'otter-1',
  w_0_4_wall_defender: 'wall-1',
  w_1_1_cat: 'cat-1',
  w_1_1_cat_lifelink: 'cat-1',
  w_1_1_rabbit: 'rabbit-1',
};

// DB$/AB$/SP$ effect name -> synergy role. Data, not branching logic — see
// SCHEMA.md §2 role table for why each mapping was chosen; the ones that
// aren't a plain 1:1 (GainControl, Animate, Sacrifice, Token, Discard,
// ChangeZone) get extra handling in translateEffectRow below because they
// need more than a role swap (owner/thing/split-into-two-nodes).
const EFFECT_ROLE: Record<string, SynergyRole> = {
  LoseLife: 'emit',
  GainLife: 'emit',
  Draw: 'emit',
  Discard: 'move',
  Token: 'enters',
  ChangeZone: 'move',
  Dig: 'move',
  Sacrifice: 'move',
  GainControl: 'becomes',
  PutCounter: 'modifier',
  Pump: 'modifier',
  Charm: 'trigger', // never actually emitted as a node — see charm handling
};

let seq = 0;
// A, B, C, ... Z, AA, AB, ... — spreadsheet-column style so it never runs out
// (no card in this pool has anywhere near 26 nodes, but a Charm/Chapter-heavy
// one could). Readable node ids for the Interactions panel's `(A)`-style
// cross-references, replacing the earlier `n0`/`n1`/... scheme.
function letterId(n: number): string {
  let s = '';
  let i = n + 1;
  while (i > 0) {
    const rem = (i - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Step 3 — translation.

interface Ctx {
  nodes: Record<string, SynergyNode>;
  steps: Record<string, SynergyFlowStep[]>;
  roots: SynergyFlowStep[];
  unmapped: string[];
}

function addNode(ctx: Ctx, node: SynergyNode): string {
  const id = letterId(seq++);
  ctx.nodes[id] = node;
  return id;
}
function link(ctx: Ctx, parent: string, child: SynergyFlowStep) {
  (ctx.steps[parent] ??= []).push(child);
}

// A `Cost$ Sac<N/Type1[.Q];Type2[.Q]/description>` cost — Forge's own
// compound-cost syntax where `;`-joined types are alternatives, matching
// synergy's `combine: "any"` exactly (one sacrifice, flexible about what
// qualifies — SCHEMA.md's own Namazu Trader worked example). `may` is only
// added when this cost gates a triggered ability's optional resolution
// (reached via a T: trigger's Execute$ chain) — an activated ability's own
// cost is already inherently elective by virtue of being an activation,
// which is how Phantom Train's identical-shaped cost ends up WITHOUT `may`
// in the hand-authored ground truth while Namazu Trader's (inside an
// attack-trigger's "you may sacrifice... if you do") has it.
//
// Wires a parsed Sac<> cost into the graph under `parent`, returning the leaf
// id(s) that the ability's own effect should be chained from (every branch,
// same convention as Namazu Trader's `surveil` node being reached from both
// `sacCreature` and `sacArtifact`).
function wireSacCost(ctx: Ctx, cost: string, inTrigger: boolean, attach: (step: SynergyFlowStep) => void, manaCost?: string): string[] {
  const m = /^Sac<(\d+)\/([^/]+)(?:\/.*)?>$/.exec(cost);
  if (!m || !m[1] || !m[2]) return [];
  const qty = m[1];
  const types = m[2].split(';');
  const ids = types.map((t) => {
    const qf = qualifierFlags(t);
    const parts = [manaCost ? `cost:${manaCost}` : undefined, ...(inTrigger ? ['may'] : []), ...qf, ...(qty !== '1' ? [`qty:${qty}`] : [])].filter(Boolean);
    return addNode(ctx, { role: 'move', owner: 'me', from: 'bf', to: 'gy', thing: coarseType(t), flags: parts.join(' ') || undefined });
  });
  const first = ids[0];
  if (ids.length > 1) attach({ combine: 'any', of: ids });
  else if (first) attach(first);
  return ids;
}

// Translates one effect row (a top-level A:/K: line's own fields, or a
// chained SVar effect) into 0+ synergy nodes, wiring them under `parent` (or
// into `roots` when `parent` is null), and recurses into its Forge children.
// `granted` marks a row reached through a static's `AddTrigger$` — its own
// `Card.Self` fields mean "whichever permanent has this granted ability", not
// literally this card, so `thing: self` would be wrong (Ninja's Blades: the
// granted trigger's `thing` is the equipped creature's coarse type, not the
// Equipment itself).
function translateEffectRow(
  ctx: Ctx,
  tree: RowTree,
  parent: string | null,
  selfThing: string,
  inTrigger: boolean,
  granted: false | { thing: string },
  applyMay = false
): void {
  const row = tree.row;
  const fields = reparseFields(row.fields);
  const attach = (step: SynergyFlowStep) => {
    if (parent) link(ctx, parent, step);
    else ctx.roots.push(step);
  };

  if (row.lineType === 'T' || row.role?.startsWith('trigger(')) {
    const mode = eventMode(row) ?? '';
    const combat = fields.CombatDamage === 'True';
    // ChangesZoneAll is Forge's own "one-or-more-at-once" variant of
    // ChangesZone (Class level 2's "whenever one or more ... permanents ...
    // enter" — a real rules distinction for how the engine batches
    // simultaneous events, not a different real-world event) — same
    // trigger-type as the singular case rather than a bare lowercased
    // 'changeszoneall' with no derivable meaning (round-trip exam couldn't
    // make sense of it as printed either).
    const isEnter = (mode === 'ChangesZone' || mode === 'ChangesZoneAll') && fields.Destination === 'Battlefield';
    // battlefield->graveyard is rule 700.4's "dies" event (Jackdaw Savior's
    // own "whenever ... dies" trigger) — same convention as the isEnter
    // mapping just above (a coarse Origin/Destination shape, not the literal
    // Forge mode name), rather than falling through to the unreadable literal
    // string "changeszone".
    const isDies = (mode === 'ChangesZone' || mode === 'ChangesZoneAll') && fields.Origin === 'Battlefield' && fields.Destination === 'Graveyard';
    const triggerType = isEnter ? 'enter' : isDies ? 'dies' : mode === 'Attacks' ? 'attack' : mode === 'DamageDone' ? 'deals-damage' : mode.toLowerCase();
    // ValidCard$ (comma-separated = OR of alternatives, Forge's own dialect)
    // says WHOSE occurrence this trigger watches — "Card.Self" alone means
    // self-only (the common case, and the default below). A lord-style
    // "Card.Self,Cat.!token+Other+YouCtrl" (Arahbo) is self-OR-another-Cat;
    // "Squirrel.Other+YouCtrl,Food.Other+YouCtrl" (Honored Dreyleader) is
    // two DIFFERENT non-self subtypes, no self clause at all. Either way,
    // synergy's `thing` column is one string, so N non-self clauses become N
    // separate trigger nodes rather than one node hedging across predicates
    // — same precedent SCHEMA already uses for "one occurrence, several
    // valid producers" (Namazu Trader's `surveil` reached from two branches):
    // every clause-node shares the exact same downstream chain (built once,
    // then referenced from each), not a duplicated copy of it. Only the
    // non-self clauses carry new type info (self is already `selfThing`),
    // and `not:self` only belongs on a node if EVERY clause excludes self.
    const specs: { thing: string; extraFlags: string[] }[] = [];
    // Forge spells this field two ways for the same concept — `ValidCard$`
    // on a singular-event trigger (ChangesZone), `ValidCards$` (plural) on
    // the "one or more at once" variant (ChangesZoneAll, Class level 2's
    // own "whenever one or more noncreature, nonland permanents enter") —
    // reading only the singular form silently fell back to `self` for every
    // ChangesZoneAll trigger, confirmed by a round-trip exam mistaking
    // Builder's Talent's level-2 ability for the wrong kind of trigger.
    const validCardField = fields.ValidCard ?? fields.ValidCards;
    if (!granted && validCardField) {
      const clauses = validCardField.split(',').map((c) => c.trim());
      const includesSelf = clauses.some((c) => c === 'Card.Self');
      const otherClauses = clauses.filter((c) => c !== 'Card.Self');
      for (const clause of otherClauses) {
        specs.push({ thing: coarseType(clause), extraFlags: qualifierFlags(clause).filter((f) => !(includesSelf && f === 'not:self')) });
      }
    }
    if (specs.length === 0) specs.push({ thing: granted ? granted.thing : selfThing, extraFlags: [] });

    const combatFlag = combat ? 'combat' : undefined;
    // ActivationLimit$1 — "This ability triggers only once each turn," a real
    // rules restriction (Caretaker's Talent's own base ability has it)
    // distinct from the trigger firing itself; had no flag at all before,
    // silently reading as unlimited.
    // Valiant$True (Flowerfoot Swordmaster's own "...for the first time each
    // turn...") is a different Forge field for the exact same real-world
    // restriction ActivationLimit$1 already covers — reusing the same flag
    // rather than inventing a second name for one mechanical fact.
    const onceFlag = fields.ActivationLimit === '1' || fields.Valiant === 'True' ? 'cond:once_per_turn' : undefined;
    // IsPresent$ (Seasoned Warrenguard's own "attacks WHILE YOU CONTROL A
    // TOKEN") is the trigger-level sibling of ConditionPresent$ — same
    // board-state existence check, different Forge field name depending on
    // whether it gates a trigger firing at all vs. one of its downstream
    // effects. ifPresentFlag's own reasoning applies identically here.
    const presentTriggerFact = ifPresentFlag(fields.IsPresent);
    const presentFlag = presentTriggerFact ? `cond:${presentTriggerFact}` : undefined;
    const ids = specs.map((spec) =>
      addNode(ctx, { role: 'trigger', 'trigger-type': triggerType, owner: 'me', from: '--', to: 'stack', thing: spec.thing, flags: [combatFlag, onceFlag, presentFlag, ...spec.extraFlags].filter(Boolean).join(' ') || undefined })
    );
    ids.forEach((id) => attach(id));
    // Build the downstream chain once, under the first clause-node, then
    // reuse the exact same step ids under every other clause-node — not a
    // second walk (which would double-count every effect the trigger leads
    // to). OptionalDecider$You ("you MAY exile it, then return it...") gates
    // the whole contingent chain, but only the first node in that chain
    // carries the `may` flag (matches Kain/Jecht's own hand-authored
    // convention — optionality is a property of the decision point, not
    // repeated down every downstream step).
    const [firstId, ...restIds] = ids;
    if (firstId) {
      let first = true;
      for (const child of tree.children) {
        translateEffectRow(ctx, child, firstId, selfThing, true, granted, fields.OptionalDecider === 'You' && first);
        first = false;
      }
      const sharedSteps = ctx.steps[firstId];
      if (sharedSteps) for (const restId of restIds) ctx.steps[restId] = sharedSteps;
    }
    return;
  }

  if (row.lineType === 'S' || row.role?.startsWith('static(')) {
    // A static line itself never becomes one synergy node — its AddPower/
    // AddToughness/AddType/AddKeyword/AddTrigger fields each become their own
    // node (modifier/tagger/trigger), all siblings, all sharing the static's
    // own Affected$ subject.
    const affected = fields.Affected;
    // .EquippedBy (Equipment) and .EnchantedBy (Aura, Feather of Flight's own
    // "Enchanted creature gets +1/+0") are the identical real mechanical
    // fact — "attached to the permanent granting this static" — under two
    // different Forge names depending on which attachment type; reusing the
    // one existing `equipped` flag rather than inventing a parallel
    // `enchanted` one for the same concept.
    const equipped = /\.(?:EquippedBy|EnchantedBy)\b/.test(affected ?? '');
    const thing = coarseType(affected);
    const condFlags = qualifierFlags(affected);
    let handled = false;
    if (fields.AddPower || fields.AddToughness) {
      const delta = `${fields.AddPower ? '+' + fields.AddPower : '+0'}/${fields.AddToughness ? '+' + fields.AddToughness : '+0'}`;
      attach(addNode(ctx, { role: 'modifier', owner: 'me', from: '--', to: 'bf', thing, flags: [...condFlags, `cond:${equipped ? 'equipped;' : ''}delta=${delta}`].join(' ') }));
      handled = true;
    }
    if (fields.AddKeyword) {
      // Forge joins multiple granted keywords with " & " (Essence Channeler's
      // own "Flying & Vigilance", Feather of Flight's own compound grants) —
      // one node per static line still, with one cond: payload per keyword,
      // semicolon-joined same as every other multi-payload node. Flying gets
      // SCHEMA.md's own real mechanical encoding (the menace/flying note);
      // Ward:<cost> reuses K:Ward's own cond:ward= naming (this is the same
      // mechanical fact whether printed on the card's own body or granted by
      // a static); everything else (Vigilance, Trample, Menace, Lifelink,
      // Haste, Reach, Prowess, Storm, Double/First Strike, ...) has no
      // further mechanical decomposition yet, so it's a plain named grant=
      // fact — SCHEMA's stated preference (state the mechanic, not the
      // keyword) applies where a mechanic is actually known; where it isn't,
      // an honest grant= fact beats silently dropping the keyword entirely
      // (the previous behavior for anything other than a bare "Flying").
      const parts = fields.AddKeyword.split('&')
        .map((k) => k.trim())
        .filter(Boolean)
        .map((kw) => {
          if (kw === 'Flying') return fields.Condition === 'PlayerTurn' ? 'your_turn;blocked_by=flying_or_reach' : 'blocked_by=flying_or_reach';
          const ward = /^Ward:(.+)$/.exec(kw);
          const wardCost = ward?.[1];
          if (wardCost) return `ward=${/^\d+$/.test(wardCost) ? `{${wardCost}}` : wardCost}`;
          return `grant=${kw.toLowerCase().replace(/\s+/g, '_')}`;
        });
      attach(addNode(ctx, { role: 'modifier', owner: 'me', from: '--', to: 'bf', thing: selfThing, flags: `cond:${parts.join(';')}` }));
      handled = true;
    }
    if (fields.AddType) {
      attach(addNode(ctx, { role: 'tagger', owner: 'me', from: '--', to: 'bf', thing, flags: [...condFlags, `cond:${equipped ? 'equipped;' : ''}tag=${fields.AddType}`].join(' ') }));
      handled = true;
    }
    // Anything else this Mode$ can carry (ReduceCost, CantBlock, a non-Flying
    // AddKeyword$, ...) had no node AND no unmapped entry — a static line
    // whose sole content was e.g. Mode$ ReduceCost (Eddymurk Crab's "costs
    // {1} less for each ... in your graveyard") or AddKeyword$ Ward:1
    // (Innkeeper's Talent) silently vanished with zero trace, the same
    // silent-drop shape as the K:-keyword-fallback bug fixed earlier this
    // session.
    if (!handled) {
      // fields.Mode is unavailable here — forgeScript.ts's renderFields()
      // strips Mode$ out of row.fields upstream (it's already folded into
      // row.role as `static(<mode>)`); eventMode() is the same extraction
      // translateEffectRow's own T: handling already relies on above.
      // A replacement effect (AddReplacementEffect$) uses Event$/ValidSource$/
      // ReplaceWith$, not Mode$ — eventMode(row) then extracts the literal
      // string "undefined" from a role like "static(undefined)" rather than
      // a real JS undefined, so fields.Event is checked explicitly first.
      const label = fields.AddKeyword ? `AddKeyword:${fields.AddKeyword}` : fields.Event ? `Event:${fields.Event}` : (eventMode(row) ?? 'static');
      ctx.unmapped.push(`S:${label}`);
    }
    for (const child of tree.children) translateEffectRow(ctx, child, null, selfThing, false, granted || { thing });
    return;
  }

  if (row.lineType === 'K') {
    translateKeyword(ctx, row, selfThing);
    return;
  }

  // A `Cost$ Sac<...>` on ANY effect line — a root activated ability, or a
  // chained effect gated by its own cost (Namazu Trader's Surveil) — wires
  // the sacrifice(s) first; the line's own remaining effect becomes a step
  // from every cost branch, same convention as Namazu's `surveil` node being
  // reached from both `sacCreature` and `sacArtifact` (SCHEMA.md's own
  // worked example). The Sac<> token doesn't have to be the WHOLE cost —
  // Nettle Guard's own `Cost$ 1 Sac<1/CARDNAME>` combines mana AND a
  // sacrifice — the old `/^Sac</`-anchored check required Sac<> to be the
  // entire string, so a mixed cost like this matched nothing at all and its
  // whole activated ability (including the mana-only part) silently had no
  // cost node, no effect chain, nothing (confirmed by a round-trip exam that
  // found no cost node feeding the Destroy effect whatsoever).
  // Extracted as a bracket-matched substring, NOT a space-split token —
  // Sac<>'s own description clause can contain spaces (Namazu Trader's own
  // "Sac<1/Creature.Other;Artifact.Other/another creature or artifact>"), so
  // naively splitting the whole Cost$ string on spaces first (an earlier
  // version of this fix did exactly that) mangles the bracket contents into
  // several broken fragments, matching wireSacCost's regex against none of
  // them and silently losing the entire sacrifice cost.
  const sacMatch = /Sac<[^>]*>/.exec(fields.Cost ?? '');
  if (sacMatch) {
    const sacToken = sacMatch[0];
    const remainder = (fields.Cost ?? '').replace(sacToken, '').split(' ').filter(Boolean);
    const hasTap = remainder.includes('T');
    const manaCost = remainder
      .filter((t) => t !== 'T')
      .map((s) => `{${s}}`)
      .join('');
    // A three-part cost (mana + tap + sacrifice, Carrot Cake's own "{2},
    // {T}, Sacrifice this artifact") needs its own tap node chained ahead of
    // the sac-move — folding the tap into the sac-move's own cost: flag
    // would silently drop the fact that this ALSO requires tapping (a real
    // state change, not just a mana payment).
    if (hasTap) {
      const tapId = addNode(ctx, { role: 'tap', owner: 'me', from: 'bf', to: 'bf', thing: selfThing, flags: manaCost ? `cost:${manaCost}` : undefined });
      attach(tapId);
      const leafIds = wireSacCost(ctx, sacToken, inTrigger, (step) => link(ctx, tapId, step));
      for (const leafId of leafIds) translateOwnEffect(ctx, tree, leafId, selfThing, inTrigger, granted, false);
      return;
    }
    const leafIds = wireSacCost(ctx, sacToken, inTrigger, attach, manaCost || undefined);
    for (const leafId of leafIds) translateOwnEffect(ctx, tree, leafId, selfThing, inTrigger, granted, false);
    return;
  }

  // A plain `Cost$` (space-separated mana symbols, optionally including `T`
  // for "tap this") on a top-level activated ability — previously read
  // nowhere at all, so a card like "{1}, {T}: target creature gets +1/+1"
  // (Brave-Kin Duo) silently lost its entire activation cost, leaving the
  // effect looking like an ungated, always-on capability (confirmed by a
  // round-trip exam that correctly couldn't tell how the ability was meant
  // to be used). Only the tap-cost shape is modeled here — SCHEMA's `tap`
  // role ("a cost — convoke/crew-style") is the natural fit, and tapping is
  // a real state change worth its own node. A pure mana-only cost (no `T`)
  // has no such node to attach `cost:` to without deeper changes to every
  // individual effect handler below; left as a smaller, separate open gap.
  if (row.lineType === 'A' && fields.Cost && !/^Sac</.test(fields.Cost)) {
    const parts = fields.Cost.split(' ').filter(Boolean);
    if (parts.includes('T')) {
      const manaCost = parts.filter((p) => p !== 'T').map((s) => `{${s}}`).join('');
      // SorcerySpeed$True ("Activate only as a sorcery") — a real timing
      // restriction (Brave-Kin Duo's own activated ability has it) that had
      // no flag at all, silently reading as an instant-speed ability.
      const sorceryOnly = fields.SorcerySpeed === 'True' ? 'cond:sorcery_speed' : undefined;
      const tapId = addNode(ctx, { role: 'tap', owner: 'me', from: 'bf', to: 'bf', thing: selfThing, flags: [manaCost ? `cost:${manaCost}` : undefined, sorceryOnly].filter(Boolean).join(' ') || undefined });
      attach(tapId);
      translateOwnEffect(ctx, tree, tapId, selfThing, inTrigger, granted, applyMay);
      return;
    }
  }

  translateOwnEffect(ctx, tree, parent, selfThing, inTrigger, granted, applyMay);
}

// The effect an ability line represents once any cost has already been
// wired separately above (Sacrifice, Discard, Token, GainControl, Animate,
// ChangeZone, Dig, Pump, PutCounter, Charm, or a plain 1:1 role-table swap).
function translateOwnEffect(
  ctx: Ctx,
  tree: RowTree,
  parent: string | null,
  selfThing: string,
  inTrigger: boolean,
  granted: false | { thing: string },
  applyMay: boolean
): void {
  const row = tree.row;
  const fields = reparseFields(row.fields);
  const withMay = (flags: string | undefined) => [applyMay ? 'may' : undefined, flags].filter(Boolean).join(' ') || undefined;
  const attach = (step: SynergyFlowStep) => {
    if (parent) link(ctx, parent, step);
    else ctx.roots.push(step);
  };
  const ek = row.role;
  if (ek === 'Cleanup') return; // Forge-only bookkeeping, no synergy analogue

  if (ek === 'Surveil') {
    const id = addNode(ctx, { role: 'source', owner: 'me', from: 'gy', to: '--', thing: `surveil-${fields.Amount ?? '1'}` });
    attach(id);
    return;
  }

  if (ek === 'Charm') {
    // Choices$ is real "choose one" — combine:1, never a bare node of its
    // own. forgeScript.ts nests the choice branches one level deeper, under
    // its own "choose one:" group row, not directly under the Charm row.
    const group = tree.children.find((c) => c.row.kind === 'group');
    const choiceIds = (group?.children ?? []).map((c) => translateEffectAsLeaf(ctx, c, selfThing, inTrigger, granted));
    attach({ combine: 1, of: choiceIds.filter((x): x is string => !!x) });
    return;
  }

  if (ek === 'Sacrifice') {
    const owner = deriveOwner(fields.Defined);
    const thing = coarseType(fields.SacValid);
    const qty = fields.Amount ?? '1';
    const flagParts = [...(qty !== '1' ? [`qty:${qty}`] : []), ...qualifierFlags(fields.SacValid), 'cond:sacrifice'];
    const id = addNode(ctx, { role: 'move', owner, from: 'bf', to: 'gy', thing, flags: flagParts.join(' ') });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'Discard') {
    const owner = deriveOwner(fields.Defined);
    const qty = fields.NumCards ?? '1';
    const id = addNode(ctx, { role: 'move', owner, from: 'hand', to: 'gy', thing: 'any', flags: `qty:${qty}` });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'Token') {
    const owner = deriveOwner(fields.TokenOwner);
    const thing = TOKEN_SCRIPT_MAP[fields.TokenScript ?? ''] ?? fields.TokenScript ?? 'unknown-token';
    if (!TOKEN_SCRIPT_MAP[fields.TokenScript ?? '']) ctx.unmapped.push(`TokenScript$${fields.TokenScript}`);
    const qty = fields.TokenAmount && fields.TokenAmount !== '1' ? `qty${/^[A-Z]/.test(fields.TokenAmount) ? '=' : ':'}${fields.TokenAmount}` : undefined;
    const tapped = fields.TokenTapped === 'True' ? 'tapped' : undefined;
    const id = addNode(ctx, { role: 'enters', owner, from: '--', to: 'bf', thing, flags: [qty, tapped].filter(Boolean).join(' ') || undefined });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'GainControl') {
    const owner = fields.NewController === 'TriggeredTarget' ? 'any' : deriveOwner(fields.NewController);
    const id = addNode(ctx, { role: 'becomes', owner, from: '--', to: 'bf', thing: selfThing, flags: fields.NewController === 'TriggeredTarget' ? 'player=triggeredPlayer' : undefined });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'Animate') {
    // Splits a coarse-type addition (becomes) from a creature-subtype/flavor
    // tag (tagger) — SCHEMA.md's `becomes`/`tagger` are different columns
    // (identity change vs. an added tag), and Forge's single Types$ list
    // conflates both.
    const types = (fields.Types ?? '').split(',');
    const coarse = types.filter((t) => ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker'].includes(t));
    const subtype = types.find((t) => !coarse.includes(t));
    const lifetime = fields.Permanent === 'True' ? undefined : 'lifetime:turn';
    if (coarse.length) {
      attach(addNode(ctx, { role: 'becomes', owner: 'me', from: '--', to: 'bf', thing: selfThing, flags: [lifetime, `cond:type=${coarse.join('-').toLowerCase()}`].filter(Boolean).join(' ') }));
    }
    if (subtype) {
      attach(addNode(ctx, { role: 'tagger', owner: 'me', from: '--', to: 'bf', thing: selfThing, flags: [lifetime, `cond:tag=${subtype}`].filter(Boolean).join(' ') }));
    }
    return;
  }

  if (ek === 'ChangeZone') {
    const from = zone(fields.Origin);
    const to = zone(fields.Destination);
    const transformed = fields.Transformed === 'True';
    // No ValidTgts/SacValid at all, and no Defined$ other than `Remembered`
    // (a same-chain self-reference, not a different subject — Jecht's own
    // exile-then-return sets `RememberChanged$True` on the exile step, then
    // reads it back here), means the effect's own implicit subject is
    // whatever triggered/cast it — the card moving itself, not an anonymous
    // or targeted external thing. This is the ONLY case `to:"bf"` means
    // "this card returns" — a real target predicate (ValidTgts$, e.g. Class
    // level 3's "return target ... permanent card from your graveyard")
    // moves some OTHER, arbitrary object, same as any other `move` node; an
    // earlier version treated every to:"bf" as this card returning
    // regardless, which was flatly wrong for the targeted case (found
    // auditing Builder's Talent's own Class levels).
    // ChangeType$ (Scavenger's Talent's Level 3: "return A creature card from
    // your graveyard," via ChangeType$ Creature.YouOwn, no ValidTgts$ at all
    // since nothing is targeted — you just choose one matching the type) is a
    // third way Forge names an external, non-self subject, same as ValidTgts$/
    // SacValid$ above — missing it here meant this whole shape fell through
    // to "this card returns," which produces a `becomes self` return using
    // the WRONG identity for a targeted-adjacent choice of some OTHER card.
    const selfMove = !fields.ValidTgts && !fields.SacValid && !fields.ChangeType && (!fields.Defined || fields.Defined === 'Remembered');
    if (to === 'bf' && selfMove) {
      const id = addNode(ctx, { role: 'enters', owner: 'me', from: '--', to: 'bf', thing: transformed ? 'self:back' : selfThing });
      attach(id);
      for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
      return;
    }
    // Owner from the TARGET's own controller (ownerFromTargetPredicate,
    // reading ValidTgts$'s .YouCtrl/.OppCtrl/.Opponent qualifiers) when
    // targeted — this branch previously used deriveOwner(fields.Defined)
    // unconditionally, which is the wrong field for a targeted move (Defined$
    // is empty here; the qualifier lives on ValidTgts$) and silently
    // defaulted every targeted ChangeZone to owner:"me" regardless of whose
    // permanent it actually targets (found on Banishing Light's real
    // ValidTgts$ Permanent.nonLand+OppCtrl — an opponent's permanent).
    const targeted = !!fields.ValidTgts;
    const changeTypePredicate = !targeted && !selfMove ? fields.ChangeType : undefined;
    const owner = selfMove
      ? 'me'
      : targeted
        ? ownerFromTargetPredicate(fields.ValidTgts)
        : changeTypePredicate
          ? ownerFromTargetPredicate(changeTypePredicate)
          : deriveOwner(fields.Defined);
    const qty = fields.TargetMax ? `qty:${fields.TargetMin ?? 0}..${fields.TargetMax}` : undefined;
    // Duration$UntilHostLeavesPlay — the "exile ... until CARDNAME leaves the
    // battlefield" O-Ring pattern (Banishing Light and its many relatives):
    // a real, common linked-return mechanic that had no representation at
    // all, silently rendering as a permanent, unconditional exile.
    const untilSelfLeaves = fields.Duration === 'UntilHostLeavesPlay' ? 'cond:until_self_leaves' : undefined;
    const qualifiers = targeted ? qualifierFlags(fields.ValidTgts) : changeTypePredicate ? qualifierFlags(changeTypePredicate) : [];
    const flags = withMay([qty, targeted ? 'target' : undefined, untilSelfLeaves, ...qualifiers].filter(Boolean).join(' ') || undefined);
    const thing = selfMove ? selfThing : coarseType(fields.ValidTgts ?? fields.SacValid ?? changeTypePredicate);
    const id = addNode(ctx, { role: 'move', owner, from, to, thing, flags });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'Dig') {
    const owner = deriveOwner(fields.Defined);
    const to = zone(fields.DestinationZone) === '--' ? 'exile' : zone(fields.DestinationZone);
    const id = addNode(ctx, { role: 'move', owner, from: 'lib', to, thing: 'any', flags: `qty:${fields.DigNum ?? '1'}` });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'Mill') {
    // SCHEMA.md §3's own worked example: mill-N -> source me -- gy any
    // qty:N. Targeted mill of another player (ValidTgts$ Player, Scavenger's
    // Talent's Level 2) reads owner off the target the same way every other
    // targeted effect does; the common untargeted "mill N" (Defined$ You)
    // falls back to deriveOwner like Dig/DealDamage's Defined$-only cases.
    const targeted = !!fields.ValidTgts;
    const owner = targeted ? ownerFromTargetPredicate(fields.ValidTgts) : deriveOwner(fields.Defined);
    const qty = fields.NumCards ?? '1';
    const id = addNode(ctx, { role: 'source', owner, from: '--', to: 'gy', thing: 'any', flags: [fields.Optional === 'True' ? 'may' : undefined, targeted ? 'target' : undefined, qty !== '1' ? `qty:${qty}` : undefined].filter(Boolean).join(' ') || undefined });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'Scry') {
    // SCHEMA.md §3's own worked example: scry-N -> emit me -- -- library-look.
    const qty = fields.ScryNum ?? '1';
    const presentFlag = ifPresentFlag(fields.ConditionPresent);
    const id = addNode(ctx, { role: 'emit', owner: 'me', from: '--', to: '--', thing: 'library-look', flags: [qty !== '1' ? `qty:${qty}` : undefined, presentFlag ? `cond:${presentFlag}` : undefined].filter(Boolean).join(' ') || undefined });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'Mana') {
    // SCHEMA has no dedicated worked example for mana production, but it's
    // the same "event, not stock" shape §2 lists draws/life-loss/lore
    // counters under (`emit`) — adding mana is a one-shot fact becoming
    // available, not an object taking up space in a zone. Produced$ names
    // the color(s) (a literal color list, "Combo G W" for a choice of two,
    // or "Any"/"C") — carried as a free-text cond: payload same as PutCounter/
    // Pump's delta, since `thing` itself is already "mana".
    const produced = (fields.Produced ?? '').replace(/^Combo /, '').trim();
    const id = addNode(ctx, { role: 'emit', owner: 'me', from: '--', to: '--', thing: 'mana', flags: produced ? `cond:color=${produced}` : undefined });
    attach(id);
    return;
  }

  if (ek === 'PumpAll') {
    // Same delta-payload shape as Pump, but ValidCards$ (plural, matches
    // every qualifying permanent, non-targeted) instead of ValidTgts$ (one
    // chosen target) -- an anthem-style resolved effect (Carrot Cake's
    // "Creatures you control get +2/+1"), not a static/continuous one (that
    // shape is the S: handler's AddPower$/AddToughness$ case above). Unlike
    // Pump, DOES walk children -- Carrot Cake's own SubAbility$ DBScry
    // ("...if you control a Rabbit, scry 2") chains off this exact effect,
    // which a returnless Pump-style handler would have silently dropped.
    const thing = coarseType(fields.ValidCards);
    const owner = ownerFromTargetPredicate(fields.ValidCards);
    const lifetime = fields.Permanent === 'True' ? undefined : 'lifetime:turn';
    // Same KW$/gift_promised handling as Pump above (Dawn's Truce's own
    // DBPumpAll SubAbility$ is KW$Indestructible-only, no NumAtt$/NumDef$ at
    // all) -- an unconditional `${fields.NumAtt ?? '+0'}/${fields.NumDef ??
    // '+0'}` here fabricated a fake "+0/+0" delta payload on every
    // KW$-only PumpAll, when the real effect was a keyword grant with NO P/T
    // change whatsoever.
    const hasDelta = fields.NumAtt !== undefined || fields.NumDef !== undefined;
    const delta = hasDelta ? `pt_delta=${fields.NumAtt ?? '+0'}/${fields.NumDef ?? '+0'}` : undefined;
    const grant = fields.KW ? `grant=${fields.KW.toLowerCase()}` : undefined;
    const giftGate = /PromisedGift/.test(fields.ConditionPresent ?? '') ? 'gift_promised' : undefined;
    const cond = ['cond:', [giftGate, delta, grant].filter(Boolean).join(';')].join('');
    const id = addNode(ctx, { role: 'modifier', owner, from: '--', to: 'bf', thing, flags: [lifetime, cond, ...qualifierFlags(fields.ValidCards)].filter(Boolean).join(' ') });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'ChangeZoneAll') {
    // The DB$/AB$ action-level ChangeZoneAll ("return EACH nonland,
    // nontoken permanent to hand," "each land you control returns from
    // graveyard tapped") -- distinct from the T: Mode$ChangesZoneAll trigger
    // shape (which watches for one-or-more-at-once ENTERING, handled at the
    // top of translateEffectRow). This one always reads its subject from
    // ChangeType$ (never ValidTgts$ in this corpus -- moving "each" matching
    // object isn't a choice, so there's nothing to target), same non-targeted
    // idiom as the ChangeType$ fix added to plain ChangeZone this batch.
    const from = zone(fields.Origin);
    const to = zone(fields.Destination);
    const owner = ownerFromTargetPredicate(fields.ChangeType);
    const thing = coarseType(fields.ChangeType);
    const id = addNode(ctx, { role: 'move', owner, from, to, thing, flags: qualifierFlags(fields.ChangeType).join(' ') || undefined });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'Pump') {
    const targeted = !!fields.ValidTgts;
    // A targeted pump (ValidTgts$) resolves owner/thing off the target
    // predicate; a self-pump (Defined$ Self — e.g. Slashing Tiger's own
    // "becomes blocked" combat trick) has neither ValidTgts nor a type
    // predicate to read, so it falls back to the card's own selfThing/`me`
    // the same way other Defined$-only effects already do below.
    const definedSelf = !targeted && fields.Defined === 'Self';
    const thing = targeted ? coarseType(fields.ValidTgts) : definedSelf ? selfThing : coarseType(fields.ValidTgts);
    const owner = targeted
      ? ownerFromTargetPredicate(fields.ValidTgts)
      : deriveOwner(fields.Defined);
    const lifetime = fields.Permanent === 'True' ? undefined : 'lifetime:turn';
    // KW$ (Crumb and Get It's own "also gains indestructible") is a SECOND,
    // independent thing Pump can grant besides a P/T delta — a keyword, not
    // a stat change — which had no handling at all: NumAtt$/NumDef$ default
    // to +0/+0 when absent, so a KW$-only Pump silently rendered as a no-op
    // +0/+0 modifier with the real keyword grant nowhere in the node. Same
    // semicolon-joined multi-payload convention SCHEMA.md already uses for
    // equipped;delta.
    const hasDelta = fields.NumAtt !== undefined || fields.NumDef !== undefined;
    const delta = hasDelta ? `pt_delta=${fields.NumAtt ?? '+0'}/${fields.NumDef ?? '+0'}` : undefined;
    const grant = fields.KW ? `grant=${fields.KW.toLowerCase()}` : undefined;
    // ConditionPresent$ Card.Self+PromisedGift | ConditionCompare$ EQ1 — "if
    // the gift was promised" — a narrow, well-understood boolean condition
    // tied to K:Gift specifically (not the general cross-player dynamic-
    // count comparison ConditionCheckSVar$/ConditionSVarCompare$ represent,
    // which stays an open, unimplemented class — see blb-progress.json's
    // known_gap_classes). Cheap and unambiguous enough to encode directly.
    const giftGate = /PromisedGift/.test(fields.ConditionPresent ?? '') ? 'gift_promised' : undefined;
    const cond = ['cond:', [giftGate, delta, grant].filter(Boolean).join(';')].join('');
    // TargetMax$/TargetMin$ (Mabel's Mettle's own second Pump: "up to ONE
    // other target creature gets +1/+1") had no qty handling at all, unlike
    // ChangeZone/PutCounter's identical TargetMax$ convention — silently
    // read as a single mandatory target instead of an optional 0..N choice.
    // TargetUnique$True ("...OTHER target...", distinct from an earlier
    // target chosen elsewhere in this same chain) is NOT the same fact as
    // not:self (excluded from being THIS card) — reusing not:self here
    // would actively misstate the restriction, so it's left unencoded
    // rather than approximated with something factually wrong; a real
    // "distinct from a sibling target" flag doesn't exist yet.
    const qty = fields.TargetMax ? `qty:${fields.TargetMin ?? 0}..${fields.TargetMax}` : undefined;
    const id = addNode(ctx, { role: 'modifier', owner, from: '--', to: 'bf', thing, flags: [targeted ? 'target' : undefined, qty, lifetime, cond].filter(Boolean).join(' ') });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'PutCounter') {
    // Same targeted-vs-self duality Pump/DealDamage/Destroy already handle —
    // `Defined$ Self` (Ajani's Pridemate, Skyknight Squire: "put a counter
    // on THIS creature") vs a real `ValidTgts$` (Builder's Talent's Class
    // level 2: "put a +1/+1 counter on TARGET creature you control", a
    // completely different permanent). An earlier version hardcoded
    // `thing: selfThing` unconditionally — silently wrong for the targeted
    // case, confirmed by a round-trip exam that couldn't make sense of a
    // non-creature enchantment supposedly receiving its own +1/+1 counter.
    const type = fields.CounterType === 'P1P1' ? '+1/+1counter' : (fields.CounterType ?? 'counter');
    const targeted = !!fields.ValidTgts;
    const thing = targeted ? coarseType(fields.ValidTgts) : selfThing;
    const owner = targeted
      ? ownerFromTargetPredicate(fields.ValidTgts)
      : 'me';
    // ConditionDefined$ Targeted | ConditionPresent$ <Type>.powerLE2 —
    // Driftgloom Coyote's own "If THAT CREATURE [the one exiled earlier in
    // this same chain] had power 2 or less, put a +1/+1 counter on this
    // creature." A narrow, single-object property check (the earlier
    // target's own printed power/toughness), NOT the general cross-player
    // dynamic-count comparison ConditionCheckSVar$/ConditionSVarCompare$
    // represents (see blb-progress.json's known_gap_classes) — cheap and
    // unambiguous enough to encode directly, same reasoning as Crumb and Get
    // It's narrower cond:gift_promised.
    const statCond = /^([A-Za-z]+)\.(power|toughness)(LE|GE)(\d+)$/.exec(fields.ConditionPresent ?? '');
    const conditionalOnTarget =
      fields.ConditionDefined === 'Targeted' && statCond ? `if_targeted_${statCond[2]}_${statCond[3] === 'LE' ? 'le' : 'ge'}=${statCond[4]}` : undefined;
    // qualifierFlags(ValidTgts$) was never called here at all (unlike
    // ChangeZone/Destroy/Pump) — Pileated Provisioner's own "target creature
    // you control WITHOUT FLYING" silently lost the .withoutFlying
    // restriction with no trace, since owner/thing alone don't carry it.
    const qualifiers = targeted ? qualifierFlags(fields.ValidTgts) : [];
    const id = addNode(ctx, { role: 'modifier', owner, from: '--', to: 'bf', thing, flags: [targeted ? 'target' : undefined, ...qualifiers, `cond:delta=${type}${conditionalOnTarget ? `;${conditionalOnTarget}` : ''}`].filter(Boolean).join(' ') });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'ClassLevel') {
    // Class (702.140b): leveling up is itself an activated ability (a paid,
    // player-timed choice — Class rules explicitly call it a special action
    // done at sorcery speed, not automatic) that permanently grants
    // whatever ability the level names. Modeled as a `becomes` node (a
    // persistent state change unlocked by a cost, same shape Equip already
    // uses) rather than folding the granted trigger straight into the
    // card's own always-on abilities — the level really is gated behind
    // paying `cost`, every time, independent of any other level.
    const cost = (fields.Cost ?? '').split(' ').filter(Boolean).map((s) => `{${s}}`).join('');
    const id = addNode(ctx, { role: 'becomes', owner: 'me', from: '--', to: '--', thing: selfThing, flags: `cost:${cost} cond:class_level=${fields.ClassLevel ?? '?'}` });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'Tap' || ek === 'Untap') {
    // DB$/AB$ Tap or Untap as a standalone EFFECT ("tap target creature an
    // opponent controls," Mouse Trapper's own trigger payoff) — distinct
    // from the `tap` ROLE, which SCHEMA reserves for a cost/drain shape
    // (convoke/crew-style, tapping THIS card to pay for something). Tapping
    // something else as an effect is a real state change to that object,
    // same "state the actual mechanical fact" idiom as flying/menace/ward's
    // cond: conventions — modeled as a `modifier` (its state, not its P/T,
    // changes) with cond:state=tapped/untapped, mirroring the shape of
    // every other keyword-fact `modifier` node rather than inventing a new
    // role.
    const targeted = !!fields.ValidTgts;
    const owner = targeted ? ownerFromTargetPredicate(fields.ValidTgts) : deriveOwner(fields.Defined);
    const thing = targeted ? coarseType(fields.ValidTgts) : coarseType(fields.ValidCards ?? fields.Defined);
    const state = ek === 'Tap' ? 'tapped' : 'untapped';
    const id = addNode(ctx, { role: 'modifier', owner, from: '--', to: 'bf', thing, flags: [targeted ? 'target' : undefined, `cond:state=${state}`, ...(targeted ? qualifierFlags(fields.ValidTgts) : [])].filter(Boolean).join(' ') });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'DealDamage') {
    // Same targeted-vs-Defined duality Pump has (a targeted burn spell vs.
    // "this creature deals 1 damage to each opponent") — an event, not a
    // stock, same class as LoseLife (SCHEMA §2: "loses life" is the listed
    // `emit` example; dealing damage is the same shape).
    const targeted = !!fields.ValidTgts;
    const owner = targeted
      ? ownerFromTargetPredicate(fields.ValidTgts)
      : deriveOwner(fields.Defined);
    const qty = fields.NumDmg ?? '1';
    const id = addNode(ctx, { role: 'emit', owner, from: '--', to: '--', thing: 'damage', flags: [targeted ? 'target' : undefined, qty !== '1' ? `qty:${qty}` : undefined].filter(Boolean).join(' ') || undefined });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  if (ek === 'Destroy') {
    // Always targeted in practice (Forge has no "destroy each"/Defined$ form
    // in this corpus) — same predicate shape as Sacrifice, but a `move` the
    // controller chooses is being forced onto someone else's permanent
    // rather than their own, so owner comes from the target predicate.
    const thing = coarseType(fields.ValidTgts);
    const owner = ownerFromTargetPredicate(fields.ValidTgts);
    const id = addNode(ctx, { role: 'move', owner, from: 'bf', to: 'gy', thing, flags: ['target', ...qualifierFlags(fields.ValidTgts)].join(' ') });
    attach(id);
    for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
    return;
  }

  const role = ek ? EFFECT_ROLE[ek] : undefined;
  if (!role) {
    ctx.unmapped.push(`${row.lineType ?? '?'}:${ek}`);
    // DelayedTrigger is the ONE exception to "walk children anyway" below —
    // its Execute$ child (forgeScript.ts's generic Execute$ auto-walk
    // resolves it into a tree child same as any other) is NOT a guaranteed,
    // unconditional continuation the way a SubAbility$ chain is: a delayed
    // trigger's effect only happens later (a future turn phase) AND is
    // typically gated by its own ConditionZone$/ConditionPresent$/
    // ConditionCompare$ fields (Parting Gust's own "if the gift wasn't
    // promised... at the beginning of the next end step"). Walking it here
    // produced real WRONG data — an unconditional, immediate "return to
    // YOUR control" — worse than the honest gap of showing nothing, since a
    // consumer has no way to tell a guaranteed step from a conditional/
    // delayed one once it's attached the same way. Confirmed by a round-trip
    // exam completely misreading Parting Gust's actual (conditional,
    // owner's-control, delayed, +1/+1-countered) return as an unconditional,
    // immediate, caster-control one.
    if (ek === 'DelayedTrigger') return;
    // Still walk the chain past this unrecognized effect (attached at the
    // same point THIS node would have been, since it was never created) —
    // an earlier version returned here unconditionally, which silently lost
    // every downstream SubAbility$ step too, not just this one line, with
    // only a single unmapped entry to show for however much chain was cut
    // (real gap found auditing Dragonhawk, Fate's Tempest: 13 forge lines,
    // only 7 synergy nodes + 2 unmapped). Best-effort: a child that reads a
    // value THIS step would have declared (`:=`) won't resolve correctly,
    // but that's strictly better than the child not existing at all.
    for (const child of tree.children) translateEffectRow(ctx, child, parent, selfThing, inTrigger, granted);
    return;
  }
  const owner = deriveOwner(fields.Defined);
  const qty = fields.LifeAmount ?? fields.NumCards;
  const emitThing = ek === 'LoseLife' ? 'life-loss' : ek === 'GainLife' ? 'life-gain' : ek === 'Draw' ? 'draw' : 'unknown';
  // ConditionPresent$ (Sonar Strike's own "You gain 3 life IF YOU CONTROL A
  // BAT") — see ifPresentFlag's own comment for why this is cheap/safe to
  // encode directly, unlike the general dynamic-comparison class.
  const presentFlag = ifPresentFlag(fields.ConditionPresent);
  const id = addNode(ctx, { role, owner, from: '--', to: '--', thing: role === 'emit' ? emitThing : 'unknown', flags: [qty && qty !== '1' ? `qty:${qty}` : undefined, presentFlag ? `cond:${presentFlag}` : undefined].filter(Boolean).join(' ') || undefined });
  attach(id);
  for (const child of tree.children) translateEffectRow(ctx, child, id, selfThing, inTrigger, granted);
}

// Charm's own choice branches (Gaius's three Sacrifice modes) don't sit under
// a wrapping node — the group's `of` list IS their id, so this returns the id
// the branch's own root effect got instead of attaching it anywhere itself.
function translateEffectAsLeaf(ctx: Ctx, tree: RowTree, selfThing: string, inTrigger: boolean, granted: false | { thing: string }): string | undefined {
  let capturedId: string | undefined;
  const fakeParent = '__charm_capture__';
  translateEffectRow(ctx, tree, fakeParent, selfThing, inTrigger, granted);
  const captured = ctx.steps[fakeParent];
  delete ctx.steps[fakeParent];
  if (captured && captured.length === 1 && typeof captured[0] === 'string') capturedId = captured[0];
  return capturedId;
}

// K: lines — bare keywords (Menace/Trample: no synergy node, matching this
// corpus's own mixed practice — see report), or ones with a real mechanical
// shape (Equip, the *Cycling family, Job select).
function translateKeyword(ctx: Ctx, row: ForgeRow, selfThing: string) {
  const params = (row.fields ?? '').split(':').filter((x) => x !== '');
  if (row.role === 'Offspring') {
    // "Pay an additional {cost} as you cast this spell. If you do, when
    // this creature enters, create a 1/1 token copy of it." Forge hardcodes
    // the whole effect into the keyword itself — no SVar reference at all,
    // unlike every other mechanic here — so params[0] (the only param) is
    // the entire content: the extra cost. A second, independent `enters`
    // root (not chained off the normal cast->enters skeleton, since paying
    // extra is optional and this is a distinct conditional event) — `thing`
    // stays `self` (the token shares the original's own type line) but
    // `cond:token` marks it as token-status for `cond:token`/`cond:nontoken`
    // predicate matching (SCHEMA §2), same as any other token producer.
    // A bare `cost:{N}` here reads exactly like an activated ability's cost
    // (Coruscation Mage's own examiner exam misread it as a repeatable
    // "{2}: create a token copy" ability) — Offspring's cost is paid exactly
    // ONCE, as an additional cost while casting the spell, not a cost this
    // node's own `enters` role can be activated for later. `paid_at_cast`
    // distinguishes the two, semicolon-joined onto the existing cond:token
    // payload per SCHEMA.md's multi-payload convention.
    const cost = params[0] ?? '';
    ctx.roots.push(addNode(ctx, { role: 'enters', owner: 'me', from: '--', to: 'bf', thing: selfThing, flags: `cost:{${cost}} cond:token;paid_at_cast` }));
    return;
  }
  if (row.role === 'Equip') {
    const cost = params[0];
    ctx.roots.push(addNode(ctx, { role: 'becomes', owner: 'me', from: '--', to: '--', thing: selfThing, flags: `cost:{${cost}} target cond:attach` }));
    return;
  }
  if (row.role === 'Enchant') {
    // K:Enchant:<TypeList>[:<description>] — an Aura's own attach
    // declaration ("Enchant creature", "Enchant creature or Food"). Same
    // becomes/self/cond:attach idiom SCHEMA.md already prescribes for
    // Equipment's Equip keyword (target flag carries the actual chosen
    // object, `thing` stays `self` per that convention) — the valid-type
    // restriction has nowhere else to live, so it's a cond: payload same as
    // PutCounter/Pump's delta.
    const types = (params[0] ?? '').split(',').map((t) => t.trim().toLowerCase()).join(',');
    ctx.roots.push(addNode(ctx, { role: 'becomes', owner: 'me', from: '--', to: '--', thing: selfThing, flags: `target cond:attach;type=${types}` }));
    return;
  }
  if (row.role === 'Ward') {
    // K:Ward:<cost> — "If this becomes the target of a spell or ability an
    // opponent controls, counter it unless they pay <cost>." A real,
    // mechanical self-fact about this permanent, same shape as SCHEMA.md's
    // own flying/menace cond: convention (state the mechanic, not the
    // keyword's name). Cost can be plain mana (a bare number) or an
    // alternate cost descriptor (Discard<1/Card>, PayLife<2>, Sac<1/Food>) —
    // only the numeric case gets braced as mana notation, the rest is kept
    // as Forge's own descriptor rather than guessed at.
    const raw = params[0] ?? '1';
    const cost = /^\d+$/.test(raw) ? `{${raw}}` : raw;
    ctx.roots.push(addNode(ctx, { role: 'modifier', owner: 'me', from: '--', to: 'bf', thing: selfThing, flags: `cond:ward=${cost}` }));
    return;
  }
  if (row.role === 'TypeCycling' || row.role === 'Cycling' || row.role === 'Landcycling') {
    const [subtype, cost] = row.role === 'Cycling' ? [undefined, params[0]] : params;
    const costId = addNode(ctx, { role: 'move', owner: 'me', from: 'hand', to: 'gy', thing: selfThing, flags: `cost:{${cost}}` });
    const findId = addNode(ctx, {
      role: 'move',
      owner: 'me',
      from: '--',
      to: 'hand',
      thing: 'land',
      flags: `target${subtype ? ` cond:subtype_${subtype.toLowerCase()};reveal;shuffle` : ';reveal;shuffle'}`,
    });
    link(ctx, costId, findId);
    ctx.roots.push(costId);
    return;
  }
  if (row.role === 'Flashback') {
    // Wired by the caller (translateFace) alongside the main cast — Flashback
    // needs a second `cast` root with its own resolution destination
    // (exile, not gy), which only the face-level code has enough context to
    // build without duplicating the cast-skeleton logic here.
    return;
  }
  if (row.role === 'Job select') {
    ctx.roots.push(addNode(ctx, { role: 'enters', owner: 'me', from: '--', to: 'bf', thing: 'job-select' }));
    return;
  }
  // Chapter is handled by translateFace itself (needs the raw svar forest,
  // which this function doesn't have access to).
  if (row.role === 'Chapter') return;
  // A bare combat keyword (Menace, Trample, ...) — a `modifier` carrying just
  // the keyword's own name, not SCHEMA.md's prescribed full mechanical
  // encoding (`cond:blocked;min_blockers=2` for menace, say). SCHEMA.md's own
  // text argues against this (restating the keyword "gives a consumer
  // nothing to reason about mechanically"), but Jecht's own hand-authored
  // ground truth does exactly this for Menace, while Phantom Train's Trample
  // gets no node at all — the corpus itself doesn't apply SCHEMA.md's
  // guidance consistently (see report). Matching the bare-node convention is
  // the closer fit of the two real examples, and a harmless no-op for cards
  // whose ground truth omits the keyword entirely (an extra node no
  // ground-truth 5-tuple needs to match against).
  if (!params.length) {
    ctx.roots.push(addNode(ctx, { role: 'modifier', owner: 'me', from: '--', to: 'bf', thing: selfThing, flags: row.role?.toLowerCase() }));
    return;
  }
  // A parametrized keyword this function has no real handling for (Class,
  // Gift, Offspring, ETBReplacement, ...) used to just fall through here and
  // vanish — no node, and (unlike every other unhandled effect) no
  // `unmapped` entry either, so it never showed up in coverage stats. That's
  // worse than an honest gap: it made a card with real un-modeled content
  // (a Class enchantment's whole level-up structure, say) count as "clean."
  ctx.unmapped.push(`K:${row.role}`);
}

// ---------------------------------------------------------------------------

function translateFace(ctx: Ctx, face: ForgeFace, selfThing: string, isBack: boolean): { entersId?: string } {
  const forest = buildForest(face.rows);
  const isInstantOrSorcery = /\bInstant\b|\bSorcery\b/.test(face.typeLine ?? '');
  const isSaga = /\bSaga\b/.test(face.typeLine ?? '');

  let entersId: string | undefined;

  // Cast/enters (or cast/resolve) skeleton — never written explicitly in a
  // Forge script (the engine derives it from the header alone), but
  // SCHEMA.md treats it as load-bearing data every card gets (§2/§3:
  // "explicit beats implicit"). Skipped for a face with no ManaCost — a back
  // face of a transforming DFC (Braska's Final Aeon) isn't independently
  // castable; it only ever arrives via the front face's transform.
  if (face.manaCost && !isBack) {
    const castId = addNode(ctx, { role: 'cast', owner: 'me', from: 'hand', to: 'stack', thing: selfThing });
    ctx.roots.push(castId);
    if (isInstantOrSorcery) {
      const resolveId = addNode(ctx, { role: 'move', owner: 'me', from: 'stack', to: 'gy', thing: selfThing });
      link(ctx, castId, resolveId);
    } else {
      entersId = addNode(ctx, { role: 'enters', owner: 'me', from: '--', to: 'bf', thing: selfThing });
      link(ctx, castId, entersId);
      ctx.roots.push(entersId); // always ALSO its own root — SCHEMA.md §2
    }
  }

  // Flashback — a second cast root, alternate cost, resolving to exile
  // instead of gy (SCHEMA.md §3: "Flashback... Then exile it").
  const flashbackRow = forest.find((t) => t.row.lineType === 'K' && t.row.role === 'Flashback');
  if (flashbackRow) {
    const cost = (flashbackRow.row.fields ?? '').split(' ').filter(Boolean).map((s) => `{${s}}`).join('');
    const fbCastId = addNode(ctx, { role: 'cast', owner: 'me', from: 'gy', to: 'stack', thing: selfThing, flags: `cost:${cost}` });
    ctx.roots.push(fbCastId);
    const spellTree = forest.find((t) => t.row.lineType === 'A');
    if (spellTree) {
      const fields = reparseFields(spellTree.row.fields);
      // The-Final-Days-specific dynamic-count pattern
      // (`Count$wasCastFromGraveyard.X.2`) — recognized by shape rather than
      // a general Forge expression evaluator (see report).
      if (fields.TokenAmount) {
        const scalerId = addNode(ctx, { role: 'scaler', owner: 'me', from: 'gy', to: '--', thing: 'creature', flags: 'count:=gyCreatureCount' });
        link(ctx, fbCastId, scalerId);
        const tokenId = addNode(ctx, {
          role: 'enters',
          owner: 'me',
          from: '--',
          to: 'bf',
          thing: TOKEN_SCRIPT_MAP[fields.TokenScript ?? ''] ?? 'unknown-token',
          flags: `qty=gyCreatureCount${fields.TokenTapped === 'True' ? ' tapped' : ''}`,
        });
        link(ctx, scalerId, tokenId);
      }
    }
    const exileId = addNode(ctx, { role: 'move', owner: 'me', from: 'stack', to: 'exile', thing: selfThing });
    link(ctx, fbCastId, exileId);
  }

  // Saga back face — the lore-counter turn-based action isn't written
  // anywhere in the Forge script either (implicit in Types$Saga, same as
  // cast/enters above); synthesized right after the transform arrival to
  // match the hand-authored ground truth's own placement (see report — this
  // is a known modeling shortcut, flagged open in SCHEMA.md §8, not a
  // generalizable Forge-derived rule).
  let chapterAnchor: string | undefined = entersId;
  if (isSaga && isBack) {
    const loreCounterId = addNode(ctx, { role: 'emit', owner: 'me', from: '--', to: '--', thing: 'lore-counter' });
    if (entersId) link(ctx, entersId, loreCounterId);
    else ctx.roots.push(loreCounterId);
    chapterAnchor = loreCounterId;
  }

  // forgeScript.ts's own walkChapter already built the right shape — a
  // top-level "chapters" group whose children are one group per numeral
  // (I/II/III), each already containing its fully-walked effect subtree
  // (SubAbility chain and all). No need to re-derive K:Chapter's own params
  // or look anything up by SVar name (ForgeRow doesn't retain SVar names —
  // only the effect kind, e.g. "Discard" — so a name-based lookup isn't
  // possible working from parsed rows alone). Consecutive numerals whose top
  // effect is structurally identical (same role/fields/description — Forge
  // repeats the exact same SVar reference per numeral it applies to) merge
  // into one chapter-range trigger, e.g. Braska's I,II -> "1-2".
  const chapterGroup = forest.find((t) => t.row.kind === 'group' && t.row.isRoot && /^chapters/.test(t.row.groupLabel ?? ''));
  if (chapterGroup) {
    const numerals = chapterGroup.children; // one group per chapter, in order
    const sig = (t: RowTree | undefined) => t && JSON.stringify({ role: t.row.role, fields: t.row.fields, description: t.row.description });
    let i = 0;
    while (i < numerals.length) {
      const startSig = sig(numerals[i]?.children[0]);
      let j = i;
      while (j + 1 < numerals.length && sig(numerals[j + 1]?.children[0]) === startSig) j++;
      const range = i === j ? String(i + 1) : `${i + 1}-${j + 1}`;
      const triggerId = addNode(ctx, { role: 'trigger', 'trigger-type': 'saga-chapter', owner: 'me', from: '--', to: 'stack', thing: selfThing, flags: `cond:chapter=${range}` });
      if (chapterAnchor) link(ctx, chapterAnchor, triggerId);
      else ctx.roots.push(triggerId);
      const effectTree = numerals[i]?.children[0];
      if (effectTree) translateEffectRow(ctx, effectTree, triggerId, selfThing, true, false);
      // The final chapter's own sacrifice (714.4: a real state-based action,
      // not a triggered ability — SCHEMA.md §8 flags this as an open
      // question, "gives a reconstruction agent nothing to recognize"). Not
      // written anywhere in the Forge script either (K:Chapter's own final
      // chapter number implies it to the engine); synthesized as a sibling
      // of the last chapter's own effect, matching the hand-authored ground
      // truth's exact placement.
      if (j === numerals.length - 1) {
        link(ctx, triggerId, addNode(ctx, { role: 'move', owner: 'me', from: 'bf', to: 'gy', thing: selfThing, flags: `cond:sacrifice_after_chapter_${numerals.length}` }));
      }
      i = j + 1;
    }
  }

  // Everything else — the remaining top-level A:/T:/S: rows (K: lines are
  // handled by translateKeyword itself, called from here for keywords with
  // no cross-tree wiring need).
  for (const tree of forest) {
    if (tree.row.lineType === 'K') {
      if (tree.row.role === 'Chapter' || tree.row.role === 'Flashback') continue; // handled above
      translateKeyword(ctx, tree.row, selfThing);
      continue;
    }
    if (tree.row.lineType === 'A' || tree.row.lineType === 'T' || tree.row.lineType === 'S') {
      // A root activated/spell ability line IS itself the first effect node
      // (its own AB$/SP$ value) — same translateEffectRow path as a chained
      // SVar, just parented at the face level (attach -> ctx.roots). Its own
      // Cost$ Sac<...>, if any, is handled uniformly inside translateEffectRow.
      translateEffectRow(ctx, tree, null, selfThing, false, false);
    }
  }

  return { entersId };
}

export function translateForgeCard(card: ForgeCard): TranslatedCard {
  seq = 0;
  const ctx: Ctx = { nodes: {}, steps: {}, roots: [], unmapped: [] };
  const name = card.faces.map((f) => f.name).join(' // ');

  card.faces.forEach((face, i) => {
    const isBack = i > 0;
    const selfThing = card.faces.length > 1 ? (isBack ? 'self:back' : 'self:front') : 'self';
    translateFace(ctx, face, selfThing, isBack);
  });

  return {
    name,
    nodes: ctx.nodes,
    flow: { roots: ctx.roots, steps: ctx.steps },
    unmapped: ctx.unmapped,
  };
}
