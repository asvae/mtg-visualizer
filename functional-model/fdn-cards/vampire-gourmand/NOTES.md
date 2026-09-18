# Vampire Gourmand — authoring notes

## Authoring background

Real Forge: `Mode$ Attacks | ValidCard$ Card.Self` — a real self-attack
auto-fire trigger. The sacrifice is a real COST (`Cost$
Sac<1/Creature.Other/...>`) gating the draw+unblockable — same "optional
sacrifice, then the gated effect runs unconditionally" pattern
namazu-trader's own onAttack trigger already establishes (no
player-decision engine exists to model a DECLINED optional sacrifice
separately). "Can't be blocked this turn" is the real `'Unblockable'`
keyword grant (card.ts's own doc comment: approximated via the same
`grantKeywordSelf`/`hasKeyword` machinery a real keyword grant already
uses).
