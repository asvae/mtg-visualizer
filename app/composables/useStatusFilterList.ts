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
  /** When given, this tab's `activeFilters` toggle selection persists to
   * `localStorage` under this exact key and is restored on next visit —
   * per-page/per-tab (each of the four `/app/engine/*` callers uses its own
   * distinct key), same "per-viewer convenience, not shared/critical state"
   * convention `/app/engine/cards`' (route renamed from `/app/engine/sets`,
   * 2026-09-18, later same day) own last-picked-set persistence already
   * establishes (see that page's own header). Deliberately does NOT cover
   * `searchQuery` — search always starts empty on load; only which
   * status-color toggles are on/off persists. Read synchronously at setup
   * time (no SSR guard beyond a bare `typeof localStorage` check) since
   * every caller lives under `/app`, which is SPA-only. A stored value
   * naming an unknown `C` (e.g. after a `statusOptions` axis changes) is
   * dropped rather than kept, falling back to "everything on." */
  storageKey?: string;
}

function loadStoredFilters<C extends string>(storageKey: string | undefined, options: StatusFilterOption<C>[]): Set<C> {
  const all = new Set(options.map((o) => o.value));
  if (!storageKey || typeof localStorage === 'undefined') return all;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return all;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return all;
    const valid = parsed.filter((v): v is C => all.has(v));
    return valid.length ? new Set(valid) : all;
  } catch {
    return all;
  }
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
  const activeFilters = shallowRef<Set<C>>(loadStoredFilters(opts.storageKey, opts.statusOptions));

  const sorted = computed(() => {
    const arr = [...opts.items.value];
    return opts.sortBy ? arr.sort(opts.sortBy) : arr;
  });

  const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());
  // Search-filtered but NOT yet status-filtered — this is what `visible`
  // further narrows by `activeFilters`. `countsByStatus` (below) does NOT
  // read this — it counts against the unfiltered `sorted` instead.
  const searched = computed(() => {
    const q = normalizedQuery.value;
    return q ? sorted.value.filter((it) => opts.matchesQuery(it, q)) : sorted.value;
  });

  // Counts against the FULL dataset (`sorted`, not `searched`/`visible`) —
  // deliberately independent of both the current search text AND which
  // OTHER status filters are toggled on/off. A chip's own count answers
  // "how many entries have this status, full stop" (standard faceted-
  // filter-count UX: "how many would I see if I selected this status"), not
  // "how many currently match everything else too." The "N of M" line
  // elsewhere on the page (`visible.value.length` / total) is the one that
  // SHOULD keep moving with search+filters — this is a different number.
  const countsByStatus = computed(() => {
    const counts = new Map<C, number>();
    for (const opt of opts.statusOptions) counts.set(opt.value, 0);
    for (const it of sorted.value) {
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
    if (opts.storageKey && typeof localStorage !== 'undefined') {
      localStorage.setItem(opts.storageKey, JSON.stringify([...next]));
    }
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
