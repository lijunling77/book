/**
 * 仪表盘 IPC 处理器
 * 注册仪表盘数据获取的 IPC 通道，调用 DashboardService 处理业务逻辑
 */

import { ipcMain } from 'electron';
import { DASHBOARD_CHANNELS } from '../../shared/ipc-channels';
import { DashboardService } from '../services/dashboard.service';

const dashboardService = new DashboardService();

export function registerDashboardIpcHandlers(): void {
  ipcMain.handle(DASHBOARD_CHANNELS.GET_DATA, () => {
    try {
      return dashboardService.getData();
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
