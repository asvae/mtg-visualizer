<script setup lang="ts">
// Deliberately minimal — the FDN sink-only-synergy pool has no
// synergy.json/Fact.annotations at all by design (see
// `.claude/contracts/card-schema.md`), so there is nothing to highlight
// and nothing to click. This is NOT a second annotation system and isn't
// meant to grow into one — if FDN ever gains fact-linked spans of its own,
// that's a new design decision, not an incremental extension of this
// component. `FunctionalModelText.vue` (FIN's own annotated-oracle-text
// component, `Fact.annotations`-driven) is untouched and still the only
// component used for `fin` cards.
//
// `oracleText` is the raw string server/api/card/[set]/[number].ts's
// `FunctionalModelData.oracleText` serves — one or more faces' real,
// printed Scryfall `oracle_text`, faces already joined server-side with a
// blank line between them. `whitespace-pre-wrap` alone reproduces every
// real line break (within an ability and between faces) with no
// client-side splitting/segment logic needed.
defineProps<{ oracleText: string }>();
</script>

<template>
  <p class="max-w-2xl font-sans text-sm leading-relaxed whitespace-pre-wrap text-text/90">{{ oracleText }}</p>
</template>
