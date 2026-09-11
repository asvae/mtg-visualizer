<script setup lang="ts">
// Scenarios tab: one step-through replay per recorded scenario (see
// ScenarioReplayTrace.vue for a single scenario's board+log playback).
// Supersedes TraceViewer.vue's flat log table — same raw log, now paired
// with a reconstructed board instead of read alone.
import { computed, ref, watch } from 'vue';
import { GENERIC_FILLER_LAND } from '../../functional-model/harness';
import type { LogEntry, Scenario } from '../../functional-model/harness';
import { TOKENS } from '../../functional-model/tokens';
import { replayTrace } from '../lib/scenarioReplay';
import type { ContinuousKeywordGrant } from '../../server/api/card/[set]/[number]';

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
  /** The real card's own printed power/toughness (front, then back for a transforming DFC whose back face is also a creature) — app/pages/app/card/[set]/[number].vue's own `card.power`/`toughness`/`backPower`/`backToughness`. Raw Scryfall strings ("3", "*", ...); undefined for a non-creature. */
  cardPower?: string;
  cardToughness?: string;
  cardBackPower?: string;
  cardBackToughness?: string;
  /** Real art/keywords for every OTHER genuinely-named real card this scenario references, keyed by that card's own real Scryfall name — an ADDITIONAL/override source layered on top of `autoNamedCardArt` below (this component's own by-name lookup, which already covers every caller). Only the keywords-coverage page (KeywordEntryCard.vue) actually sets this today, from its own already-fetched `entry.cards` (a richer pool with real power/toughness `autoNamedCardArt`'s own `/api/cards/by-names` lookup doesn't carry, see that computed's own doc comment) — undefined for every other caller, which relies on `autoNamedCardArt` alone. */
  namedCardArt?: Record<string, { images: string[]; keywords: string[]; power?: string; toughness?: string }>;
  /** The tested card's own real `CardDefinition.continuousKeywordGrants` (front, then back for a transforming DFC) — app/pages/app/card/[set]/[number].vue's own `functionalModel.continuousKeywordGrants`. Forwarded straight through to each `ScenarioReplayTrace` — see that component's own doc comment for how a query-time grant like this gets shown despite having no discrete trace.json log entry of its own. */
  continuousKeywordGrants?: { front?: ContinuousKeywordGrant[]; back?: ContinuousKeywordGrant[] } | null;
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
/** Every OTHER real, non-self, non-filler card name a scenario's own log
 * puts on the board — resolved by name the same way `fillerImages` resolves
 * basic lands, via `/api/cards/by-names`. This used to be something ONLY
 * the keywords-coverage page bothered computing (see the `namedCardArt`
 * prop's own doc comment history) on the assumption that a per-card page's
 * own Scenarios tab never has more than the one tested "self" card on the
 * board — false as of summon-bahamut's own scenario (fin/1), whose real
 * Chapter I destroys a real bystander Coeurl while a real bystander Ahriman
 * sits on the battlefield the whole time, neither ever marked `isSelf`
 * (scenarioReplay.ts's own `ensure(cardName, 'Battlefield')` branch for an
 * `enters` entry with no `instanceId`). Computed HERE instead of only in
 * KeywordEntryCard.vue so every current and future `ScenarioReplay` caller
 * gets it for free, not just that one page. */
const autoNamedCardArt = ref<Record<string, { images: string[]; keywords: string[] }>>({});
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
    const landNameSet = new Set(landNames);
    const tokenNameSet = new Set(tokenKeys.map((k) => (TOKENS as Record<string, { name: string }>)[k]?.name).filter((n): n is string => !!n));
    // Reverse name -> keys map across the FULL TOKENS registry, not just
    // this scenario's own pre-seeded `ps.tokens` — needed to recognize a
    // token created DYNAMICALLY mid-scenario (a real `createToken` action
    // firing during replay, e.g. `the-crystal-s-chosen`'s "Create four 1/1
    // colorless Hero creature tokens"), which by definition has no `ps.tokens`
    // entry to have populated `tokenNameSet` above. A board snapshot showing
    // that name already proves a token by that name genuinely exists,
    // regardless of whether the scenario's static setup happened to declare
    // it upfront. Two TOKENS keys legitimately share one literal name
    // ("Cat": `w_1_1_cat`/`w_1_1_cat_lifelink`) — genuinely ambiguous, no
    // scenario-level signal here to pick the right art variant — so below
    // this map is only trusted when a name resolves to EXACTLY ONE key; an
    // ambiguous name falls back to the OLD pre-seeded-config-only behavior
    // (i.e. still resolved correctly if `ps.tokens` already named the right
    // variant, otherwise treated as a generic real-bystander lookup, same as
    // before this fix — ambiguous names are rare and already handled that
    // way today, unlike the unambiguous dynamic-token case this fixes).
    const tokenNameToKeys = new Map<string, string[]>();
    for (const [key, def] of Object.entries(TOKENS)) {
      const list = tokenNameToKeys.get(def.name) ?? [];
      list.push(key);
      tokenNameToKeys.set(def.name, list);
    }
    // Every card any trace's own replay ever puts on the board (self and
    // every filler alike — see `replayTrace`'s own doc comment: nothing is
    // ever removed from its returned `cards`, only re-zoned, so the LAST
    // snapshot alone already reflects everything that ever appeared).
    const boardCards = traces.flatMap((t) => {
      const snaps = replayTrace(t);
      return snaps[snaps.length - 1]?.cards ?? [];
    });
    // Board-card names that match EXACTLY ONE TOKENS key by name and aren't
    // already covered by the pre-seeded `tokenNameSet` — i.e. a genuinely
    // dynamically-created, unambiguous token. Their keys get folded into the
    // same `/api/tokens/by-key` fetch pre-seeded tokens already use below.
    // Only keeps keys for names that resolved to a SINGLE key (unambiguous)
    // — an ambiguous name (multiple keys, e.g. "Cat") must not silently pick
    // one via iteration/insertion order.
    const dynamicTokenKeySet = new Set(
      boardCards
        .filter((c) => !c.isSelf && !landNameSet.has(c.name) && !tokenNameSet.has(c.name))
        .map((c) => tokenNameToKeys.get(c.name))
        .filter((keys): keys is string[] => !!keys && keys.length === 1)
        .map((keys) => keys[0]!)
    );
    const dynamicTokenNameSet = new Set([...dynamicTokenKeySet].map((k) => (TOKENS as Record<string, { name: string }>)[k]!.name));
    const allTokenKeys = [...new Set([...tokenKeys, ...dynamicTokenKeySet])];
    // Filtered down to genuinely real bystanders: not `isSelf` (`cardImages`
    // above already covers that one), not a name already resolved via
    // `landNameSet`/`tokenNameSet`/`dynamicTokenNameSet` (the new
    // exactly-one-key dynamic-token case above), and not one of
    // `setupPlayer`'s own synthetic `${role}-...`-prefixed filler names
    // (scenarioReplay.ts's own `guessOwner`/`groupNameOf` doc comments: a
    // real Scryfall card name never takes that shape, only generated filler
    // does).
    const extraNames = [
      ...new Set(
        boardCards
          .filter(
            (c) =>
              !c.isSelf &&
              !landNameSet.has(c.name) &&
              !tokenNameSet.has(c.name) &&
              !dynamicTokenNameSet.has(c.name) &&
              !/^(you|opp\d+)-/.test(c.name)
          )
          .map((c) => c.name)
      ),
    ];
    const images: Record<string, string> = {};
    const extraArt: Record<string, { images: string[]; keywords: string[] }> = {};
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
        if (!allTokenKeys.length) return;
        try {
          const res = await fetch(`/api/tokens/by-key?keys=${allTokenKeys.join(',')}`);
          if (!res.ok) return;
          const body = await res.json();
          for (const t of body.tokens ?? []) if (t.image) images[t.name] = t.image;
        } catch {
          // network hiccup — these just keep their placeholder chip
        }
      })(),
      (async () => {
        if (!extraNames.length) return;
        try {
          const res = await fetch('/api/cards/by-names', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names: extraNames }),
          });
          if (!res.ok) return;
          const body = await res.json();
          for (const c of body.cards ?? []) {
            const cardImages = [c.image_uris?.normal, ...(c.card_faces ?? []).map((f: { image_uris?: { normal?: string } }) => f.image_uris?.normal)].filter(
              (u: string | undefined): u is string => !!u
            );
            if (cardImages.length) extraArt[c.name] = { images: cardImages, keywords: c.keywords ?? [] };
          }
        } catch {
          // network hiccup — these just keep their placeholder chip
        }
      })(),
    ]);
    fillerImages.value = images;
    autoNamedCardArt.value = extraArt;
  },
  { immediate: true }
);

/** `namedCardArt` (a caller's own richer/curated data, when set) layered over `autoNamedCardArt` (this component's own generic by-name lookup, always attempted) — a caller-provided entry for the same name wins (e.g. KeywordEntryCard.vue's own pool carries real power/toughness this component's `/api/cards/by-names` lookup doesn't, see that prop's own doc comment), but nothing here ever REQUIRES a caller to pass anything for a real bystander card to render with real art. */
const mergedNamedCardArt = computed(() => ({ ...autoNamedCardArt.value, ...(props.namedCardArt ?? {}) }));
</script>

<template>
  <div class="flex flex-col gap-3">
    <ScenarioReplayTrace
      v-for="(trace, ti) in traces"
      :key="ti"
      :trace="trace"
      :card-images="cardImages"
      :card-keywords="cardKeywords"
      :card-power="cardPower"
      :card-toughness="cardToughness"
      :card-back-power="cardBackPower"
      :card-back-toughness="cardBackToughness"
      :filler-images="fillerImages"
      :named-card-art="mergedNamedCardArt"
      :continuous-keyword-grants="continuousKeywordGrants"
      :class="{ 'border-t border-border-subtle pt-3': ti > 0 }"
    />
  </div>
</template>
