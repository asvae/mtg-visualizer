// Shared sidebar list logic for the `/app/engine/*` console tabs
// (keywords/predicates/sets/features) — extracted 2026-09-17 while
// consolidating five previously-separate status/coverage pages
// (`/app/keywords`, `/app/sink-derivations`, `/app/engine-status`,
// `/app/status`, and formerly `/app/recognizers` — recognizers was pulled
// back out mid-task per an explicit correction, see EngineConsoleTabs.vue's
// own header) into one tabbed shell. Every one of those pages had
// independently reimplemented the SAME four things: a case-insensitive
// search box, a toggleable status-color filter set, a "visible of total"
// count, and a single-selection-with-prev/next-within-the-filtered-list
// pattern — this composable is that shared logic, generic over whatever
// `T` shape and `C` status-color union a given tab actually has (they all
// differ: keywords' 2-value covered/gap, the others' 5-value
// gray/purple/blue/yellow/green).
//
// Deliberately owns `selectedKey` as a plain internal ref (mode: this
// composable IS the source of truth for selection) rather than accepting
// an externally-owned ref — every one of the three flat-list tabs
// (predicates/features/sets) already worked this way pre-consolidation.
// The one tab that needs MORE than this (keywords' own per-entry URL
// deep-linking via `[[slug]].vue`) layers that on top from its own page
// code by watching this composable's returned `selectedKey` ref directly
// (a plain `Ref`, nothing hidden) rather than this composable trying to
// grow a second "externally driven" mode — see
// `app/pages/app/engine/keywords/[[slug]].vue`'s own header for that sync.
import { computed, ref, shallowRef, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

export interface StatusFilterOption<C extends string> {
  value: C;
  label: string;
  /** Any valid CSS `background` value — a literal hex (the 5-value
   * gray/purple/blue/yellow/green axis all three non-keyword tabs share) or
   * a `var(--color-*)` reference (keywords' own covered/gap axis, matching
   * that page's pre-existing produce/consume color language exactly). */
  color: string;
  description?: string;
}

export interface UseStatusFilterListOptions<T, C extends string> {
  items: ComputedRef<T[]> | Ref<T[]>;
  keyOf: (item: T) => string;
  statusOf: (item: T) => C;
  statusOptions: StatusFilterOption<C>[];
  /** Query is already trimmed + lowercased; never invoked for an empty
   * query (that case short-circuits to "everything matches"). */
  matchesQuery: (item: T, query: string) => boolean;
  sortBy?: (a: T, b: T) => number;
}

export function useStatusFilterList<T, C extends string>(opts: UseStatusFilterListOptions<T, C>) {
  const searchQuery = ref('');
  // `shallowRef`, not `ref` — Vue's deep `UnwrapRef<T>` traverses into a
  // `Set<C>`'s own generic argument too when `C` is a generic type
  // parameter (not a concrete union TS can resolve at this point), which
  // otherwise makes every `Set<C>` method here type-error against a
  // synthetic `Set<UnwrapRefSimple<C>>` instead of the real `Set<C>` —
  // `shallowRef` skips that traversal (a `Set` is always replaced whole via
  // `toggleFilter`'s own `new Set(...)`, never mutated in place, so no
  // reactivity is lost by not deep-unwrapping its contents).
  const activeFilters = shallowRef<Set<C>>(new Set(opts.statusOptions.map((o) => o.value)));

  const sorted = computed(() => {
    const arr = [...opts.items.value];
    return opts.sortBy ? arr.sort(opts.sortBy) : arr;
  });

  const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());
  // Search-filtered but NOT yet status-filtered — this is the base
  // `countsByStatus` counts against, so toggling one status filter never
  // changes another status's own displayed count.
  const searched = computed(() => {
    const q = normalizedQuery.value;
    return q ? sorted.value.filter((it) => opts.matchesQuery(it, q)) : sorted.value;
  });

  const countsByStatus = computed(() => {
    const counts = new Map<C, number>();
    for (const opt of opts.statusOptions) counts.set(opt.value, 0);
    for (const it of searched.value) {
      const s = opts.statusOf(it);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return counts;
  });

  function toggleFilter(c: C) {
    const next = new Set(activeFilters.value);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    activeFilters.value = next;
  }

  // Search AND status filters both applied — this is the "currently
  // filtered/searched list" prev/next navigates within, and what the
  // sidebar itself renders.
  const visible = computed(() => searched.value.filter((it) => activeFilters.value.has(opts.statusOf(it))));

  const selectedKey = ref<string | null>(null);
  watch(
    visible,
    (entries) => {
      if (!entries.length) {
        selectedKey.value = null;
        return;
      }
      if (!selectedKey.value || !entries.some((e) => opts.keyOf(e) === selectedKey.value)) {
        selectedKey.value = opts.keyOf(entries[0]!);
      }
    },
    { immediate: true },
  );

  const selectedIndex = computed(() => visible.value.findIndex((e) => opts.keyOf(e) === selectedKey.value));
  const selected = computed<T | null>(() => (selectedIndex.value >= 0 ? visible.value[selectedIndex.value]! : null));

  function select(item: T) {
    selectedKey.value = opts.keyOf(item);
  }
  const canPrev = computed(() => selectedIndex.value > 0);
  const canNext = computed(() => selectedIndex.value >= 0 && selectedIndex.value < visible.value.length - 1);
  function selectPrev() {
    if (canPrev.value) select(visible.value[selectedIndex.value - 1]!);
  }
  function selectNext() {
    if (canNext.value) select(visible.value[selectedIndex.value + 1]!);
  }

  const positionLabel = computed(() =>
    selectedIndex.value >= 0 ? `${selectedIndex.value + 1} of ${visible.value.length}` : '',
  );

  return {
    searchQuery,
    activeFilters,
    toggleFilter,
    countsByStatus,
    sorted,
    searched,
    visible,
    selectedKey,
    selected,
    selectedIndex,
    select,
    canPrev,
    canNext,
    selectPrev,
    selectNext,
    positionLabel,
  };
}
