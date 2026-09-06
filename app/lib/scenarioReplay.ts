// Reconstructs per-step board state (zones/life) for one functional-model
// scenario trace (functional-model/harness.ts's TraceResult), for the
// scenarios tab's replay component (app/components/ScenarioReplay.vue).
//
// trace.json's `log` is a flat call log, not a board snapshot — most
// entries carry enough (a named `target`/`card`/`player`) to replay
// mutations, but the STARTING board (every filler creature/land/hand card
// setupPlayer manufactured — functional-model/harness.ts) never logs
// anything at all; it comes from the scenario's own `raw` field (added
// alongside `setup`/`action`/`result` specifically so this file doesn't
// have to parse prose back into counts). Self (the card under test) is the
// one exception: its own first log entry (cast/activate/trigger) always
// names it, so it needs no seeding here.
//
// Names double as identity here, same convention trace.json itself already
// uses (players/cards are logged by name, never by internal id) — filler
// names are per-player-prefixed by setupPlayer, so they're unique across
// players; a real card's own name is unique within one scenario's single
// GameState. Two real exceptions to that last rule (a >1-qty createToken
// batch; two genuinely distinct legendary copies sharing a name) are
// handled by pushing separate objects directly rather than aliasing
// through `ensure`'s shared name lookup — see `createToken`'s own case and
// `ensureSelf`'s own doc comment. `legendRule` itself still can't always
// tell WHICH of two same-named survivors/removals is which (no instanceId
// on that fn) — see that case's own doc comment for the remaining gap.

import type { LogEntry, PlayerState, Scenario } from '../../functional-model/harness';
import { GENERIC_FILLER_LAND } from '../../functional-model/harness';
import type { ZoneType } from '../../functional-model/interfaces';
import { TOKENS } from '../../functional-model/tokens';

export interface ReplayCard {
  name: string;
  /** Current face's own display name, when it differs from `name` — a transforming DFC's `trigger`/`activate` log entries report whatever face is active (Jill, Shiva's Dominant -> Shiva, Warden of Ice), but `moveTo`/`tap`/etc always report the ORIGINAL front name (`RealCard.name` never changes on transform — see harness.ts's `state.ts`) — `name` stays that stable identity key, this carries the latest face seen for display. */
  faceName?: string;
  /** True for the one card under test (registered via `ensureSelf` below) — the only card a real Scryfall image exists for; every filler/generic card `setupPlayer` manufactured gets a placeholder chip instead (see `placeholderLabel`). */
  isSelf?: boolean;
  zone: ZoneType | 'Unknown';
  owner: string;
  tapped: boolean;
  counters: Record<string, number>;
  /** Keywords granted mid-scenario (harness.ts's `grantKeyword` log entries) — a card's own PRINTED keywords (Flying on a creature that just has Flying) aren't logged at all (see harness.ts's own "quiet" per-object reads), so those come from elsewhere (the real Scryfall `card.keywords`, passed in separately for the one `isSelf` card) rather than being tracked here. */
  keywords: Set<string>;
  /** Cumulative `pump` deltas (harness.ts's `actions.pump`) — additive across every `pump` entry this card has seen, same "real state just keeps mutating" shape state.ts's own `pump` uses (no duration/layer tracking, matching this project's accepted layers.ts simplification). Undefined (not 0) until the first `pump` entry, so a chip with no buffs renders no badge at all. */
  powerMod?: number;
  toughnessMod?: number;
  /** The real type list an `animate` entry (harness.ts's `actions.animate`) most recently applied (e.g. a land becoming `['Creature']` too) — REPLACES, not merges, same as `state.animate` itself does; not tracked as a diff against printed types since this file has no real printed-types source for a generic filler chip anyway. */
  animatedTypes?: string[];
  /** True from an `attack`/`block` entry until the next real `phase` entry (combat's own step boundary) clears it — an engine-piloted trace only (a flat harness.ts scenario never crosses a real phase, so these two would never clear); a purely visual "currently in combat" marker, not itself a source of any other state. */
  attacking?: boolean;
  blocking?: boolean;
}

export interface ReplaySnapshot {
  /** Index into the log this snapshot reflects — 0 is "before anything happened." */
  step: number;
  /** The log entry that produced this snapshot from the previous one — undefined for step 0. */
  entry?: LogEntry;
  life: Record<string, number>;
  cards: ReplayCard[];
  /** Real turn/phase/active-player, tracked from `{fn:'phase', phase, turn, player}` entries — only an engine-piloted trace (functional-model/engine-trace.ts's own `advanceToPlayersNextMain1`/`advanceToDeclareAttackersStep`/`advanceOneStep`) logs `turn`/`player` on these; harness.ts's own flat `Scenario.advanceToPhase` logs a bare `{fn:'phase', phase}` with neither (no real turn concept there), so those two fields just stay whatever they last were (undefined, for a scenario that never crosses a real turn). `phase` updates either way. */
  turn?: number;
  activePlayer?: string;
  phase?: string;
}

const DEFAULT_LIFE = 20;

/** Mirrors functional-model/harness.ts's own `setupPlayer` — same names, same zones, same order — so a log entry referencing one of these later (e.g. `read:hasSubtype target="opp0-creature-token-1"`) lines up with the exact chip this seeded. */
function seedPlayerCards(owner: string, ps: PlayerState | undefined): ReplayCard[] {
  const cards: ReplayCard[] = [];
  const push = (name: string, zone: ZoneType) => cards.push({ name, zone, owner, tapped: false, counters: {}, keywords: new Set() });
  const n = owner;
  const nontoken = ps?.nontokenCreaturesCount ?? 0;
  for (let i = 0; i < nontoken; i++) push(`${n}-creature-nontoken-${i}`, 'Battlefield');
  const tokenCreatures = Math.max(0, (ps?.creaturesCount ?? 0) - nontoken);
  for (let i = 0; i < tokenCreatures; i++) push(`${n}-creature-token-${i}`, 'Battlefield');
  // Real named tokens/basic lands (harness.ts's `PlayerState.tokens`/
  // `basicLands`) — pushed under their OWN real name, unprefixed, same as
  // `state.createToken`/`addCard` do there (no `${owner}-` prefix these
  // get) — so a log entry naming "Treasure"/"Forest" lines up directly.
  for (const key of ps?.tokens ?? []) push(TOKENS[key].name, 'Battlefield');
  for (const landName of ps?.basicLands ?? []) push(landName, 'Battlefield');
  const equipment = ps?.equipmentCount ?? 0;
  for (let i = 0; i < equipment; i++) push(`${n}-equipment-${i}`, 'Battlefield');
  const plainArtifacts = Math.max(0, (ps?.artifactsCount ?? 0) - equipment);
  for (let i = 0; i < plainArtifacts; i++) push(`${n}-artifact-${i}`, 'Battlefield');
  for (let i = 0; i < (ps?.enchantmentsCount ?? 0); i++) push(`${n}-enchantment-${i}`, 'Battlefield');
  for (let i = 0; i < (ps?.graveyardCreatureCount ?? 0); i++) push(`${n}-gy-creature-${i}`, 'Graveyard');
  for (let i = 0; i < (ps?.landsCount ?? 0); i++) push(`${n}-land-${i}`, 'Battlefield');
  // Real basic land (harness.ts's `GENERIC_FILLER_LAND`) — not the old
  // synthetic `${n}-hand-${i}`/`${n}-library-${i}` placeholder, so a
  // drawn/discarded one gets real art instead of a "?" chip. Pushed
  // unprefixed like `basicLands` above, for the same reason — and always
  // the SAME one (not a rotation), so N of them collapse onto one grouped
  // "×N" chip instead of spreading across several ungrouped stacks.
  for (let i = 0; i < (ps?.handCount ?? 0); i++) push(GENERIC_FILLER_LAND, 'Hand');
  const libraryArtifacts = ps?.libraryArtifactCount ?? 0;
  for (let i = 0; i < libraryArtifacts; i++) push(`${n}-library-artifact-${i}`, 'Library');
  const libraryLands = ps?.libraryLandCount ?? 0;
  for (let i = 0; i < libraryLands; i++) push(`${n}-library-land-${i}`, 'Library');
  const librarySubtyped = ps?.librarySubtypeCount ?? 0;
  for (let i = 0; i < librarySubtyped; i++) push(`${n}-library-${ps?.librarySubtype ?? 'subtype'}-${i}`, 'Library');
  const libraryPlain = Math.max(0, (ps?.libraryCount ?? 0) - libraryArtifacts - libraryLands - librarySubtyped);
  for (let i = 0; i < libraryPlain; i++) push(GENERIC_FILLER_LAND, 'Library');
  return cards;
}

/** Player role names this scenario ever mentions ("you", "opp0", "opp1", ...) — drives which board columns to render. */
export function playerRoles(raw: Scenario | undefined): string[] {
  return ['you', ...(raw?.opponents ?? []).map((_, i) => `opp${i}`)];
}

function initialLife(raw: Scenario | undefined): Record<string, number> {
  const life: Record<string, number> = { you: raw?.you?.life ?? DEFAULT_LIFE };
  (raw?.opponents ?? []).forEach((ps, i) => (life[`opp${i}`] = ps.life ?? DEFAULT_LIFE));
  return life;
}

function initialCards(raw: Scenario | undefined): ReplayCard[] {
  const cards = seedPlayerCards('you', raw?.you);
  (raw?.opponents ?? []).forEach((ps, i) => cards.push(...seedPlayerCards(`opp${i}`, ps)));
  return cards;
}

/** Best-effort owner guess for a name this scenario never seeded (self, a token, an edge case) — the prefix before its first `-` when that's a known role, else "you" (every self/test card belongs to `you` — see harness.ts's `runScenario`). */
function guessOwner(name: string, roles: string[]): string {
  const prefix = name.split('-')[0]!;
  return roles.includes(prefix) ? prefix : 'you';
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

/** Every log entry field value that plausibly names a card or player — used to highlight the board chips/life a step actually touched. Loose by design (a false-positive highlight is harmless; a missed one just looks inert). */
export function entryRefs(entry: LogEntry): string[] {
  const keys = ['target', 'card', 'player', 'controller', 'source', 'equipment', 'token'];
  return keys.map((k) => str(entry[k])).filter((v): v is string => !!v);
}

/** Replays one scenario's log over its seeded starting board, returning one snapshot per step (index 0 = before the log runs). Pure/deterministic — same trace always replays identically, so a caller can memoize this per trace. */
export function replayTrace(trace: { scenario: { raw?: Scenario }; log: LogEntry[] }): ReplaySnapshot[] {
  const roles = playerRoles(trace.scenario.raw);
  const life: Record<string, number> = initialLife(trace.scenario.raw);
  // The full seeded board, kept as a plain array so same-named fungible
  // fillers (5 basicLands entries all named "Island", say) all survive —
  // `byName` below is keyed by name too, but only as a lookup INDEX for log
  // entries that reference a card by name; no log entry ever singles out
  // "which Island" (they're never individually targeted), so aliasing every
  // same-named duplicate to one representative there is safe as long as
  // rendering reads from this array instead of the lossy Map.
  const cards: ReplayCard[] = initialCards(trace.scenario.raw);
  const byName = new Map<string, ReplayCard>(cards.map((c) => [c.name, c]));

  const ensure = (name: string | undefined, zone: ZoneType | 'Unknown' = 'Unknown'): ReplayCard | undefined => {
    if (!name) return undefined;
    let card = byName.get(name);
    if (!card) {
      card = { name, zone, owner: guessOwner(name, roles), tapped: false, counters: {}, keywords: new Set() };
      byName.set(name, card);
      cards.push(card);
    }
    return card;
  };
  /**
   * Real per-source `tapForMana`/`tap`/`untap` entries name a fungible
   * card by its bare name (Island, Treasure, ...) — when several
   * same-named instances are on the board, `ensure()`'s own single-alias
   * lookup would keep re-tapping the SAME one (confirmed the hard way:
   * three real `tapForMana` entries all named "Island" only ever tapped
   * one of the five). Instead, find any instance matching `name`/`zone`
   * whose CURRENT tapped state is `wantTapped`'s opposite — any untapped
   * one for a tap, any tapped one for an untap — and flip that one. Since
   * same-named untapped/tapped instances are visually indistinguishable
   * anyway (that's what "fungible" means here), which SPECIFIC one gets
   * picked doesn't matter — only that N real events end up as N different
   * chips changing state, not one chip flipping N times. Falls back to
   * `ensure()`'s create-or-alias behavior when nothing matching exists yet
   * (a genuinely not-yet-seen name, or every instance already in the
   * target state — the tap/untap then becomes a harmless no-op on
   * whichever one `ensure` aliases to, same as before this fix).
   */
  const ensureForTap = (name: string | undefined, wantTapped: boolean, zone: ZoneType | 'Unknown' = 'Battlefield'): ReplayCard | undefined => {
    if (!name) return undefined;
    const candidate = cards.find((c) => c.name === name && c.zone === zone && c.tapped !== wantTapped);
    return candidate ?? ensure(name, zone);
  };
  /**
   * Same "several real instances share a fungible name, pick any ONE
   * currently in the FROM zone" fix `ensureForTap` needed for lands —
   * `GENERIC_FILLER_LAND` (harness.ts) now gives multiple Library/Hand
   * fillers the same real land name, so a plain `ensure(name)` for a
   * drawCard/drawCards/discard entry would keep re-aliasing the SAME
   * already-moved instance instead of picking a genuinely different one
   * still sitting in `fromZone`.
   */
  const ensureForZone = (name: string | undefined, fromZone: ZoneType): ReplayCard | undefined => {
    if (!name) return undefined;
    const candidate = cards.find((c) => c.name === name && c.zone === fromZone);
    return candidate ?? ensure(name, fromZone);
  };
  // A transforming DFC's `card` field on trigger/activate/enters/cast
  // entries names whichever FACE is currently active, not a stable id —
  // `instanceId` (present on all four) is the one thing that stays fixed
  // across a transform, so it's what canonicalizes "same physical card,
  // new face name" back onto one chip instead of spawning a second one.
  // Keyed by the OBJECT itself (not by name — a real duplicate-legendary
  // scenario has TWO instanceIds sharing the SAME name; keying by name
  // would alias the second one straight onto the first's object via
  // `ensure`'s own byName map, same class of bug fixed elsewhere for
  // fungible lands — confirmed the hard way against fin/3's own real
  // scenario: legendRule then had only one chip to move, so the survivor
  // silently vanished too instead of staying on the battlefield).
  const instanceCards = new Map<number, ReplayCard>();
  const ensureSelf = (entry: LogEntry, zone: ZoneType | 'Unknown'): ReplayCard | undefined => {
    const cardName = str(entry.card);
    const instanceId = num(entry.instanceId);
    let card: ReplayCard | undefined;
    if (instanceId !== undefined && instanceCards.has(instanceId)) {
      card = instanceCards.get(instanceId);
    } else if (cardName && byName.has(cardName)) {
      // A DIFFERENT instanceId already claimed this exact name — a genuinely
      // separate physical object (not a face-name coincidence; a real same-
      // instance transform always hits the branch above first). Pushed
      // directly, bypassing `ensure`/`byName` entirely, so it can never get
      // silently merged back onto the first one.
      card = { name: cardName, zone, owner: guessOwner(cardName, roles), tapped: false, counters: {}, keywords: new Set() };
      cards.push(card);
    } else {
      card = ensure(cardName, zone);
    }
    if (instanceId !== undefined && card) instanceCards.set(instanceId, card);
    if (card) {
      card.isSelf = true;
      if (cardName && cardName !== card.name) card.faceName = cardName;
    }
    return card;
  };
  // Real turn/phase/active-player — only ever set by an engine-piloted
  // trace's own `{fn:'phase', phase, turn, player}` entries (see
  // `ReplaySnapshot`'s own doc comment); a harness.ts flat scenario has no
  // such entries at all, so these three just stay undefined for one. An
  // engine-piloted trace (detected by the mere presence of any `phase`
  // entry — the only kind that ever logs one) always genuinely starts at
  // Main1 of turn 1 with `you` active (functional-model/engine-trace.ts's
  // own `setupEnginePilot` doc comment) BEFORE its first logged action —
  // seeded here so the header reads correctly from step 0 onward, not just
  // once the first real phase crossing happens to log later.
  const isEnginePiloted = trace.log.some((e) => e.fn === 'phase');
  let turn: number | undefined = isEnginePiloted ? 1 : undefined;
  let activePlayer: string | undefined = isEnginePiloted ? 'you' : undefined;
  let phase: string | undefined = isEnginePiloted ? 'Main1' : undefined;
  const snapshotOf = (step: number, entry: LogEntry | undefined): ReplaySnapshot => ({
    step,
    entry,
    life: { ...life },
    cards: cards.map((c) => ({ ...c, counters: { ...c.counters }, keywords: new Set(c.keywords) })),
    turn,
    activePlayer,
    phase,
  });

  // The tested "self" card usually needs no seeding at all — its own first
  // log entry (cast/activate/trigger/enters) always names it, `ensureSelf`
  // picks it up there — EXCEPT for step 0 itself, the "Start" marker's own
  // "before anything happened" board: without this, Start shows a board
  // missing the one card actually being tested, reading as if it appeared
  // from nowhere the instant the first real action runs. Pre-seeded here
  // from whichever entry names it FIRST (SELF_INSTANCE_ID convention —
  // instanceId only ever appears on cast/activate/trigger/enters, and the
  // self card's own first one always logs before any other instanceId a
  // scenario might introduce later, e.g. a duplicate legendary's second
  // copy) — its starting zone is `cast`'s own `from` field when that's the
  // first entry (hand/graveyard/exile), else Battlefield (already in play
  // with no preceding cast — an activated-ability/trigger demonstration).
  const firstSelfEntry = trace.log.find((e) => num(e.instanceId) !== undefined);
  if (firstSelfEntry) {
    const selfName = str(firstSelfEntry.card);
    const selfInstanceId = num(firstSelfEntry.instanceId)!;
    if (selfName && !byName.has(selfName)) {
      const from = str(firstSelfEntry.from);
      const startZone: ZoneType = firstSelfEntry.fn !== 'cast' ? 'Battlefield' : from === 'graveyard' ? 'Graveyard' : from === 'exile' ? 'Exile' : 'Hand';
      const selfCard: ReplayCard = { name: selfName, zone: startZone, owner: 'you', tapped: false, counters: {}, keywords: new Set(), isSelf: true };
      cards.push(selfCard);
      byName.set(selfName, selfCard);
      instanceCards.set(selfInstanceId, selfCard);
    }
  }

  const snapshots: ReplaySnapshot[] = [snapshotOf(0, undefined)];
  trace.log.forEach((entry, i) => {
    const fn = entry.fn;
    const target = str(entry.target);
    const player = str(entry.player);
    const cardName = str(entry.card);
    switch (fn) {
      case 'cast':
        ensureSelf(entry, 'Stack');
        break;
      case 'activate':
      case 'trigger':
        ensureSelf(entry, 'Battlefield');
        break;
      case 'enters': {
        const c = ensureSelf(entry, 'Battlefield');
        if (c) c.zone = (str(entry.zone) as ZoneType | undefined) ?? 'Battlefield';
        break;
      }
      case 'transform': {
        // engine-trace.ts's own `pilotTransform` — `card` is the STABLE
        // identity name (`RealCard.name` never changes on a transform, same
        // convention `moveTo`/`tap`/etc already rely on), `into` is whichever
        // face is now active. Until now nothing handled this fn at all —
        // the flip display only ever updated as an ACCIDENTAL side effect of
        // a LATER cast/activate/trigger/enters entry happening to name the
        // new face (`ensureSelf`'s own `faceName` write below) — real for
        // front->back (chapter I's own trigger fires right after and names
        // the back face), but transforming BACK to the front face has no
        // such follow-up entry to ever name it again, so `faceName` never
        // cleared and the display stayed stuck on the back face forever
        // (confirmed the hard way: Jill never visually flipped back after
        // chapter III's real transform-back). Handled directly here instead
        // of relying on that coincidence — `into === c.name` (transforming
        // back to the stable/front identity) clears `faceName`, anything
        // else sets it, matching `ensureSelf`'s own "faceName only when it
        // differs from name" rule.
        const c = cardName ? ensure(cardName) : undefined;
        const into = str(entry.into);
        if (c) c.faceName = into && into !== c.name ? into : undefined;
        break;
      }
      case 'moveTo': {
        const c = ensure(target);
        if (c) c.zone = (str(entry.zone) as ZoneType | undefined) ?? c.zone;
        break;
      }
      case 'ceasesToExist': {
        // Real 111.7/704.5d — harness.ts's own `moveTo` logs this instead of
        // a plain `moveTo` when the target was a TOKEN leaving the
        // battlefield (a bounced Treasure TOKEN doesn't sit in hand, it just
        // stops existing). `'Unknown'` is the SAME "don't render this" zone
        // every other never-seeded reference already falls back to — no new
        // sentinel needed, this file's own render filter already skips it.
        const c = ensure(target);
        if (c) c.zone = 'Unknown';
        break;
      }
      case 'move': {
        // Two unrelated shapes share this fn name — see this file's own
        // header comment: `card` present means the self-spell resolution
        // lifecycle (lifecycleAfter, harness.ts); its absence means a
        // batch player search (loggingActions.move) with no addressable
        // card name, nothing to replay.
        if (cardName) {
          const c = ensure(cardName);
          if (c) c.zone = (str(entry.to) as ZoneType | undefined) ?? c.zone;
        }
        break;
      }
      case 'tap': {
        const c = ensureForTap(target, true);
        if (c) c.tapped = true;
        break;
      }
      case 'tapForMana': {
        // engine-trace.ts's own real per-source mana-payment entry
        // (`mana.ts`'s own `payMana` return value, surfaced — see that
        // file's doc comment) — `target` names the EXACT real land/source
        // that got tapped, no reconstruction/guessing needed (this used to
        // be a cosmetic, greedy-order approximation off a single summary
        // `payMana` entry; now it's just the real fact). Logged as its own
        // fn, not plain `tap`, so `verify-synergy.mjs` never misreads a
        // mana-cost payment as a card EFFECT tapping something. `ensureForTap`
        // (not `ensure`) — see that helper's own doc comment: several real
        // tapForMana entries commonly share one fungible name (paying {3} off
        // 3 Islands, say), and each one needs to land on a DIFFERENT chip.
        const c = ensureForTap(target, true);
        if (c) c.tapped = true;
        break;
      }
      case 'untap': {
        const c = ensureForTap(target, false);
        if (c) c.tapped = false;
        break;
      }
      case 'putCounter': {
        const c = ensure(target, 'Battlefield');
        const counterType = str(entry.counterType) ?? '+1/+1';
        const amount = num(entry.amount) ?? 0;
        if (c) c.counters[counterType] = (c.counters[counterType] ?? 0) + amount;
        break;
      }
      case 'destroy': {
        const c = ensure(target);
        if (c) c.zone = 'Graveyard';
        break;
      }
      case 'sacrifice': {
        // sacrificeSelfAfter's own marker names `card`; the batch action
        // (loggingActions.sacrifice) only names a player/qty — same
        // shape split as `move` above.
        if (cardName) {
          const c = ensure(cardName);
          if (c) c.zone = 'Graveyard';
        }
        break;
      }
      case 'equip': {
        const equipment = str(entry.equipment);
        ensure(equipment, 'Battlefield');
        ensure(target, 'Battlefield');
        break;
      }
      case 'gainControl': {
        const c = ensure(target, 'Battlefield');
        if (c && player) c.owner = player;
        break;
      }
      case 'grantKeyword': {
        const c = ensure(target, 'Battlefield');
        const keyword = str(entry.keyword);
        if (c && keyword) c.keywords.add(keyword);
        break;
      }
      case 'gainLife': {
        if (player) life[player] = (life[player] ?? DEFAULT_LIFE) + (num(entry.amount) ?? 0);
        break;
      }
      case 'loseLife': {
        if (player) life[player] = (life[player] ?? DEFAULT_LIFE) - (num(entry.amount) ?? 0);
        break;
      }
      case 'dealDamage': {
        // `target` here is whichever `.getName()` was passed — a player
        // role (life loss) or a card (no toughness tracked here, so just
        // a no-op event marker; still highlighted in the log/board).
        if (target && roles.includes(target)) life[target] = (life[target] ?? DEFAULT_LIFE) - (num(entry.amount) ?? 0);
        break;
      }
      case 'phase': {
        // engine-trace.ts's own real turn/phase marker (see
        // `ReplaySnapshot`'s own doc comment) — harness.ts's flat
        // `advanceToPhase` logs the same `fn` with only `phase` set, which
        // still updates `phase` here, just never `turn`/`activePlayer`.
        phase = str(entry.phase);
        const t = num(entry.turn);
        if (t !== undefined) turn = t;
        const p = str(entry.player);
        if (p !== undefined) activePlayer = p;
        // A real phase crossing means combat's own step just moved on (or
        // ended) — whatever was attacking/blocking a moment ago no longer
        // is, real or not (this engine has no "combat is definitely still
        // happening" flag of its own to check against, but every attack/
        // block this file ever sees came from an engine-piloted trace,
        // which never logs a bare `phase` mid-combat without one of these
        // two having already been true beforehand if they were going to be).
        for (const c of cards) {
          c.attacking = undefined;
          c.blocking = undefined;
        }
        break;
      }
      case 'createToken': {
        // Real name always matches `TOKENS[key].name` (harness.ts's own
        // `PlayerState.tokens` convention) — `ensure()` would ALIAS onto an
        // already-seeded same-named token/filler (a setup-seeded "Hero", say)
        // instead of adding a NEW instance, same class of bug `tapForMana`
        // had for fungible lands. Pushed directly instead, same pattern
        // `copyPermanent` below needs for the same reason. `groupKey`'s own
        // fungible-merge (same name/zone/tapped/counters) still collapses a
        // multi-qty batch into one "xN" chip for display, same as any other
        // same-named group.
        const name = str(entry.token);
        const controllerName = str(entry.controller);
        const qty = num(entry.qty) ?? 1;
        const tapped = !!entry.tapped;
        if (name) {
          for (let i = 0; i < qty; i++) {
            const card: ReplayCard = { name, zone: 'Battlefield', owner: controllerName ?? guessOwner(name, roles), tapped, counters: {}, keywords: new Set() };
            cards.push(card);
            if (!byName.has(name)) byName.set(name, card);
          }
        }
        break;
      }
      case 'copyPermanent': {
        // `state.copyPermanent` gives the copy the SAME name as its source
        // (real 707.2) — same alias risk `createToken` above has, same fix.
        const sourceName = str(entry.source);
        const controllerName = str(entry.controller);
        if (sourceName) {
          const card: ReplayCard = { name: sourceName, zone: 'Battlefield', owner: controllerName ?? guessOwner(sourceName, roles), tapped: false, counters: {}, keywords: new Set() };
          cards.push(card);
          if (!byName.has(sourceName)) byName.set(sourceName, card);
        }
        break;
      }
      case 'legendRule': {
        // Real 704.5j. `card` here is just a NAME, no `instanceId` (sba.ts's
        // own `legendRuleRemoved`/engine-trace.ts's pilot scripts never
        // attach one) — so when two real distinct copies coexist (fixed:
        // `ensureSelf` above now gives a genuine duplicate its own object
        // instead of aliasing it onto the first), this can't tell WHICH of
        // the two same-named copies 704.5j actually removed. Deterministic
        // fallback: always resolves to whichever copy `byName` points at —
        // the FIRST one seen (`ensure`'s own alias target) — same real
        // rules-legal OUTCOME either way (exactly one of two identical
        // copies leaves, one stays; which specific one is a real 704.5j
        // player choice anyway), just not necessarily the same one sba.ts
        // itself picked. A precise fix needs `card`+`instanceId` both on
        // this fn (harness.ts/engine-trace.ts's own emitters), not done here.
        const c = ensure(cardName);
        if (c) c.zone = 'Graveyard';
        break;
      }
      case 'pump': {
        const c = ensure(target, 'Battlefield');
        if (c) {
          c.powerMod = (c.powerMod ?? 0) + (num(entry.power) ?? 0);
          c.toughnessMod = (c.toughnessMod ?? 0) + (num(entry.toughness) ?? 0);
        }
        break;
      }
      case 'animate': {
        const c = ensure(target, 'Battlefield');
        const types = Array.isArray(entry.types) ? entry.types.filter((t): t is string => typeof t === 'string') : undefined;
        if (c && types) c.animatedTypes = types;
        break;
      }
      case 'discard': {
        // `cards` (plural — this file's own field, not harness.ts's) names
        // the real discarded card(s) when the logger knows them (post-fix,
        // both harness.ts's `loggingActions.discard` and engine-trace.ts's
        // own synthetic Cleanup discard now carry this — see those files'
        // own doc comments); falls back to a no-op for an older/unpatched
        // trace.json that only has `qty` (regenerate it to get real
        // identity — same "additive field" migration `tapForMana` went
        // through when it was promoted off a summary-only entry).
        const names = Array.isArray(entry.cards) ? entry.cards.filter((n): n is string => typeof n === 'string') : [];
        for (const n of names) {
          const c = ensureForZone(n, 'Hand');
          if (c) c.zone = 'Graveyard';
        }
        break;
      }
      case 'drawCard': {
        const c = cardName ? ensureForZone(cardName, 'Library') : undefined;
        if (c) c.zone = 'Hand';
        break;
      }
      case 'drawCards': {
        const names = Array.isArray(entry.cards) ? entry.cards.filter((n): n is string => typeof n === 'string') : [];
        for (const n of names) {
          const c = ensureForZone(n, 'Library');
          if (c) c.zone = 'Hand';
        }
        break;
      }
      case 'attack': {
        // engine-trace.ts's own real attacker marker — the real 508.1f tap
        // is its OWN separate `tap` entry now (`pilotDeclareAttackers`),
        // already handled by the `tap` case above; this just adds the
        // purely-visual "currently attacking" flag (cleared at the next real
        // `phase` entry, see that case's own comment).
        const c = cardName ? ensure(cardName, 'Battlefield') : undefined;
        if (c) c.attacking = true;
        break;
      }
      case 'block': {
        const blocker = str(entry.blocker);
        const attacker = str(entry.attacker);
        const b = blocker ? ensure(blocker, 'Battlefield') : undefined;
        if (b) b.blocking = true;
        const a = attacker ? ensure(attacker, 'Battlefield') : undefined;
        if (a) a.attacking = true;
        break;
      }
      default: {
        // read:* entries (and any other event-only fn — addMana, dig,
        // delayUntil, surveil, counter, destroyPrevented) don't mutate the
        // board (no addressable card identity to move/change — see
        // harness.ts's own doc comments on `dig`/`surveil`/`counter`), but a
        // `target` they mention should still register as "on the board
        // somewhere" the first time it's seen, so it isn't invisible until
        // some later fn happens to move it.
        if (fn.startsWith('read:')) ensure(target);
        break;
      }
    }
    snapshots.push(snapshotOf(i + 1, entry));
  });
  return snapshots;
}

export interface GroupedReplayCard extends ReplayCard {
  /** How many otherwise-identical cards this one chip stands in for (>1 for fungible duplicates — several basicLands entries all named "Island", say). Always 1 for the real tested card. */
  qty: number;
  /** Stable identity for this group, derived purely from the fields that define it (see `groupKey`) — not object identity, since the board/component/layout code each call `groupForDisplay` independently on their own slice of a snapshot and get back fresh (but equal-by-key) objects, not the same references. Used for Vue's `:key` and for `cardStyle`'s within-zone position lookup. */
  key: string;
}

/** Strips `setupPlayer`'s own trailing per-index suffix (`you-library-3` -> `you-library`, functional-model/harness.ts's own naming) for GROUPING purposes only — `c.name` itself is untouched everywhere else (log entries still address one specific filler by its full, unique name, e.g. a dig/search `moveTo`-ing exactly one out of many). A real card's own name (Island, Treasure, Jill, Shiva's Dominant, ...) never ends in a bare `-<digits>` — Scryfall names don't shape up that way — so this is a no-op for anything but synthetic filler. Safe against wrongly re-merging a filler that's become individually distinguishable: the moment exactly one of a same-shaped batch actually gets moved/tapped/countered, it lands in a different zone/tapped/counters bucket than its untouched siblings, and `groupKey` below already keys on all of those separately regardless of what this strips from the name. */
function groupNameOf(c: ReplayCard): string {
  return c.name.replace(/-\d+$/, '');
}

/** Everything that makes two cards fungible right now — same owner/zone/name/face/tapped-state/counters/keywords, nothing on screen would tell them apart. The real tested card (`isSelf`) always gets its own unique key (folding in `name`, which is unique to it) since it must never merge with anything even if some filler happened to match all these fields. */
function groupKey(c: ReplayCard): string {
  return [
    c.isSelf ? 'self' : 'fungible',
    c.owner,
    c.zone,
    groupNameOf(c),
    c.faceName ?? '',
    c.tapped,
    JSON.stringify(Object.entries(c.counters).sort()),
    [...c.keywords].sort().join(','),
    c.powerMod ?? 0,
    c.toughnessMod ?? 0,
    (c.animatedTypes ?? []).slice().sort().join(','),
    !!c.attacking,
    !!c.blocking,
  ].join('|');
}

/** Collapses cards that are fungible right now (see `groupKey`) into one chip with a qty count, so N identical filler lands take one board slot instead of N. Order-preserving (first occurrence of each group wins its slot). */
export function groupForDisplay(cards: ReplayCard[]): GroupedReplayCard[] {
  const groups = new Map<string, GroupedReplayCard>();
  const ordered: GroupedReplayCard[] = [];
  for (const c of cards) {
    const key = groupKey(c);
    const existing = groups.get(key);
    if (existing) existing.qty += 1;
    else {
      const grouped: GroupedReplayCard = { ...c, qty: 1, key };
      groups.set(key, grouped);
      ordered.push(grouped);
    }
  }
  return ordered;
}

/** Drops the `${owner}-` prefix `setupPlayer`'s own filler names carry, for a less noisy chip label — a real card's own name (no matching prefix) passes through unchanged. Prefers the card's current face (`faceName`) when a transform has moved it away from its original name. */
export function displayName(card: ReplayCard): string {
  const name = card.faceName ?? card.name;
  const prefix = `${card.owner}-`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/** Short label for a filler card's placeholder chip (no real Scryfall identity to show an image for) — keyed off `setupPlayer`'s own naming convention (harness.ts), same one `displayName` above already reads. */
export function placeholderLabel(card: ReplayCard): string {
  const n = card.name;
  if (/-creature-/.test(n)) return 'Cr';
  if (/-land-/.test(n)) return 'Ld';
  if (/-equipment-/.test(n)) return 'Eq';
  if (/-artifact-/.test(n)) return 'Ar';
  if (/-enchantment-/.test(n)) return 'En';
  if (/-hand-/.test(n) || /-library-/.test(n)) return '?';
  return displayName(card).slice(0, 2);
}

// ---------------------------------------------------------------------------
// Board layout — zone "slots" laid out left to right, each sized to what it
// actually holds THIS STEP (not a fixed guess), so a card's (x,y) is a pure
// function of (zone, index within zone, current per-owner zone widths). The
// component binds this directly to a CSS `left`/`top` with a `transition`,
// so a card moving zones (or a zone box resizing as its count changes)
// animates by sliding rather than popping — no FLIP measuring/JS animation
// needed, just a reactively-bound style recomputed every snapshot.

export const CARD_LAYOUT = { width: 90, height: 126, gap: 14, labelHeight: 25 } as const;
const ZONE_GAP = 14;
/** Room around a zone box's own cards — otherwise a card sits flush against its zone's border (and, for the first/last zone, the board's own edge). */
export const ZONE_PADDING = { x: 10, bottom: 8 } as const;

/** Display order (left to right) and a minimum slot count — Battlefield is the one zone worth always reserving a little room in, even empty; every other zone only takes up space once it actually holds something (`computeZoneRects` below skips a zone at 0 slots entirely). */
const ZONE_ORDER: { zone: ZoneType; label: string; minSlots: number }[] = [
  { zone: 'Battlefield', label: 'Battlefield', minSlots: 2 },
  { zone: 'Hand', label: 'Hand', minSlots: 0 },
  { zone: 'Stack', label: 'Stack', minSlots: 0 },
  { zone: 'Graveyard', label: 'Graveyard', minSlots: 0 },
  { zone: 'Exile', label: 'Exile', minSlots: 0 },
  { zone: 'Library', label: 'Library', minSlots: 0 },
  { zone: 'Command', label: 'Command', minSlots: 0 },
];

export interface ZoneRect {
  zone: ZoneType;
  label: string;
  x: number;
  width: number;
}

/** One owner's zone boxes for THIS snapshot's cards — widths track the actual count (plus Battlefield's own minimum), positions packed left to right with only the zones currently in use. */
export function computeZoneRects(ownerCards: ReplayCard[]): ZoneRect[] {
  const counts = new Map<ZoneType, number>();
  for (const c of ownerCards) {
    if (c.zone === 'Unknown') continue;
    counts.set(c.zone, (counts.get(c.zone) ?? 0) + 1);
  }
  const rects: ZoneRect[] = [];
  let x = 0;
  for (const z of ZONE_ORDER) {
    const slots = Math.max(z.minSlots, counts.get(z.zone) ?? 0);
    if (slots === 0) continue;
    const width = slots * CARD_LAYOUT.width + (slots - 1) * CARD_LAYOUT.gap + 2 * ZONE_PADDING.x;
    rects.push({ zone: z.zone, label: z.label, x, width });
    x += width + ZONE_GAP;
  }
  return rects;
}

export function boardHeight(): number {
  return CARD_LAYOUT.labelHeight + CARD_LAYOUT.height + ZONE_PADDING.bottom;
}

// ---------------------------------------------------------------------------
// Action stepping — an engine-piloted trace's `TraceResult.actions` (harness.ts)
// is a coarser, human-labeled index into the SAME flat `log` `replayTrace`
// already replays: `actions[i].from` is the log index where action i's own
// entries start, authored against the RAW log (engine-trace.ts's own
// `pilot.log`, `read:*` entries included) — so a caller indexing snapshots
// by action must replay the trace's RAW `log`, not the `read:*`-filtered one
// the component displays elsewhere, or these indices point at the wrong
// entries.

/**
 * The snapshot index marking the END of each action — `snapshots[k]` is the
 * board state once `log[k-1]` has applied (see `replayTrace`'s own doc
 * comment), so "action i is fully done" is just `snapshots[actionEndIndices(...)[i]]`,
 * no new snapshot computation needed. Action i's own log span is
 * `[actions[i].from, actionEndIndices(...)[i])`.
 */
export function actionEndIndices(actions: { from: number }[], logLength: number): number[] {
  return actions.map((_, i) => actions[i + 1]?.from ?? logLength);
}
