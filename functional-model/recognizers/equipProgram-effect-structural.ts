// New recognizer (2026-09-16, program-AST generalization pass) — the
// `equip`-`EachAction` sibling of `destroyProgram-effect-structural.ts` (see
// `program-ast-walker.ts`'s own header for the shared-walker design this
// builds on). Reads a `kind:'equip'` `EachAction` reached through
// `SelectUpTo`/`ApplyToBound`/`Each` and derives the real `event:'equip'`
// Fact vocabulary (`stolen-uniform`'s own real hand-authored
// `{event:'equip', controller:'you', target:{types:...}}` — the same shape
// this recognizer reproduces, first promoted 2026-09-16 for that card,
// still hand-authored/unprovenanced there since its own real shape — TWO
// chained `SelectUpTo`s feeding `gainControl` AND `equip` onto the SAME
// bound Equipment — is a genuinely different, more complex program than
// either shape below and this recognizer doesn't attempt it).
//
// **Three real, confirmed shapes** (all migrated onto `kind:'program'`,
// 2026-09-16, off a `kind:'custom'` closure — see each card's own
// `definition.ts` comment):
//   - `beatrix-loyal-general`: `selectUpTo(you.creaturesInPlay(), 1, 'target',
//     [you.permanentsInPlay().filter('cardType','artifact').filter('subtype',
//     'Equipment').each(equipTo('target', 0))])` — ONE target creature is
//     picked, then EVERY Equipment the caster controls (a broadcast `Each`,
//     `walker`'s own `EquipOccurrence.equipmentTargeted: false`) attaches to
//     it. Real clause: "you may attach any number of Equipment you control to
//     target creature you control."
//   - `gilgamesh-master-at-arms`: nested `selectUpTo(...artifact..., 1,
//     'equipment', [selectUpTo(...Samurai..., 1, 'samurai',
//     [applyToBound('equipment', 0, equipTo('samurai', 0))])])` — BOTH the
//     Equipment AND the creature it attaches to are independently picked
//     (`equipmentTargeted: true`). Real clause: "you may attach one of them
//     to a Samurai you control." — note this is an ANAPHORIC reference
//     ("one of them," pointing back at an earlier `move`-effect's own
//     library search, not a fresh noun phrase) and uses "a Samurai," not
//     "target Samurai" (this attach is resolution-time, not a real CR
//     "target" at all, despite being modeled with `SelectUpTo` for
//     determinism the same way every other no-real-player-choice pick in
//     this pool already is) — genuinely different wording from Beatrix's own
//     "target creature you control," not a parameterized variant of it.
//   - `weapons-vendor` (added 2026-09-16, recognizer-lane triage): nested
//     `selectUpTo(...Equipment..., 1, 'equipment', [selectUpTo(...creatures
//     ..., 1, 'creature', [applyToBound('equipment', 0, equipTo('creature',
//     0))])])` — BOTH the Equipment AND the creature are independently,
//     LITERALLY targeted (`equipmentTargeted: true`, neither pool subtype-
//     narrowed, no anaphora at all). Real clause: "...you may pay {1}. When
//     you do, attach target Equipment you control to target creature you
//     control." — a genuinely third wording, not a parameterized variant of
//     either shape above (Beatrix's is a broadcast `Each`, not a single
//     `SelectUpTo`; Gilgamesh's is anaphoric/subtype-narrowed). Checked the
//     whole real pool before adding this template: `unexpected-request`'s
//     own "attach an Equipment you control to it" (anaphoric "it," "an
//     Equipment" not "target Equipment") and `stolen-uniform`'s own "target
//     creature you control and target Equipment" (one combined noun phrase
//     up front, not two independent "attach X to Y" targets) are both real,
//     genuinely different wordings — weapons-vendor is the sole confirmed
//     real user of this exact template.
//   Only ONE real card confirms each of these three exact templates; see
//   module doc comment discipline throughout this recognizer catalog on why
//   that's an accepted bar (narrow but real, not guessed).
//
// **A fourth confirmed shape** (added 2026-09-16, closing zack-fair's own
// last real remaining gap — a sibling task's own equippedSelf `Query`
// source widening had deliberately deferred THIS file to avoid colliding
// with the peer session that was concurrently landing the 3 templates
// above; that peer work is now landed):
//   - `zack-fair`: `selectUpTo(you.creaturesInPlay(), 1, 'target', [...,
//     selectUpTo(selfCard.equippedSelf(), 1, 'equipment',
//     [applyToBound('equipment', 0, equipTo('target', 0))])])` —
//     `equipmentTargeted: true` (the Equipment is independently picked, off
//     a pool of "whatever's currently attached to THIS card," not a
//     controller-wide Equipment pool), `equipmentPool.attachedToSelf: true`
//     (`program-ast-walker.ts`'s own `readPool`, widened the same day —
//     `Query.source:'equippedSelf'`, real Forge `Card.getEquippedBy()`,
//     `interfaces.ts:125`). Real clause: "...and attach an Equipment that
//     was attached to Zack Fair to that creature" — a genuinely different
//     wording from all 3 templates above on BOTH sides: the equipment noun
//     phrase is a fresh descriptive clause ("an Equipment that was attached
//     to <NAME>"), not "target Equipment"/"one of them"/a broadcast, AND the
//     target side is ANAPHORIC ("that creature," referring back to the SAME
//     sentence's earlier "Target creature you control gains indestructible
//     until end of turn"), not a fresh "target creature"/"a <Subtype>" noun
//     phrase the way every template above requires. Gated on
//     `equipmentPool.attachedToSelf` specifically (not just the bare
//     `types:{has:['Equipment']}` word `readPool` also derives for this
//     source) precisely so this new branch can never collide with
//     weapons-vendor's own ordinary controlled-Equipment-pool template
//     above, which reaches the identical `types` shape a different way.
//   Only ONE real card (zack-fair) confirms this exact template.
//
// **Real target-type wording quirk, checked directly, not assumed**:
// Beatrix's own target pool is a bare `creaturesInPlay()` (types
// `{has:['Creature']}`) and its real clause says "target creature you
// control" (the plain type word). Gilgamesh's own target pool is
// `creaturesInPlay().filter('subtype','Samurai')` (types
// `{has:['Creature','Samurai']}`) and its real clause says "a Samurai you
// control" — DROPS the base "Creature" word entirely once a subtype is
// present. Both templates below are built directly from this real,
// confirmed difference (bare pool -> "target creature"; subtype-narrowed
// pool -> "a <Subtype>", singular, no base word) rather than guessed.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit): both paired SINK facts (the creature-target want and the
// equipment want) used to reuse the SAME whole-clause span as the SOURCE
// fact. Every one of the 4 confirmed templates above has the shape "attach
// <EQUIPMENT PHRASE> to <TARGET PHRASE>" -- `expectedClausePattern` now
// wraps each of those two phrases in its own capturing group; the creature
// SINK anchors to the target-phrase group, the equipment SINK anchors to
// the equipment-phrase group, and SOURCE keeps the WHOLE clause unchanged
// (the "attach"/"you may" framing is squarely part of what the SOURCE
// claims).
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { extractOccurrences, programEffects, type EquipOccurrence, type PoolDescriptor, type StructuralRecognizerInput } from './program-ast-walker';

export type { StructuralRecognizerInput };

const RULE = 'equipProgram-effect-structural' as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Real, closed self-reference alternation (own name, or the short name
 * before the first comma) — same helper (by convention, a fresh per-file
 * copy, not a shared import) `dies-trigger-structural.ts`/
 * `putCounterSelf-effect-structural.ts`/`grantKeywordSelf-effect-
 * structural.ts` etc. already each carry their own copy of. Zack Fair's own
 * real clause names itself in full ("...attached to Zack Fair..."), so this
 * is the only alternation this recognizer has a real confirmed need for
 * today (no bare-pronoun "it" case confirmed here yet, unlike those other
 * files' own broader vocabulary) — kept as the same 2-way shape anyway for
 * consistency and because a legendary card with a comma in its name
 * (Beatrix, Loyal General; Gilgamesh, Master-at-Arms) could plausibly need
 * the short form here too. */
function selfSubjectAlternation(name: string): string {
  const shortName = name.split(',')[0]!.trim();
  return shortName !== name ? `(?:${escapeRegExp(name)}|${escapeRegExp(shortName)})` : escapeRegExp(name);
}

/** The bare English word for a target pool, per the real wording quirk this
 * module's own doc comment documents — `undefined` (decline) for anything
 * this recognizer hasn't seen a real card confirm (more than one non-base
 * word, or a pool with neither a base word nor a subtype word at all). */
function targetWord(pool: PoolDescriptor): { article: 'target' | 'a'; word: string } | undefined {
  const has = pool.types?.has;
  if (!has || has.length === 0) return undefined;
  if (has.length === 1 && has[0] === 'Creature') return { article: 'target', word: 'creature' };
  if (has.length === 2 && has[0] === 'Creature') return { article: 'a', word: has[1]! };
  return undefined;
}

/** Builds the expected literal English clause for one `EquipOccurrence` —
 * `undefined` (never guessed) for anything outside the module doc comment's
 * four confirmed templates. `selfName` is only used by zack-fair's own
 * `attachedToSelf` template (see module doc comment) — every other
 * template's clause is a fresh noun phrase with no self-reference at all. */
function expectedClausePattern(occ: EquipOccurrence, selfName: string): RegExp | undefined {
  const target = targetWord(occ.targetPool);
  if (!target) return undefined;

  if (!occ.equipmentTargeted) {
    // Beatrix's own broadcast shape — the equipment pool needs its own
    // confirmed word too (only "Equipment," the real, sole confirmed case).
    if (!occ.equipmentPool.types?.has?.includes('Equipment') || occ.equipmentPool.types.has.length !== 1) return undefined;
    if (target.article !== 'target') return undefined; // only Beatrix's own bare-creature template is confirmed for the broadcast shape
    // Group 1 the equipment noun phrase (anchors the equipment SINK), group
    // 2 the creature noun phrase (anchors the creature SINK) — see module
    // doc comment's own "2026-09-16 SOURCE/SINK span-narrowing fix" section.
    const equipmentPhrase = 'any number of Equipment you control';
    const targetPhrase = `target ${escapeRegExp(target.word)} you control`;
    return new RegExp(`\\byou may attach (${equipmentPhrase}) to (${targetPhrase})(?=[.\\n]|$)`, 'i');
  }

  // zack-fair's own real "attached to THIS card" shape — see module doc
  // comment ("A fourth confirmed shape") for the full reasoning, including
  // why gating on `attachedToSelf` specifically (not just the bare
  // `types:{has:['Equipment']}` word) is what keeps this from ever
  // colliding with weapons-vendor's own ordinary controlled-Equipment-pool
  // template below. Checked BEFORE the weapons-vendor gate on purpose (both
  // reach `equipmentTargeted:true` with a bare Creature `targetPool`, so
  // this branch has to win first).
  if (occ.equipmentPool.attachedToSelf) {
    if (target.article !== 'target') return undefined; // only a bare Creature-pool anaphoric target is confirmed for this shape
    const subject = selfSubjectAlternation(selfName);
    const equipmentPhrase = `an Equipment that was attached to ${subject}`;
    const targetPhrase = `that ${escapeRegExp(target.word)}`;
    return new RegExp(`\\battach (${equipmentPhrase}) to (${targetPhrase})(?=[.\\n]|$)`, 'i');
  }

  // weapons-vendor's own literal, independently-targeted shape (added
  // 2026-09-16, recognizer-lane triage) — BOTH pools are bare, non-subtype-
  // narrowed ("target Equipment"/"target creature," plain type words, no
  // anaphoric "one of them"/"it"): "attach target Equipment you control to
  // target creature you control." Real clause sits after "When you do,"
  // (a separate `program`-AST-level condition this recognizer doesn't
  // itself anchor — only the equip clause proper), so this pattern is
  // deliberately NOT prefixed with "you may" the way the other two
  // templates are. Checked the whole real pool before adding this (not
  // guessed): `unexpected-request`'s own "attach an Equipment you control
  // to it" is anaphoric ("it" — the outer SelectUpTo's own bound creature —
  // and "an Equipment," not "target Equipment") and `stolen-uniform`'s own
  // "target creature you control and target Equipment" combines both picks
  // into ONE noun phrase up front rather than two independent "attach X to
  // Y" targets — both real, both genuinely different wordings, neither a
  // parameterized variant of this one; weapons-vendor is the sole confirmed
  // real user of this exact template.
  //
  // **Real structural signal needed to tell weapons-vendor apart from
  // stolen-uniform** (both reach `EquipOccurrence` with `equipmentTargeted:
  // true`, a bare `targetPool` of plain Creature, AND a bare `equipmentPool`
  // of plain Equipment — `EquipOccurrence` itself carries no field for
  // "does this same bound item ALSO get a `gainControl` elsewhere," so the
  // two are otherwise indistinguishable from this occurrence shape alone):
  // stolen-uniform's own Equipment pool is genuinely unrestricted-owner
  // (`anyPlayer.permanentsInPlay()...`, real text "target Equipment," NO
  // "you control" — confirmed, "which can belong to anyone" per that card's
  // own comment) while weapons-vendor's is `you.permanentsInPlay()...`
  // (real text "target Equipment YOU CONTROL"). `occ.equipmentPool.owner`
  // reflects this real difference directly (`'you'` vs `'any'`) — gating on
  // it here is a real, checked distinction, not an arbitrary tiebreak: a
  // `mismatch`-classified decline (rather than this function's own clean
  // `undefined`) is a HARD FAILURE for `apply-recognizers.mjs`'s whole run
  // (see that script's own "Hard-fail on unresolved kind:'mismatch'
  // declines" doc comment) — without this gate, stolen-uniform's own
  // genuinely-different real wording would structurally reach this branch,
  // build a regex, find 0 matches, and hard-fail the run instead of
  // cleanly declining (confirmed via a real before/after test run, not
  // assumed).
  if (target.article === 'target' && occ.equipmentPool.owner === 'you' && occ.equipmentPool.types?.has?.length === 1 && occ.equipmentPool.types.has[0] === 'Equipment') {
    const equipmentPhrase = 'target Equipment you control';
    const targetPhrase = `target ${escapeRegExp(target.word)} you control`;
    return new RegExp(`\\battach (${equipmentPhrase}) to (${targetPhrase})(?=[.\\n]|$)`, 'i');
  }

  // Gilgamesh's own single-to-single shape — "one of them," anaphoric, no
  // independent noun phrase for the equipment pool itself.
  if (target.article !== 'a') return undefined; // only Gilgamesh's own subtype-narrowed template is confirmed for the single-to-single shape
  const equipmentPhrase = 'one of them';
  const targetPhrase = `a ${escapeRegExp(target.word)} you control`;
  return new RegExp(`\\byou may attach (${equipmentPhrase}) to (${targetPhrase})(?=[.\\n]|$)`, 'i');
}

function targetConstraint(pool: PoolDescriptor): Constraints | undefined {
  return pool.types ? { types: pool.types } : undefined;
}

/**
 * Reads every `kind:'program'` effect's own AST directly (oracle text is
 * read ONLY to anchor the derived facts' annotation) and derives the
 * `event:'equip'` SOURCE fact plus its two paired "wants present" SINK facts
 * (a legal target creature, and a legal Equipment) for every recognized
 * `EquipOccurrence` this recognizer can confidently resolve. Same
 * "all-or-nothing per face" discipline every sibling structural recognizer
 * in this catalog already follows.
 */
export function recognizeEquipProgramEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const programs = programEffects(input);
  if (programs.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect on this face" };
  }

  const occurrences: EquipOccurrence[] = [];
  for (const effect of programs) {
    for (const occ of extractOccurrences(effect.program)) {
      if (occ.kind === 'equip') occurrences.push(occ);
    }
  }
  if (occurrences.length === 0) {
    return { matched: false, reason: "no recognized equip EachAction occurrence in this face's own program AST (see program-ast-walker.ts's own readPool/actionOccurrence doc comments for what's in/out of scope)" };
  }

  const facts: RecognizedFact[] = [];

  for (const occ of occurrences) {
    const pattern = expectedClausePattern(occ, input.name);
    if (!pattern) {
      return {
        matched: false,
        reason: `a program-AST equip occurrence on this face (${JSON.stringify(occ)}) has no confirmed structural->text template (see module doc comment for the exact 4-shape vocabulary this recognizer supports)`,
      };
    }

    const global = new RegExp(pattern.source, pattern.flags + 'gd');
    const matches = [...input.oracleText.matchAll(global)] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
    if (matches.length === 0) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ not found (verbatim, with a real clause boundary right after) in oracle text "${input.oracleText}"`,
      };
    }
    if (matches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times — ambiguous, declining rather than guessing which`,
      };
    }

    const m = matches[0]!;
    const start = m.index!;
    const end = start + m[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    // Group 1 the equipment noun phrase, group 2 the creature/target noun
    // phrase (see `expectedClausePattern`'s own doc comment) — narrows the
    // paired SINK facts' own annotations (2026-09-16 fix, see module doc
    // comment).
    const [equipmentPhraseStart, equipmentPhraseEnd] = m.indices[1]!;
    const [targetPhraseStart, targetPhraseEnd] = m.indices[2]!;
    const equipmentPhraseAnnotation = toLineOffset(input.oracleText, equipmentPhraseStart, equipmentPhraseEnd);
    const targetPhraseAnnotation = toLineOffset(input.oracleText, targetPhraseStart, targetPhraseEnd);
    if (!annotation || !equipmentPhraseAnnotation || !targetPhraseAnnotation) {
      return { matched: false, reason: `matched span [${start},${end}) (or its own inner equipment/target-phrase spans) did not resolve to a single real oracle-text line` };
    }

    const target = targetConstraint(occ.targetPool);
    facts.push({
      role: 'source',
      fact: { event: 'equip', controller: 'you', ...(target ? { target } : {}), annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });

    const equipmentTarget = targetConstraint(occ.equipmentPool);
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', ...(target ? { types: target.types } : {}), annotations: [targetPhraseAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', ...(equipmentTarget ? { types: equipmentTarget.types } : {}), annotations: [equipmentPhraseAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
