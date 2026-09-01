<script setup lang="ts">
import { computed } from 'vue';

// Single source of truth for every icon the card shorthand notation can use
// (see CARD_SHORTHAND.md and data/card_shorthands.json) — Mana font class +
// hover tooltip, plus every literal bracket word that should resolve to it.
// `words` are exactly what should appear if icons are ever turned off (a
// plain `[word]` -> `word` strip, no MtgIcon component involved) — real
// casing/spelling ("tapped", "Landfall" at a sentence start), not an
// abbreviation. A word can read differently depending on grammar (a card
// might need "[tap]" as a noun elsewhere, not just "[tapped]") — list every
// variant a card shorthand might use so they all render the same icon. A
// word with no icon here (pending or unrecognized) just renders as its own
// plain text, brackets stripped — the whole point of the bracket syntax
// being the real English word is that this fallback always reads fine.
// Every icon shares the same size/alignment (see .mtg-icon below) — no
// per-icon overrides.
// `classes` is the full class list (base font class + specific glyph class) —
// currently always Mana font ("ms ms-xxx").
const ICON_DEFS: { classes: string; label: string; words: string[] }[] = [
  { classes: 'ms ms-tap', label: 'Tapped', words: ['tap', 'tapped'] },
  { classes: 'ms ms-ability-landfall', label: 'Landfall', words: ['landfall'] },
  { classes: 'ms ms-ability-trample', label: 'Trample', words: ['trample'] },
  { classes: 'ms ms-ability-flash', label: 'Flash', words: ['flash'] },
  { classes: 'ms ms-ability-lifelink', label: 'Lifelink', words: ['lifelink'] },
  { classes: 'ms ms-flashback', label: 'Flashback', words: ['flashback'] },
  { classes: 'ms ms-counter-plus', label: '+1/+1 counter', words: ['counter', 'counters'] },
  { classes: 'ms ms-counter-stun', label: 'Stun counter', words: ['stun', 'stuns', 'stunned'] },
  { classes: 'ms ms-power', label: 'Power', words: ['power'] },
  { classes: 'ms ms-ability-vigilance', label: 'Vigilance', words: ['vigilance'] },
  { classes: 'ms ms-ability-indestructible', label: 'Indestructible', words: ['indestructible'] },
  { classes: 'ms ms-ability-ward', label: 'Ward', words: ['ward'] },
  { classes: 'ms ms-ability-hexproof', label: 'Hexproof', words: ['hexproof'] },
  { classes: 'ms ms-ability-crew', label: 'Crew', words: ['crew'] },
  { classes: 'ms ms-ability-reach', label: 'Reach', words: ['reach'] },
  // Mana font's actual Sorcery card-type pip — real semantic fit, unlike the
  // borrowed-icon experiments above that got reverted (target, choose).
  { classes: 'ms ms-sorcery', label: 'Sorcery speed only', words: ['sorcery speed only'] },
  { classes: 'ms ms-ability-first-strike', label: 'First strike', words: ['first strike'] },
  { classes: 'ms ms-ability-deathtouch', label: 'Deathtouch', words: ['deathtouch'] },
  { classes: 'ms ms-ability-haste', label: 'Haste', words: ['haste'] },
  { classes: 'ms ms-ability-menace', label: 'Menace', words: ['menace'] },
  { classes: 'ms ms-ability-double-strike', label: 'Double strike', words: ['double strike'] },
  { classes: 'ms ms-ability-prowess', label: 'Prowess', words: ['prowess'] },
  { classes: 'ms ms-ability-cycling', label: 'Cycling', words: ['cycling'] },
  { classes: 'ms ms-ability-surveil', label: 'Surveil', words: ['surveil'] },
  { classes: 'ms ms-ability-kicker', label: 'Kicker', words: ['kicker'] },
  { classes: 'ms ms-counter-charge', label: 'Charge counter', words: ['charge'] },
];
// Lookup is case-insensitive — a card writing "[Landfall]" at a sentence
// start and another writing "[trample]" mid-sentence both just work.
const ICONS: Record<string, { classes: string; label: string }> = Object.fromEntries(
  ICON_DEFS.flatMap((d) => d.words.map((w) => [w.toLowerCase(), { classes: d.classes, label: d.label }]))
);

const props = defineProps<{ name: string }>();
const icon = computed(() => ICONS[props.name.toLowerCase()]);
</script>

<template>
  <i v-if="icon" class="mtg-icon" :class="icon.classes" :title="icon.label" :aria-label="icon.label"></i>
  <span v-else>{{ name }}</span>
</template>

<style scoped>
.mtg-icon {
  font-size: 0.75em;
}
</style>
