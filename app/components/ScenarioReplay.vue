<script setup lang="ts">
// Scenarios tab: one step-through replay per recorded scenario (see
// ScenarioReplayTrace.vue for a single scenario's board+log playback).
// Supersedes TraceViewer.vue's flat log table — same raw log, now paired
// with a reconstructed board instead of read alone.
import { ref, watch } from 'vue';
import { GENERIC_FILLER_LAND } from '../../functional-model/harness';
import type { LogEntry, Scenario } from '../../functional-model/harness';

const props = defineProps<{
  traces: {
    scenario: { setup: string; action: string; result: string; raw?: Scenario };
    log: LogEntry[];
    actions?: { label: string; from: number }[];
  }[];
  /** The real card's own images (front/back) — forwarded to each ScenarioReplayTrace so the one "self" chip per board can show real art instead of a placeholder. */
  cardImages?: string[];
  /** The real card's own printed keywords (Scryfall's `card.keywords`) — shown on the "self" chip alongside any mid-scenario `grantKeyword` log entries. */
  cardKeywords?: string[];
}>();

// Two kinds of scenario filler are real named cards, not the synthetic
// `${owner}-land-0`-style placeholders — worth a real image instead of a
// placeholder chip: basic lands (harness.ts's `PlayerState.basicLands`, real
// Scryfall cards) and named tokens (`PlayerState.tokens`, functional-model/
// tokens.ts's TOKENS keys). Both resolved once per unique name/key across
// every scenario here, merged into one name -> image map — a token's
// `.name` (e.g. "Treasure") is what ReplayCard.name/seedPlayerCards actually
// use, same as a land's, so one lookup table covers both.
const fillerImages = ref<Record<string, string>>({});
watch(
  () => props.traces,
  async (traces) => {
    const playerStates = traces.flatMap((t) => [t.scenario.raw?.you, ...(t.scenario.raw?.opponents ?? [])]);
    // `GENERIC_FILLER_LAND` (harness.ts) — the real basic land a plain
    // hand/library filler now uses (scenarioReplay.ts's own `seedPlayerCards`
    // mirror) — always requested alongside any scenario's own real
    // `basicLands`, since a plain filler's identity isn't itself a field on
    // `PlayerState` to read off here.
    const landNames = [...new Set([...playerStates.flatMap((ps) => ps?.basicLands ?? []), GENERIC_FILLER_LAND])];
    const tokenKeys = [...new Set(playerStates.flatMap((ps) => ps?.tokens ?? []))];
    const images: Record<string, string> = {};
    await Promise.all([
      (async () => {
        if (!landNames.length) return;
        try {
          const res = await fetch('/api/cards/by-names', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names: landNames }),
          });
          if (!res.ok) return;
          const body = await res.json();
          for (const c of body.cards ?? []) {
            const url = c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal;
            if (url) images[c.name] = url;
          }
        } catch {
          // network hiccup — these just keep their placeholder chip
        }
      })(),
      (async () => {
        if (!tokenKeys.length) return;
        try {
          const res = await fetch(`/api/tokens/by-key?keys=${tokenKeys.join(',')}`);
          if (!res.ok) return;
          const body = await res.json();
          for (const t of body.tokens ?? []) if (t.image) images[t.name] = t.image;
        } catch {
          // network hiccup — these just keep their placeholder chip
        }
      })(),
    ]);
    fillerImages.value = images;
  },
  { immediate: true }
);
</script>

<template>
  <div class="flex flex-col gap-3">
    <ScenarioReplayTrace
      v-for="(trace, ti) in traces"
      :key="ti"
      :trace="trace"
      :card-images="cardImages"
      :card-keywords="cardKeywords"
      :filler-images="fillerImages"
      :class="{ 'border-t border-border-subtle pt-3': ti > 0 }"
    />
  </div>
</template>
