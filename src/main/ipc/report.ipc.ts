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
