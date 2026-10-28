import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useTableSort } from '../src/composables/useTableSort';

describe('Table sorting', () => {
  it('toggles numeric order, keeps ties stable and missing ratings last', () => {
    const rows = ref([{ id: 1, rating: null }, { id: 2, rating: 900 }, { id: 3, rating: 1200 }, { id: 4, rating: 900 }]);
    const sort = useTableSort(rows, { rating: r => r.rating }, 'rating');
    const ids = () => sort.sortedRows.value.map(r => r.id);
    expect(ids()).toEqual([2, 4, 3, 1]);
    sort.sortBy('rating');
    expect(ids()).toEqual([3, 2, 4, 1]);
    expect(rows.value.map(r => r.id)).toEqual([1, 2, 3, 4]);
    rows.value[0].rating = 1500;
    expect(ids()).toEqual([1, 3, 2, 4]);
  });
  it('sorts names naturally and uses secondary result columns', () => {
    const rows = [{ name: 'Игрок10', wins: 3, losses: 2 }, { name: 'Игрок2', wins: 3, losses: 1 }];
    const sort = useTableSort(rows, { name: r => r.name, results: r => [r.wins, r.losses] }, 'name');
    expect(sort.sortedRows.value[0].name).toBe('Игрок2');
    sort.sortBy('results', 'descending');
    expect(sort.sortedRows.value[0].name).toBe('Игрок10');
    sort.sortBy('results');
    expect(sort.sortedRows.value[0].name).toBe('Игрок2');
  });
});
