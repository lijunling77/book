import { ipcMain, app, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { REPORT_CHANNELS } from '../../shared/ipc-channels';
import { ReportService } from '../services/report.service';
import type { DateRange, ExportFormat } from '../../shared/types';

const reportService = new ReportService();

export function registerReportIpcHandlers(): void {
  ipcMain.handle(REPORT_CHANNELS.GET_DATA, (_event, dateRange?: DateRange) => {
    try {
      return reportService.getFullReport(dateRange);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(REPORT_CHANNELS.EXPORT, async (_event, dateRange?: DateRange, format?: ExportFormat) => {
    try {
      const data = reportService.getFullReport(dateRange);
      if (data.length === 0) {
        throw new Error('当前无数据可导出');
      }

      // 转换为中文列名
      const rows = data.map((r) => ({
        '书名': r.bookTitle,
        '作者': r.author ?? '-',
        '存放位置': r.locations ?? '-',
        '库存数量': r.totalQuantity,
        '入库总量': r.inboundTotalQuantity,
        '入库总金额': r.inboundTotalAmount,
        '出库总量': r.outboundTotalQuantity,
        '出库总金额': r.outboundTotalAmount,
        '最近买入价': r.latestPurchasePrice ?? '-',
        '最近售出价': r.latestSellingPrice ?? '-',
        '平均买入价': r.averagePurchasePrice ?? '-',
        '平均售出价': r.averageSellingPrice ?? '-',
        '总采购成本': r.totalPurchaseCost,
        '总销售收入': r.totalSalesRevenue,
        '净利润': r.netProfit,
      }));

      const ext = format === 'csv' ? '.csv' : '.xlsx';
      const defaultName = `综合报表_${new Date().toISOString().slice(0, 10)}${ext}`;

      const result = await dialog.showSaveDialog({
        title: '导出综合报表',
        defaultPath: defaultName,
        filters: format === 'csv'
          ? [{ name: 'CSV', extensions: ['csv'] }]
          : [{ name: 'Excel', extensions: ['xlsx'] }],
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '综合报表');

      if (format === 'csv') {
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);
        fs.writeFileSync(result.filePath, csvContent, 'utf-8');
      } else {
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        fs.writeFileSync(result.filePath, buffer);
      }

      return { filePath: result.filePath };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
