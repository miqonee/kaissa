import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue';

export type SortDirection = 'ascending' | 'descending';
type SortValue = string | number | boolean | null | undefined;

export function useTableSort<T>(
  rows: MaybeRefOrGetter<readonly T[]>,
  accessors: Record<string, (row: T, index: number) => SortValue | SortValue[]>,
  initialKey: string,
  initialDirection: SortDirection = 'ascending',
) {
  const key = ref(initialKey);
  const direction = ref<SortDirection>(initialDirection);
  const collator = new Intl.Collator(['ru', 'en'], { numeric: true, sensitivity: 'base' });
  function compare(a: SortValue, b: SortValue): number {
    // Missing ratings stay at the end in either direction.
    if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
    const result = typeof a === 'string' && typeof b === 'string'
      ? collator.compare(a, b) : Number(a) - Number(b);
    return direction.value === 'ascending' ? result : -result;
  }
  const sortedRows = computed(() => toValue(rows).map((row, index) => ({ row, index })).sort((a, b) => {
    const getter = accessors[key.value];
    if (!getter) return a.index - b.index;
    const av = [getter(a.row, a.index)].flat();
    const bv = [getter(b.row, b.index)].flat();
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
      const result = compare(av[i], bv[i]);
      if (result) return result;
    }
    return a.index - b.index;
  }).map(({ row }) => row));
  function sortBy(nextKey: string, firstDirection: SortDirection = 'ascending') {
    if (!Object.hasOwn(accessors, nextKey)) return;
    direction.value = key.value === nextKey
      ? (direction.value === 'ascending' ? 'descending' : 'ascending') : firstDirection;
    key.value = nextKey;
  }
  const sortDirection = (column: string) => key.value === column ? direction.value : undefined;
  return { sortedRows, sortBy, sortDirection, key, direction };
}
