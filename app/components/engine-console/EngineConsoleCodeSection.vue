<script setup lang="ts">
// Shared expand-to-read-real-code disclosure for the Features/Predicates
// detail panes — a reviewer needs to actually read the cited test/predicate
// code before confirming/rejecting a baseline (see
// `.claude/contracts/engine-status-schema.md`'s "A reviewer should read the
// actual test content... before confirming `blue`, not trust the color
// alone"), not just the hand-authored prose already shown above this.
//
// Two callers, two loading shapes, same component:
// - Predicates (`/app/engine/predicates`): `result` is already-fetched
//   (`GET /api/sink-derivations` inlines all 3 files per entry) — pass it
//   straight through, no `loading`/`@expand` needed.
// - Features (`/app/engine/features`): `evidence.testFileRefs` only carries
//   a path, not content — the caller passes `loading`/`result` from its own
//   per-path fetch cache and listens for `@expand` to trigger a
//   `GET /api/engine-status/source?path=...` fetch on first open only
//   (never eagerly — `engine.test.ts` alone is ~115KB and cited by 5
//   entries).
//
// Renders via the two existing hljs-based viewers this app already ships
// (`FunctionalModelScript.vue` for `.ts`, `JsonHighlight.vue` for `.json`)
// rather than adding a new syntax-highlighting dependency — both already
// exist for the card page's own script-tab rendering.
import { ref } from 'vue';

export interface EngineConsoleCodeResult {
  path: string;
  exists: boolean;
  content: string | null;
  truncated: boolean;
}

const props = withDefaults(
  defineProps<{
    title: string;
    language?: 'ts' | 'json';
    loading?: boolean;
    result?: EngineConsoleCodeResult | null;
    notFoundLabel?: string;
    defaultOpen?: boolean;
  }>(),
  {
    language: 'ts',
    loading: false,
    result: null,
    notFoundLabel: 'Not found on disk.',
    defaultOpen: false,
  },
);

const emit = defineEmits<{ expand: [] }>();

const open = ref(props.defaultOpen);
let expandedOnce = props.defaultOpen;

function toggle() {
  open.value = !open.value;
  if (open.value && !expandedOnce) {
    expandedOnce = true;
    emit('expand');
  }
}
</script>

<template>
  <div class="rounded border border-border-subtle bg-surface/40">
    <button
      type="button"
      class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-surface/70"
      @click="toggle"
    >
      <UIcon :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-3 w-3 shrink-0 text-muted" />
      <span class="min-w-0 flex-1 truncate font-mono text-text">{{ title }}</span>
      <span
        v-if="result && !result.exists"
        class="shrink-0 rounded bg-consume/15 px-1.5 py-0.5 text-[10px] text-consume"
      >
        {{ notFoundLabel }}
      </span>
    </button>

    <div v-if="open" class="border-t border-border-subtle p-1.5">
      <p v-if="loading" class="p-2 text-[11px] text-muted italic">Loading…</p>
      <template v-else-if="result">
        <p v-if="!result.exists" class="p-2 text-[11px] text-muted italic">{{ notFoundLabel }}</p>
        <template v-else>
          <p v-if="result.truncated" class="mb-1 px-1 text-[10px] text-magnifier italic">
            Truncated — file is larger than the inline preview limit.
          </p>
          <JsonHighlight v-if="language === 'json'" :json="result.content ?? ''" />
          <FunctionalModelScript v-else :code="result.content ?? ''" />
        </template>
      </template>
      <p v-else class="p-2 text-[11px] text-muted italic">No content loaded.</p>
    </div>
  </div>
</template>
