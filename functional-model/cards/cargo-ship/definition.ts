import type { CardDefinition, Effect } from '../../card';

// "Flying, vigilance" — both BARE printed keywords with no grant/broadcast
// involved (2026-09-12 standing rule, SYNERGY_DESIGN.md — the "Lifelink is
// the one exception" carve-out doesn't apply to either of these: neither is
// self-only-and-event-producing the way Lifelink's CR 702.15e lifegain is,
// they're purely passive/no-observable-occurrence like every other bare
// keyword). Kept only as real, structured `keywords` data — no Fact for
// either.
export const cargoShip: CardDefinition = {
  name: 'Cargo Ship',
  manaCost: '{1}{U}',
  typeLine: 'Artifact — Vehicle',

  // Real printed base P/T — a Vehicle carries one even though it isn't a
  // creature (and so doesn't match `typesFromTypeLine`'s Creature check)
  // until crewed.
  pt: [2, 3],
  keywords: ['Flying', 'Vigilance'],

  // "{T}: Add {C}. Spend this mana only to cast an artifact spell or
  // activate an ability of an artifact source." — a real, structured
  // activated ability (`abilities`, not `staticAbilities` text): the
  // add-mana HALF is a plain, already-real `kind:'addMana'` Effect (same
  // shape Ultima, Origin of Oblivion's own "{T}: Add {C}." trigger and
  // Elvish Archdruid's "{T}: Add {G}..." use), piloted for real in
  // scenarios.ts so it leaves a genuine `fn:'addMana'` trace line instead
  // of relying on a static exemption.
  //
  // The RESTRICTION ("Spend this mana only to cast an artifact spell or
  // activate an ability of an artifact source") is a real, confirmed gap:
  // this engine tracks no spendable mana pool at all (interfaces.ts's own
  // `Player.addMana` doc comment — a deliberately inert observation
  // point), so there is no mechanism anywhere that could constrain what a
  // produced mana unit is later spent on. Checked the rest of the pool for
  // a restricted-mana precedent before modeling this (fin/138 Freya
  // Crescent's own "Spend this mana only to cast an Equipment spell or
  // activate an equip ability" and fin/219 The Emperor of Palamecia's own
  // "Spend this mana only to cast a noncreature spell" are the only other
  // 2 real restricted-mana abilities in this set, and neither is migrated
  // to CardDefinition/the unified Fact model at all yet — no existing
  // precedent to follow). Also NOT recognized by `mana.ts`'s own
  // `manaAbilityColorFromStaticText`/`manaAbilityColorsFromStaticText`
  // (both explicitly exclude any "spend only"-restricted text, by design —
  // see that file's own header), so this ability never gets auto-detected
  // as a payable source for another spell's own cost the way an
  // unrestricted "{T}: Add {C}." land/rock would be — correct, since a
  // real restricted source shouldn't silently pay an unrelated cost
  // either.
  abilities: [
    {
      name: 'mana',
      cost: '{T}',
      effects: [{ kind: 'addMana', color: 'C', amount: 1 } satisfies Effect],
    },
  ],

  // Real "Crew 1" — same explicit representation magitek-armor/the-lunar-
  // whale/the-prima-vista's own identical bare-Crew case already
  // establishes: `crewCost` (the structured N) AND `activationCost` (drives
  // harness.ts's own activate-not-cast lifecycle) both set, `effects:
  // [animate]` standing in for Forge's own implicit crew-makes-it-a-
  // creature rule. This is the top-level `activationCost`/`effects` slot
  // (reserved for Crew, per that same precedent); the mana ability above
  // is a SEPARATE, independent activated ability, hence `abilities` rather
  // than reusing this slot.
  crewCost: 1,
  activationCost: 'Crew 1 (tap creatures with total power 1 or more)',
  effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] } satisfies Effect],
};
