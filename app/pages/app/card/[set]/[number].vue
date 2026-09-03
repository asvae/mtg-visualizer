<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { describeRelation, groupChipsByVerb } from '../../../../lib/relations';
import { parseManaSegments } from '../../../../lib/manaSegments';
import type { InteractionGroup } from '../../../../lib/synergyInteractions';
import type { CardData, EdgeData, SynergyFlow, SynergyFlowStep, SynergyNode, SynergyExamResult, ThemeData } from '../../../../types';

definePageMeta({ layout: 'graph' });

const route = useRoute();

interface CardResponse {
  card: CardData;
  edges: EdgeData[];
  themes: ThemeData[];
  synergyNodes: Record<string, SynergyNode> | null;
  synergyFlow: SynergyFlow | null;
  synergyReview: 'ai' | 'human' | null;
  synergyExam: SynergyExamResult | null;
  forgeScript: string | null;
  interactions: InteractionGroup[];
}

// Prev/next is pure client-side ±1 on the URL's :number — no server
// round-trip to validate a neighbor exists, so clicking Next/Previous (or
// pressing the arrow keys) doesn't wait on anything. A number past either
// edge of the set just 404s into this page's own "Card not found" state.
const currentNumber = computed(() => parseInt(String(route.params.number), 10));
const prevNumber = computed(() => (Number.isFinite(currentNumber.value) && currentNumber.value > 1 ? currentNumber.value - 1 : null));
const nextNumber = computed(() => (Number.isFinite(currentNumber.value) ? currentNumber.value + 1 : null));

// Standalone request — this page owns its data, independent of the big
// client-side graph store (app/composables/useGraphStore.ts). A direct visit
// (bookmark, shared link) renders without needing the whole graph loaded first.
// URL as a getter (not a plain string) so clicking Previous/Next — which
// changes the route params on the same route instance — re-fetches instead of
// only fetching once at first mount. Routed by set/collector-number (same URL
// shape as scryfall.com/card/<set>/<number>) rather than the Scryfall id, so
// prev/next is a plain ±1 on the number segment.
// Not awaited: this route is ssr:false (client-only) anyway, and awaiting
// would suspend this component's own render until the fetch resolves —
// meaning `pending` is already false by the time anything renders, so the
// spinner below never shows on a fresh visit (only on a later Previous/Next
// reactive refetch, once the component's already mounted).
const { data, pending, error } = useFetch<CardResponse>(() => `/api/card/${route.params.set}/${route.params.number}`);

const card = computed(() => data.value?.card ?? null);

// Raw payload behind the "Raw JSON" spoiler — the exact nodes/flow the
// outline table below walks, for a direct look at what synergy-model
// actually stores versus forge-model's own raw script spoiler.
const synergyJson = computed(() => {
  if (!data.value?.synergyNodes || !data.value?.synergyFlow) return null;
  return JSON.stringify({ nodes: data.value.synergyNodes, flow: data.value.synergyFlow }, null, 2);
});

const themeLabelById = computed(() => {
  const map = new Map<string, string>();
  data.value?.themes.forEach((t) => map.set(t.id, t.label));
  return map;
});

// Same chip/column pipeline TooltipView.vue uses for the hover popup — this
// page shows the same info, just as a dedicated route instead of a tooltip.
const relationChips = computed(() => {
  if (!data.value) return [];
  return data.value.edges.flatMap((e) => {
    const label = themeLabelById.value.get(e.theme) ?? e.theme;
    return describeRelation(label, e.role, e.weight).map((chip, i) => ({ ...chip, key: `${e.theme}-${i}` }));
  });
});
const chipColumns = computed(() => groupChipsByVerb(relationChips.value));

// Subtle role tints for the synergy outline — desaturated, close to the
// page's default near-white text color rather than the saturated
// produce/consume/etc. palette main.css uses for theme relations. Roles not
// listed (becomes, amplify, suppress, sensor, scaler, modifier, tagger) fall
// through to the default text color. `enters` (bare arrival onto the
// battlefield) keeps green; `trigger` (the ability itself becoming a stack
// object per rule 603.3b — replaces the old listen/on-enter/deals-damage
// roles) gets a distinct cyan so the "went on the stack" roles read as
// their own group.
const SYNERGY_ROLE_COLORS: Partial<Record<SynergyNode['role'], string>> = {
  enters: '#9ecfa0',
  trigger: '#9dcacf',
  emit: '#d8ab88',
  move: '#cfc69d',
  source: '#a3c7a8',
};
function synergyRoleColor(role: SynergyNode['role']): string | undefined {
  return SYNERGY_ROLE_COLORS[role];
}
function synergyRoleLabel(node: SynergyNode): string {
  return node.role === 'trigger' && node['trigger-type'] ? `trigger(${node['trigger-type']})` : node.role;
}

// Storage is flat (nodes + a separate flow graph, see app/types.ts) — this
// walks `flow` from each root at render time to reconstruct the outline the
// old flat step-numbered table used to show directly. A node reached from
// more than one parent (a shared tail after a branch group) is walked once
// per reaching path and appears once per occurrence — that's the honest
// picture (the same fact really does follow from either branch), not a
// dedup bug.
interface OutlineNodeRow {
  kind: 'node';
  key: string;
  id: string;
  node: SynergyNode;
  depth: number;
  isRoot: boolean;
  // A child id that has its OWN canonical home in `flow.roots` (e.g.
  // `enters` — it can happen without a cast, reanimation etc.) never gets
  // its own row when reached as someone else's step: there's nothing to
  // expand there anyway (its full definition lives at its root slot), so
  // it's folded into THIS row as a small link instead of a whole separate
  // line that would just say "see elsewhere". Doesn't apply to an id with
  // no root of its own reached from two different `combine` branches
  // (Namazu's `surveil`) — neither occurrence there is "the real one," so
  // both still get their own full row.
  links: { id: string; node: SynergyNode }[];
}
interface OutlineGroupRow {
  kind: 'group';
  key: string;
  combine: 'any' | number;
  depth: number;
  isRoot: boolean;
}
type OutlineRow = OutlineNodeRow | OutlineGroupRow;

function walkFlowStep(
  step: SynergyFlowStep,
  depth: number,
  isRoot: boolean,
  keyPrefix: string,
  nodes: Record<string, SynergyNode>,
  flow: SynergyFlow,
  rows: OutlineRow[],
  // Root-owned ids AND non-root self-arrivals (a returning-transformed
  // re-arrival caused by exile-then-return, e.g.) — anything with its own
  // full top-level walk elsewhere (see `outlineRows`), so a reference to it
  // here is a link, never a re-expansion.
  linkableIds: Set<string>,
  ancestors: Set<string>
) {
  if (typeof step === 'string') {
    const node = nodes[step];
    if (!node) return;
    const key = `${keyPrefix}${step}`;
    const nextAncestors = new Set(ancestors).add(step);
    // Cycle guard for malformed data only — a real repeat (linkable id
    // reached as a non-linkable child) is handled by the caller below,
    // before a row for it is ever created; this branch should never fire
    // on well-formed card data.
    if (ancestors.has(step)) {
      rows.push({ kind: 'node', key, id: step, node, depth, isRoot, links: [] });
      return;
    }
    const children = flow.steps[step] ?? [];
    const links: { id: string; node: SynergyNode }[] = [];
    const expand: SynergyFlowStep[] = [];
    for (const child of children) {
      const childNode = typeof child === 'string' ? nodes[child] : undefined;
      if (typeof child === 'string' && childNode && linkableIds.has(child)) links.push({ id: child, node: childNode });
      else expand.push(child);
    }
    rows.push({ kind: 'node', key, id: step, node, depth, isRoot, links });
    // Nothing left in `expand` is ever a root-owned id or a self-arrival —
    // both are filtered into `links` above — so every remaining child is a
    // genuine, always-fully-expanded nested fact (Namazu's `surveil`-style
    // repeats included).
    expand.forEach((child, i) => walkFlowStep(child, depth + 1, false, `${key}.${i}:`, nodes, flow, rows, linkableIds, nextAncestors));
  } else {
    const key = `${keyPrefix}group`;
    rows.push({ kind: 'group', key, combine: step.combine, depth, isRoot });
    step.of.forEach((id, i) => walkFlowStep(id, depth + 1, false, `${key}.${i}:`, nodes, flow, rows, linkableIds, ancestors));
  }
}

const outlineRows = computed<OutlineRow[]>(() => {
  const nodes = data.value?.synergyNodes;
  const flow = data.value?.synergyFlow;
  if (!nodes || !flow) return [];
  const rows: OutlineRow[] = [];
  const rootIds = new Set(flow.roots.filter((r): r is string => typeof r === 'string'));
  // A self-arrival id that isn't a true root (e.g. a returning-transformed
  // re-arrival, caused by exile-then-return) still needs its own full
  // top-level walk somewhere — every reference to it elsewhere collapses to
  // a link (see `linkableIds`/walkFlowStep), so without this second pass
  // its whole subtree would never render at all.
  const selfArrivalIds = Object.entries(nodes)
    .filter(([id, n]) => !rootIds.has(id) && n.role === 'enters' && n.thing.startsWith('self'))
    .map(([id]) => id);
  const linkableIds = new Set([...rootIds, ...selfArrivalIds]);
  flow.roots.forEach((root, i) => walkFlowStep(root, 0, true, `root${i}:`, nodes, flow, rows, linkableIds, new Set()));
  selfArrivalIds.forEach((id, i) => walkFlowStep(id, 0, true, `self-arrival${i}:`, nodes, flow, rows, linkableIds, new Set()));
  return rows;
});

// Node ids that show up in the Interactions panel below — i.e. this card's
// own row actually participates in a cross-card (or self) match, not just
// sitting in the outline unused. Only `nodeOwner === card.name` counts:
// the "affected by another card's rule" groups carry no id of THIS card's
// own (see synergyInteractions.ts's own header — bearing a rule isn't a
// node), so those never light anything up here, correctly.
const interactingNodeIds = computed<Set<string>>(() => {
  const ids = new Set<string>();
  for (const group of data.value?.interactions ?? []) {
    if (group.nodeOwner === card.value?.name) ids.add(group.nodeId);
  }
  return ids;
});

// Indentation guide for the role/label cell: roots get a plain marker, a
// child gets a └─ prefix repeated at its own depth so nesting reads at a
// glance without a second indentation mechanism (padding alone loses the
// "this branches off that" relationship a tree diagram needs).
function outlinePrefix(row: OutlineRow): string {
  if (row.isRoot) return '▸ ';
  return `${'   '.repeat(row.depth - 1)}└─ `;
}
function groupLabel(row: OutlineGroupRow): string {
  return row.combine === 'any' ? '◇ any of:' : `◇ choose ${row.combine} of:`;
}

useHead(() => ({ title: card.value ? card.value.name : 'Card' }));

// Left/right arrow keys walk the set the same way the Previous/Next links
// do — this page has no text inputs, so no need to guard against typing.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' && prevNumber.value != null) navigateTo(`/app/card/${route.params.set}/${prevNumber.value}`);
  else if (e.key === 'ArrowRight' && nextNumber.value != null) navigateTo(`/app/card/${route.params.set}/${nextNumber.value}`);
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div v-if="pending" class="flex flex-1 items-center justify-center">
      <div
        class="size-8 animate-spin rounded-full border-[3px] border-border border-t-produce"
        aria-hidden="true"
      ></div>
    </div>
    <div v-else-if="error || !card" class="text-muted">Card not found.</div>
    <template v-else>
      <div class="mb-4 flex items-center justify-between gap-4">
        <NuxtLink to="/app" class="inline-block text-sm text-muted hover:text-text">&larr; Back to graph</NuxtLink>
        <div class="flex items-center gap-3 text-sm">
          <NuxtLink v-if="prevNumber != null" :to="`/app/card/${route.params.set}/${prevNumber}`" class="text-muted hover:text-text">
            &larr; Previous
          </NuxtLink>
          <span v-else class="text-muted/40">&larr; Previous</span>
          <span class="text-muted">#{{ currentNumber }}</span>
          <NuxtLink v-if="nextNumber != null" :to="`/app/card/${route.params.set}/${nextNumber}`" class="text-muted hover:text-text">
            Next &rarr;
          </NuxtLink>
        </div>
      </div>
      <h1 class="mb-3 text-lg font-semibold">{{ card.name }}</h1>
      <CardMedia :images="card.images" :tokens="card.tokens" />
      <!-- Two comparison columns, wrapping to stacked below ~640px each so
           the page never scrolls horizontally on a narrow viewport (the
           outline tables inside still scroll their own overflow). Only
           rendered once there's at least one model's data for this card —
           most FIN cards have neither yet. -->
      <div v-if="outlineRows.length || data?.forgeScript" class="mt-3 flex flex-wrap items-start gap-6">
        <div v-if="outlineRows.length" class="min-w-[320px] flex-1 basis-[420px]">
          <div class="mb-1 text-[10px] font-semibold tracking-wide text-muted uppercase">Synergy model</div>
          <div
            class="overflow-x-auto border-l-2 pl-2.5"
            :class="data?.synergyReview === 'human' ? 'border-transparent' : 'border-orange-500'"
            :title="data?.synergyReview === 'human' ? undefined : 'Synergy nodes not yet human-reviewed'"
          >
            <table class="border-collapse font-mono text-xs whitespace-nowrap">
              <thead>
                <tr class="text-[10px] tracking-wide text-muted/70 uppercase">
                  <th class="pr-2 pb-1 text-left font-normal">id</th>
                  <th class="pr-3 pb-1 text-left font-normal">role</th>
                  <th class="pr-3 pb-1 text-left font-normal">owner</th>
                  <th class="pr-3 pb-1 text-left font-normal">from</th>
                  <th class="pr-3 pb-1 text-left font-normal">to</th>
                  <th class="pr-3 pb-1 text-left font-normal">thing</th>
                  <th class="pb-1 text-left font-normal">flags</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in outlineRows" :key="row.key" class="align-top">
                  <template v-if="row.kind === 'group'">
                    <td colspan="7" class="pt-1 pb-0.5 text-muted italic">
                      <span class="whitespace-pre text-muted/50">{{ outlinePrefix(row) }}</span>{{ groupLabel(row) }}
                    </td>
                  </template>
                  <template v-else>
                    <td
                      class="pr-2"
                      :class="interactingNodeIds.has(row.id) ? 'font-bold text-text' : 'text-muted/60'"
                      :title="interactingNodeIds.has(row.id) ? 'Appears in the Interactions panel below' : undefined"
                      >{{ row.id }}</td
                    >
                    <td class="pr-3">
                      <span class="whitespace-pre text-muted/50">{{ outlinePrefix(row) }}</span
                      ><span :style="{ color: synergyRoleColor(row.node.role) }">{{ synergyRoleLabel(row.node) }}</span
                      ><span
                        v-if="row.node.to === 'stack'"
                        class="ml-1 cursor-help"
                        title="Put on the stack — can be responded to before it resolves (e.g. countered/Stifled)."
                        >⚡</span
                      ><template v-for="link in row.links" :key="link.id"
                        ><span
                          class="ml-1 cursor-help text-muted/60"
                          :title="`Resolves into its own root entry (${link.node.role}) below, rather than a nested copy.`"
                          >↓</span
                        ></template
                      >
                    </td>
                    <td class="pr-3 text-muted">{{ row.node.owner }}</td>
                    <td class="pr-3 text-muted">{{ row.node.from }}</td>
                    <td class="pr-3 text-muted">{{ row.node.to }}</td>
                    <td class="pr-3">{{ row.node.thing }}</td>
                    <td class="text-muted"
                      ><template v-for="(seg, si) in parseManaSegments(row.node.flags ?? '')" :key="si"
                        ><ManaSymbol v-if="'mana' in seg" :code="seg.mana" /><template v-else>{{ seg.text }}</template></template
                      ></td
                    >
                  </template>
                </tr>
              </tbody>
            </table>
          </div>
          <details class="mt-2 text-[11px]">
            <summary class="cursor-pointer text-muted hover:text-text">Raw JSON</summary>
            <pre class="mt-1 max-h-96 overflow-auto rounded border border-border bg-panel p-2 font-mono text-[10px] text-text/80">{{
              synergyJson
            }}</pre>
          </details>
          <div v-if="data?.synergyExam" class="mt-4 max-w-prose rounded-md border border-border bg-panel p-3 text-xs">
            <div class="mb-2 flex items-center gap-2 text-[11px] tracking-wide text-muted uppercase">
              Round-trip reconstruction
              <span
                class="rounded px-1.5 py-px text-[10px] font-bold normal-case"
                :class="data.synergyExam.verdict === 'match' ? 'bg-produce/20 text-produce' : 'bg-[#c0392b]/20 text-[#e07a6e]'"
              >
                {{ data.synergyExam.verdict === 'match' ? 'Match' : 'Issues found' }}
              </span>
            </div>

            <!-- Everything the isolated examiner agent itself produced — kept
                 visually separate from this session's judgement below it, so
                 it's never unclear which is the raw answer and which is the
                 assessment of it. -->
            <div class="mb-2 rounded border border-border/60 bg-bg p-2">
              <div class="mb-1 text-[10px] tracking-wide text-muted/60 uppercase">Examiner's proposal</div>
              <p v-if="data.synergyExam.manaCost || data.synergyExam.typeLine" class="mb-1.5 leading-relaxed text-text"
                ><template v-if="data.synergyExam.manaCost"
                  ><template v-for="(seg, si) in parseManaSegments(data.synergyExam.manaCost)" :key="si"
                    ><ManaSymbol v-if="'mana' in seg" :code="seg.mana" /><template v-else>{{ seg.text }}</template></template
                  ></template
                ><span v-if="data.synergyExam.manaCost && data.synergyExam.typeLine"> &middot; </span
                ><span v-if="data.synergyExam.typeLine">{{ data.synergyExam.typeLine }}</span></p
              >
              <p class="mb-1.5 leading-relaxed whitespace-pre-line text-text"
                ><template v-for="(seg, si) in parseManaSegments(data.synergyExam.description)" :key="si"
                  ><ManaSymbol v-if="'mana' in seg" :code="seg.mana" /><template v-else>{{ seg.text }}</template></template
                ></p
              >
              <div v-if="data.synergyExam.assumptions.length" class="mb-1.5">
                <div class="text-[10px] tracking-wide text-muted/60 uppercase">Assumptions</div>
                <ul class="list-disc pl-4 text-text/80">
                  <li v-for="(a, ai) in data.synergyExam.assumptions" :key="ai">{{ a }}</li>
                </ul>
              </div>
              <div v-if="data.synergyExam.couldNotDerive.length">
                <div class="text-[10px] tracking-wide text-muted/60 uppercase">Could not derive</div>
                <ul class="list-disc pl-4 text-text/80">
                  <li v-for="(c, ci) in data.synergyExam.couldNotDerive" :key="ci">{{ c }}</li>
                </ul>
              </div>
            </div>

            <!-- This session's own assessment — never the examiner's words. -->
            <div class="text-[10px] tracking-wide text-muted/60 uppercase">Judgement</div>
            <p class="leading-relaxed whitespace-pre-line text-text/80 italic">{{ data.synergyExam.notes }}</p>
          </div>
        </div>

        <div v-if="data?.forgeScript" class="min-w-[320px] flex-1 basis-[420px]">
          <div class="mb-1 text-[10px] font-semibold tracking-wide text-muted uppercase">Forge model</div>
          <ForgeCardScript :raw="data.forgeScript" />
          <details class="mt-2 text-[11px]">
            <summary class="cursor-pointer text-muted hover:text-text">Raw Forge script</summary>
            <pre class="mt-1 max-h-96 overflow-auto rounded border border-border bg-panel p-2 font-mono text-[10px] text-text/80">{{
              data.forgeScript
            }}</pre>
          </details>
        </div>
      </div>
      <!-- app/lib/synergyInteractions.ts's cross-card join, grouped by this
           card's own node (or, for a rule this card only bears, the rule
           owner's node — see groupInteractionsForCard) — one row per
           mechanism, with every matching pool card and a count, rather than
           one row per pair. Computed server-side from real synergy nodes
           (hand-authored or Forge-translated, see the two columns above),
           not pre-baked; only wired for the small worked-example pool in
           server/api/card/[set]/[number].ts (no full-corpus join yet). -->
      <div v-if="data?.interactions?.length" class="mt-4 w-full max-w-full">
        <div class="mb-1 text-[10px] font-semibold tracking-wide text-muted uppercase">Interactions</div>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="group in data.interactions"
            :key="`${group.kind}:${group.nodeOwner}:${group.nodeId}`"
            class="rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs text-text"
          >
            <details>
              <summary class="flex cursor-pointer items-center gap-1.5">
                <span
                  class="rounded px-1.5 py-px text-[10px] font-bold uppercase"
                  :class="group.kind === 'resource' ? 'bg-produce/20 text-produce' : 'bg-[#9dcacf]/20 text-[#6fa8ae]'"
                  >{{ group.kind }}</span
                ><span
                  class="rounded px-1.5 py-px text-[10px] font-bold"
                  :class="group.direction === 'provides' ? 'bg-produce/20 text-produce' : 'bg-consume/20 text-consume'"
                  :title="group.direction === 'provides' ? 'This card is the source — other cards benefit from it' : 'This card is the beneficiary — other cards are the source'"
                  >{{ group.direction === 'provides' ? '→ provides' : '← benefits' }}</span
                >{{ group.description }}<span class="font-mono text-[10px] text-muted">({{ group.nodeId }})</span
                ><span class="ml-auto shrink-0 rounded-full bg-bg px-2 py-px text-[10px] font-bold text-muted"
                  >{{ group.matches.length }} card{{ group.matches.length === 1 ? '' : 's' }}</span
                >
              </summary>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <NuxtLink
                  v-for="m in group.matches"
                  :key="m.name"
                  :to="m.set && m.collectorNumber ? `/app/card/${m.set}/${m.collectorNumber}` : undefined"
                  class="block shrink-0"
                  :class="{ 'pointer-events-none': !(m.set && m.collectorNumber) }"
                >
                  <img v-if="m.image" :src="m.image" :alt="m.name" class="block w-[220px] min-w-0 rounded-md" />
                  <span v-else class="flex h-[307px] w-[220px] items-center justify-center rounded-md bg-bg text-center text-xs text-muted">{{
                    m.name
                  }}</span>
                </NuxtLink>
              </div>
            </details>
          </li>
        </ul>
      </div>
      <a :href="card.scryfallUri" target="_blank" rel="noopener" class="mt-3 inline-block text-xs text-muted hover:text-text">
        View on Scryfall &rarr;
      </a>
    </template>
  </div>
</template>
