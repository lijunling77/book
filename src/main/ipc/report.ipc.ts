/**
 * 综合报表 IPC 处理器
 * 注册综合报表数据获取的 IPC 通道，调用 ReportService 处理业务逻辑
 */

import { ipcMain } from 'electron';
import { REPORT_CHANNELS } from '../../shared/ipc-channels';
import { ReportService } from '../services/report.service';
import type { DateRange } from '../../shared/types';

const reportService = new ReportService();

export function registerReportIpcHandlers(): void {
  ipcMain.handle(REPORT_CHANNELS.GET_DATA, (_event, dateRange?: DateRange) => {
    try {
      return reportService.getFullReport(dateRange);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
