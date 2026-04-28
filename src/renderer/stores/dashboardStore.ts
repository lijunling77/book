import { create } from 'zustand';
import type { DashboardData } from '../../shared/types';
import { dashboardApi } from '../utils/ipc';

interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}

const initialData: DashboardData = {
  totalStockQuantity: 0,
  todayInboundQuantity: 0,
  todayInboundAmount: 0,
  todayOutboundQuantity: 0,
  todayOutboundAmount: 0,
  monthlyProfit: 0,
};

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: null,

  fetchData: async () => {
    set({ loading: true, error: null });
    try {
      const data = await dashboardApi.getData();
      set({ data, loading: false });
    } catch (err) {
      set({
        data: initialData,
        loading: false,
        error: err instanceof Error ? err.message : '获取仪表盘数据失败',
      });
    }
  },
}));
