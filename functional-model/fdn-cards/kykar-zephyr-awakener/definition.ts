import type { CardDefinition, Effect } from '../../card';

// Real Forge (kykar_zephyr_awakener.txt): `T:Mode$ SpellCast | ValidCard$
// Card.nonCreature` — bare name-only trigger (no `on` value exists for
// "you cast a noncreature spell"). Mode 1's own `SVar:DelTrig:DB$
// DelayedTrigger | Mode$ Phase | Phase$ End of Turn | ...` is a real,
// genuine DELAYED trigger (exile now, come back at a LATER game event) — no
// `ProgramNode`/Effect primitive schedules a future trigger at all (this
// engine's own `ENGINE_GAPS.md`-tracked "delayed trigger" gap, distinct
// from a plain `untilEndOfTurn` duration flag).
export const kykarZephyrAwakener: CardDefinition = {
  name: 'Kykar, Zephyr Awakener',
  manaCost: '{2}{W}{U}',
  typeLine: 'Legendary Creature — Bird Wizard',
  pt: [3, 4],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'onCastNoncreatureSpell',
      effects: [
        {
          kind: 'modal',
          modes: [
            {
              describe: "Exile another target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.",
              effects: [],
            },
            {
              describe: 'Create a 1/1 white Spirit creature token with flying.',
              effects: [
                {
                  kind: 'createToken',
                  token: { name: 'Spirit', manaCost: '0', types: ['Creature', 'Spirit'], basePower: 1, baseToughness: 1, keywords: ['Flying'] },
                  amount: 1,
                } satisfies Effect,
              ],
            },
          ],
        } satisfies Effect,
      ],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: "Exile another target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step.",
      demand:
        'No delayed-trigger primitive exists anywhere in this schema (schedule an effect to fire at a LATER game event, e.g. "at the beginning of the next end step") — only `untilEndOfTurn`-style flat durations exist, not a genuine future trigger.',
    },
  ],
};
