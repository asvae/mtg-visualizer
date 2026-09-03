<script setup lang="ts">
import { computed } from 'vue';
import { parseForgeScript, forgeManaCostToBraced } from '../lib/forgeScript';
import { parseManaSegments } from '../lib/manaSegments';
import type { ForgeLineType, ForgeRow } from '../types';

const props = defineProps<{ raw: string }>();

const card = computed(() => parseForgeScript(props.raw));

// Same hue family the card page's synergy outline uses for `trigger`/`enters`
// — T:/K: land close to those roles conceptually — but Forge's own line
// types (A:/S:/R:) get their own tints rather than being forced to match a
// synergy role they aren't. A chained SVar effect (no lineType of its own,
// just a DB$/AB$ continuation) falls through to the default text color.
const FORGE_LINE_COLORS: Partial<Record<ForgeLineType, string>> = {
  T: '#9dcacf',
  K: '#9ecfa0',
  S: '#cfa9d8',
  A: '#d8ab88',
  R: '#e0908a',
};
function lineColor(row: ForgeRow): string | undefined {
  return row.lineType ? FORGE_LINE_COLORS[row.lineType] : undefined;
}
function outlinePrefix(row: ForgeRow): string {
  if (row.isRoot) return '▸ ';
  return `${'   '.repeat(Math.max(0, row.depth - 1))}└─ `;
}
</script>

<template>
  <div v-for="(face, fi) in card.faces" :key="fi" :class="{ 'mt-3 border-t border-border/60 pt-3': fi > 0 }">
    <p v-if="card.faces.length > 1" class="mb-1 text-xs font-semibold text-text">{{ face.name }}</p>
    <p v-if="face.manaCost || face.typeLine" class="mb-1.5 text-xs text-text">
      <template v-if="face.manaCost"
        ><template v-for="(seg, si) in parseManaSegments(forgeManaCostToBraced(face.manaCost))" :key="si"
          ><ManaSymbol v-if="'mana' in seg" :code="seg.mana" /><template v-else>{{ seg.text }}</template></template
        ></template
      ><span v-if="face.manaCost && face.typeLine"> &middot; </span
      ><span v-if="face.typeLine">{{ face.typeLine }}</span
      ><span v-if="face.pt"> &middot; {{ face.pt }}</span>
    </p>
    <div class="overflow-x-auto border-l-2 border-border pl-2.5">
      <table class="border-collapse font-mono text-xs whitespace-nowrap">
        <thead>
          <tr class="text-[10px] tracking-wide text-muted/70 uppercase">
            <th class="pr-3 pb-1 text-left font-normal">ability</th>
            <th class="pb-1 text-left font-normal">fields</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in face.rows" :key="row.key" class="align-top">
            <template v-if="row.kind === 'group'">
              <td colspan="2" class="pt-1 pb-0.5 text-muted italic">
                <span class="whitespace-pre text-muted/50">{{ outlinePrefix(row) }}</span>{{ row.groupLabel }}
              </td>
            </template>
            <template v-else>
              <td class="pr-3 align-top">
                <span class="whitespace-pre text-muted/50">{{ outlinePrefix(row) }}</span
                ><span :style="{ color: lineColor(row) }">{{ row.lineType === 'K' ? `K:${row.role}` : row.role }}</span>
                <p v-if="row.description" class="mt-0.5 max-w-xs text-wrap text-muted/80 italic">{{ row.description }}</p>
              </td>
              <td class="whitespace-pre-wrap text-muted">{{ row.fields }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="face.meta.length" class="mt-1 text-[10px] text-muted/50 italic">{{ face.meta.join('  ') }}</p>
  </div>
</template>
