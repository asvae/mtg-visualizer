import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// A Saga — chapter abilities modeled as named `triggers` (chapterI/II/III),
// same simplification jecht-reluctant-guardian-braska-s-final-aeon/
// summon-leviathan's own backFace/chapter comments document (714.3a/b:
// really a turn-based action, not a triggered ability — traded for reusing
// existing, tested `triggers` machinery instead of a third mechanism).
export const summonBrynhildr: CardDefinition = {
  name: 'Summon: Brynhildr',
  manaCost: '{1}{R}',
  typeLine: 'Enchantment Creature — Saga Knight',

  pt: [2, 1],

  triggers: [
    {
      // Real `DB$ Dig | DigNum$ 1 | ChangeNum$ All | DestinationZone$ Exile`
      // — an UNCHOSEN batch (`move`'s `target: false` shape, same as
      // random-encounter's own mill), library -> exile. The follow-up "you
      // may play that card" is a real, separate STATIC permission grant
      // (`StaticAbilities$ MayPlay`) with no equivalent action anywhere in
      // this engine (no "grant permission to cast from exile" mechanism) —
      // left unmodeled beyond this comment, same "genuinely out of scope"
      // treatment triple-triad's own play-without-paying permission gets.
      name: 'chapterI',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Exile', qty: 1, target: false } satisfies Effect],
    },
    {
      // Real `DB$ DelayedTrigger | Mode$ SpellCast | ValidCard$ Creature |
      // ThisTurn$ True` — a real delayed trigger watching for a FUTURE,
      // not-yet-cast spell; no mechanism anywhere in this engine (no
      // stack, no "watch the next cast" hook) can represent that, so this
      // is a genuine no-op `custom` — same shape stolen-uniform's own
      // unmodeled unattach delayed trigger uses (call nothing, `describe`
      // carries the real text).
      name: 'chapterII',
      effects: [
        {
          kind: 'custom',
          describe: 'Gestalt Mode — when you next cast a creature spell this turn, it gains haste until end of turn (no delayed/future-cast-watching mechanism exists in this engine)',
          run: (_ctx: EffectContext, _actions: Actions) => {},
        } satisfies Effect,
      ],
    },
    {
      name: 'chapterIII',
      effects: [
        {
          kind: 'custom',
          describe: 'Gestalt Mode — when you next cast a creature spell this turn, it gains haste until end of turn (no delayed/future-cast-watching mechanism exists in this engine)',
          run: (_ctx: EffectContext, _actions: Actions) => {},
        } satisfies Effect,
      ],
    },
  ],
};
