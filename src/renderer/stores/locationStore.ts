import { create } from 'zustand';
import type { Location, StockUnitAtLocation } from '../../shared/types';
import { locationApi } from '../utils/ipc';

interface LocationState {
  locations: Location[];
  loading: boolean;
  error: string | null;
  locationStock: StockUnitAtLocation[];
  locationStockLoading: boolean;

  fetchLocations: () => Promise<void>;
  fetchLocationStock: (id: string) => Promise<void>;
}

export const useLocationStore = create<LocationState>((set) => ({
  locations: [],
  loading: false,
  error: null,
  locationStock: [],
  locationStockLoading: false,

  fetchLocations: async () => {
    set({ loading: true, error: null });
    try {
      const locations = await locationApi.list();
      set({ locations, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '获取位置列表失败' });
    }
  },

  fetchLocationStock: async (id: string) => {
    set({ locationStockLoading: true });
    try {
      const stock = await locationApi.getStock(id);
      set({ locationStock: stock, locationStockLoading: false });
    } catch (err) {
      set({
        locationStock: [],
        locationStockLoading: false,
        error: err instanceof Error ? err.message : '获取位置库存失败',
      });
    }
  },
}));
