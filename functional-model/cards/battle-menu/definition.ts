import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const battleMenu: CardDefinition = {
  name: 'Battle Menu',
  manaCost: '{1}{W}',
  typeLine: 'Instant',

  // PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, scoped trial) — same real
  // multi-line-modal limitation as aerith-rescue-mission's own
  // `effectsAnnotation` comment (single-line-only `AnnotationRef` can't span
  // this card's 4 mode lines); annotated at the modal header only. Per-mode
  // detail is NOT lost, though — each mode below carries its own
  // `annotation`, anchored to that mode's own real oracle-text line.
  effectsAnnotation: { highlight: 'Choose one —', line: 0 },
  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Attack — create a 2/2 white Knight creature token',
          effects: [{ kind: 'createToken', token: TOKENS.w_2_2_knight, amount: 1 } satisfies Effect],
          annotation: { highlight: '• Attack — Create a 2/2 white Knight creature token.', line: 1 },
        },
        {
          describe: 'Ability — target creature gets +0/+4 until end of turn',
          effects: [{ kind: 'pumpTarget', power: 0, toughness: 4 } satisfies Effect],
          annotation: { highlight: '• Ability — Target creature gets +0/+4 until end of turn.', line: 2 },
        },
        {
          describe: 'Magic — destroy target creature with power 4 or greater',
          effects: [{ kind: 'destroy', validType: 'creature', qty: 1, minPower: 4 } satisfies Effect],
          annotation: { highlight: '• Magic — Destroy target creature with power 4 or greater.', line: 3 },
        },
        {
          describe: 'Item — you gain 4 life',
          effects: [{ kind: 'gainLife', amount: 4 } satisfies Effect],
          annotation: { highlight: '• Item — You gain 4 life.', line: 4 },
        },
      ],
    } satisfies Effect,
  ],
};
