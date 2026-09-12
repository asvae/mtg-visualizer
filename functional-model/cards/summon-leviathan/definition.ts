import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

const TRIBAL_SUBTYPES = ['Kraken', 'Leviathan', 'Merfolk', 'Octopus', 'Serpent'];

export const summonLeviathan: CardDefinition = {
  name: 'Summon: Leviathan',
  manaCost: '{4}{U}{U}',
  typeLine: 'Enchantment Creature — Saga Leviathan',

  pt: [6, 6],
  // Ward {2} — a plain printed keyword, same "declared, not enforced"
  // treatment 'Hexproof'/'Protection' already have in this model: no
  // targeting-legality chokepoint anywhere in engine.ts/card.ts checks
  // ANY of the three (`resolveTargets`'s own real 608.2b re-validation
  // never reads a candidate's keywords at all) — checked before treating
  // this as settled, not assumed from precedent alone. No Fact is authored
  // for it either, matching every other plain printed keyword in the pool
  // (Diamond Weapon's own printed 'Reach', e.g., which also has no
  // matching source/sink fact) — a keyword tag with no produce/want shape
  // in this model's vocabulary, real Forge `K:Ward:2` mana-tax-or-counter
  // mechanism aside.
  keywords: ['Ward'],

  // A Saga's own lore-counter/chapter mechanism (714.3a/b) modeled as
  // named `triggers` (chapterI/II/III) — same simplification jecht-
  // reluctant-guardian-braska-s-final-aeon's own backFace comment
  // documents.
  triggers: [
    {
      name: 'chapterI',
      effects: [
        {
          // "Return EACH creature that ISN'T a Kraken/Leviathan/Merfolk/
          // Octopus/Serpent" — an exclude-by-subtype-list batch bounce.
          // `move`'s own declarative `validType` is only
          // 'creature'|'artifact'|'any', no subtype filter at all, so no
          // combination of its fields expresses "all creatures EXCEPT
          // these five subtypes" — `custom`, filtering the real
          // battlefield pool via `hasSubtype` (already exposed on every
          // wrapped Card) then calling the real `moveTo` action per match,
          // same subtype-filtering shape aerith-gainsborough's own onDies
          // effect already uses.
          kind: 'custom',
          describe: "return each creature that isn't a Kraken, Leviathan, Merfolk, Octopus, or Serpent to its owner's hand",
          run: (ctx: EffectContext, actions: Actions) => {
            const all = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())];
            for (const creature of all) {
              if (!TRIBAL_SUBTYPES.some((st) => creature.hasSubtype(st))) actions.moveTo(creature, 'Hand');
            }
          },
        } satisfies Effect,
      ],
    },
    {
      // "Until end of turn, whenever a Kraken/Leviathan/Merfolk/Octopus/
      // Serpent attacks, draw a card" — GRANTS a new, temporary delayed
      // triggered ability (its own trigger condition PLUS its own effect)
      // to a whole TYPE-matched bucket of creatures across the battlefield,
      // either player's — the same "no vocabulary anywhere in this model
      // grants a fresh triggered ability to another permanent" gap class
      // white-mage-s-staff's own migration documents (card.ts's own
      // `Effect`/`Actions` surface has no such primitive — closest is
      // `grantKeywordTarget`/`grantKeywordAll`, which only ever grant a
      // KEYWORD), just broadcast-by-type instead of equip-scoped. No-op
      // `custom`, same treatment crystal-fragments-summon-alexander's own
      // damage-prevention chapters give a different ungranted-delayed-
      // trigger mechanic. Modeled as a real, honest, deliberately inert
      // `{event:'drawCard', ...}` fact anyway (synergy.json), exempted via
      // `isSummonLeviathanGrantedDrawFact` in verify-synergy.mjs.
      name: 'chapterII',
      effects: [
        {
          kind: 'custom',
          describe: 'until end of turn, whenever a Kraken, Leviathan, Merfolk, Octopus, or Serpent attacks, draw a card',
          run: () => {},
        } satisfies Effect,
      ],
    },
    {
      name: 'chapterIII',
      effects: [
        {
          kind: 'custom',
          describe: 'until end of turn, whenever a Kraken, Leviathan, Merfolk, Octopus, or Serpent attacks, draw a card',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
