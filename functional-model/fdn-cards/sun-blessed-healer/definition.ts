import type { CardDefinition, Effect } from '../../card';

export const sunBlessedHealer: CardDefinition = {
  name: 'Sun-Blessed Healer',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Human Cleric',
  pt: [3, 1],

  // Real Kicker {1}{W}. `'Kicker'` is now a real `Keyword` union member
  // (2026-09-18, schema-completeness pass) — the base "this spell has
  // Kicker" fact is tracked via `keywords`, and the specific non-default
  // cost payload ("{1}{W}") is recorded via the new sibling
  // `keywordCosts` field (same split Ward already uses — see
  // sire-of-seven-deaths/zul-ashur-lich-lord). Still recognized-but-inert:
  // no payment-tracking or modal-gating-on-payment mechanism exists
  // anywhere in this engine (Ward pattern — see
  // `engine-support-registry.ts`'s own `kicker-not-enforced` entry) — the
  // card's own kicked/not-kicked BRANCH is still modeled via the
  // pre-existing `modal`/`ctx.mode` mechanism below, same as before this
  // field existed.
  keywords: ['Kicker', 'Lifelink'],
  keywordCosts: [{ keyword: 'Kicker', cost: '{1}{W}' }],

  // "When this creature enters, if it was kicked, return target nonland
  // permanent card with mana value 2 or less from your graveyard to the
  // battlefield." No field conditions a trigger's firing on whether an
  // alternate/additional cost was paid — modeled via the same
  // `modal`/`ctx.mode` convention chocobo-kick/vayne-s-treachery/
  // divine-resilience already use for Kicker (mode 0 = not kicked,
  // nothing happens; mode 1 = kicked, do the real return).
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'modal',
          modes: [
            { describe: 'Not kicked — nothing happens.', effects: [] },
            {
              describe:
                'If this creature was kicked, return target nonland permanent card with mana value 2 or less from your graveyard to the battlefield.',
              effects: [
                {
                  kind: 'move',
                  owner: 'you',
                  from: 'Graveyard',
                  to: 'Battlefield',
                  validType: 'any',
                  nonLand: true,
                  maxCmc: 2,
                  qty: 1,
                  target: true,
                } satisfies Effect,
              ],
            },
          ],
        } satisfies Effect,
      ],
    },
  ],
};
