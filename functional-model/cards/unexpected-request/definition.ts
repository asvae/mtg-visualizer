import type { CardDefinition, Effect } from '../../card';
import { selectUpTo, applyToBound, gainControl, untap, grantKeyword, equipTo, anyPlayer, you } from '../../combinator';

export const unexpectedRequest: CardDefinition = {
  name: 'Unexpected Request',
  manaCost: '{2}{R}',
  typeLine: 'Sorcery',

  // Migrated (2026-09-16, coordinator-routed pilot-triage escalation) off a
  // raw `custom` closure onto `kind:'program'`, chaining the real
  // `gainControl`/`untap`/`grantKeyword`/`equip` `EachAction`s (built
  // specifically for this real card and its siblings — see `EachAction`'s
  // own doc comment) via nested `SelectUpTo`/`ApplyToBound`: the OUTER
  // selection picks the creature target (`anyPlayer.creaturesInPlay()` —
  // the real `ValidTgts$ Creature` carries no controller restriction, so
  // the pool spans both sides), the INNER selection picks the Equipment to
  // attach (`you.permanentsInPlay().filter('subtype','Equipment')`, same
  // deterministic "first legal match" `chooseTarget` already used pre-
  // migration via `.find()`), then `equipTo('target', 0)` attaches it onto
  // the OUTER binding's own picked creature. The delayed "unattach at the
  // beginning of the next end step" and "control reverts at end of turn"
  // triggers have no unattach/control-revert action anywhere in this
  // engine — left unmodeled beyond this comment, same "genuinely out of
  // scope" treatment stolen-uniform's own end-of-turn unattach gets.
  effects: [
    {
      kind: 'program',
      describe:
        'gain control of target creature until end of turn; untap it and it gains haste until end of turn; you may attach an Equipment you control to it (the end-of-turn control-revert and unattach delayed triggers are not modeled — no such actions exist in this engine)',
      program: selectUpTo(anyPlayer.creaturesInPlay(), 1, 'target', [
        applyToBound('target', 0, gainControl('you')),
        applyToBound('target', 0, untap()),
        applyToBound('target', 0, grantKeyword('Haste')),
        selectUpTo(you.permanentsInPlay().filter('subtype', 'Equipment'), 1, 'equipment', [applyToBound('equipment', 0, equipTo('target', 0))]),
      ]),
    } satisfies Effect,
  ],
};
