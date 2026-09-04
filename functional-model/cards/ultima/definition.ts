import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const ultima: CardDefinition = {
  name: 'Ultima',
  manaCost: '{3}{W}{W}',
  typeLine: 'Sorcery',

  effects: [
    {
      // Real `SP$ DestroyAll | ValidCards$ Artifact,Creature` — Forge's own
      // real UNCHOSEN mass-destroy ApiType, genuinely different from the
      // `destroy` Effect kind here (which mirrors the targeted
      // `DestroyEffect`: a player-CHOSEN pool of `qty` picks). `destroy`'s
      // own `validType` also only offers 'permanent'|'creature' — neither
      // covers "artifacts AND creatures, but not lands/enchantments."
      // `custom`, looping the real `destroy` action over the real
      // battlefield-wide pool filtered by `isArtifact()`/`isCreature()`, is
      // the honest shape — every primitive here (`getCardsIn`, the two
      // predicates, `actions.destroy`) already exists; this just isn't a
      // "chosen N targets" loop the declarative `destroy` kind models.
      kind: 'custom',
      describe: 'destroy all artifacts and creatures',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = [...ctx.you.getCardsIn('Battlefield'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield'))].filter(
          (c) => c.isArtifact() || c.isCreature()
        );
        for (const card of pool) actions.destroy(card);
      },
    } satisfies Effect,
    {
      // "End the turn." — a real turn-ending game action (exile the stack,
      // discard down to maximum hand size, damage/until-end-of-turn effects
      // end) — no turn-ending machinery anywhere in this model (turn.ts
      // tracks phases/steps, not a way to jump straight to cleanup) — real
      // text only, same honest no-op treatment crystal-fragments-summon-
      // alexander's own damage-prevention chapters get for a mechanic this
      // model has no machinery for at all.
      kind: 'custom',
      describe: 'end the turn (exile the stack, discard down to maximum hand size, "until end of turn" effects end) — no turn-ending machinery in this model',
      run: () => {},
    } satisfies Effect,
  ],
};
