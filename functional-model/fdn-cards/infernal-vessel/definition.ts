import type { CardDefinition, Effect } from '../../card';

export const infernalVessel: CardDefinition = {
  name: 'Infernal Vessel',
  manaCost: '{2}{B}',
  typeLine: 'Creature — Human Cleric',
  pt: [2, 1],

  // Real Forge: `Mode$ ChangesZone | Origin$ Battlefield |
  // Destination$ Graveyard | ValidCard$ Card.Self+nonDemon` — "When this
  // creature dies, if it wasn't a Demon, return it to the battlefield
  // under its owner's control with two +1/+1 counters on it. It's a Demon
  // in addition to its other types." The "if it wasn't a Demon" gate
  // (checking a real prior board-state fact) isn't tracked anywhere in
  // this engine — dropped as an accepted simplification (the rest of the
  // clause is real, executable code below); no `on` value exists for a
  // dies event either, kept as a name-only trigger (same convention every
  // other not-yet-auto-fired trigger in this pool already uses).
  //
  // "Return it to the battlefield" moves the SAME object (by the time this
  // trigger fires, `ctx.self` is already the card sitting in the
  // graveyard) — `actions.moveTo(ctx.self, 'Battlefield')`, the same real
  // primitive joshua-phoenix's-dominant's own exile-then-return custom
  // effect already uses. "It's a Demon in addition to its other types" is
  // `actions.animate` (real, additive — see interfaces.ts's own doc
  // comment), not a full type replacement.
  triggers: [
    {
      name: 'onDeath',
      effects: [
        {
          kind: 'custom',
          describe: "return it to the battlefield under its owner's control with two +1/+1 counters on it; it's a Demon in addition to its other types",
          run: (ctx, actions) => {
            actions.moveTo(ctx.self, 'Battlefield');
            actions.putCounter(ctx.self, '+1/+1', 2);
            actions.animate(ctx.self, ['Demon']);
          },
        } satisfies Effect,
      ],
    },
  ],
};
