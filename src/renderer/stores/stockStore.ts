import { create } from 'zustand';
import type { StockView, StockSummaryView, StockFilter } from '../../shared/types';
import { stockApi } from '../utils/ipc';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../../shared/constants';

interface StockState {
  stocks: StockView[];
  summaryStocks: StockSummaryView[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  viewMode: 'detail' | 'summary';
  filter: StockFilter;

  fetchStocks: (filter?: StockFilter) => Promise<void>;
  fetchSummary: (filter?: StockFilter) => Promise<void>;
  setViewMode: (mode: 'detail' | 'summary') => void;
  setFilter: (filter: Partial<StockFilter>) => void;
  setPage: (page: number, pageSize: number) => void;
  reset: () => void;
}

export const useStockStore = create<StockState>((set, get) => ({
  stocks: [],
  summaryStocks: [],
  total: 0,
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
  loading: false,
  error: null,
  viewMode: 'detail',
  filter: {},

  fetchStocks: async (filterOverride?: StockFilter) => {
    set({ loading: true, error: null });
    try {
      const { page, pageSize, filter } = get();
      const f: StockFilter = {
        ...filter,
        ...filterOverride,
        page: filterOverride?.page ?? page,
        pageSize: filterOverride?.pageSize ?? pageSize,
      };
      const result = await stockApi.list(f);
      set({
        stocks: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '获取库存列表失败' });
    }
  },

  fetchSummary: async (filterOverride?: StockFilter) => {
    set({ loading: true, error: null });
    try {
      const { filter } = get();
      const f: StockFilter = { ...filter, ...filterOverride };
      const result = await stockApi.summary(f);
      set({ summaryStocks: result, total: result.length, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '获取库存汇总失败' });
    }
  },

  setViewMode: (mode: 'detail' | 'summary') => {
    set({ viewMode: mode });
  },

  setFilter: (filterUpdate: Partial<StockFilter>) => {
    set((state) => ({ filter: { ...state.filter, ...filterUpdate } }));
  },

  setPage: (page: number, pageSize: number) => {
    set({ page, pageSize });
  },

  reset: () => {
    set({ filter: {}, page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE, viewMode: 'detail' });
  },
}));
