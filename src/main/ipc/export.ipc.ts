/**
 * 数据导出 IPC 处理器
 * 使用系统保存对话框，文件名为中文+日期格式
 */

import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import { EXPORT_CHANNELS } from '../../shared/ipc-channels';
import { ExportService } from '../services/export.service';
import type {
  InboundFilter,
  OutboundFilter,
  StockFilter,
  ProfitFilter,
  ExportFormat,
} from '../../shared/types';

const exportService = new ExportService();

function getDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function saveWithDialog(buffer: Buffer, format: ExportFormat, chineseName: string): Promise<{ filePath?: string; canceled?: boolean }> {
  const ext = format === 'csv' ? '.csv' : '.xlsx';
  const defaultName = `${chineseName}_${getDateStr()}${ext}`;

  const result = await dialog.showSaveDialog({
    title: `导出${chineseName}`,
    defaultPath: defaultName,
    filters: format === 'csv'
      ? [{ name: 'CSV', extensions: ['csv'] }]
      : [{ name: 'Excel', extensions: ['xlsx'] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  fs.writeFileSync(result.filePath, buffer);
  return { filePath: result.filePath };
}

export function registerExportIpcHandlers(): void {
  ipcMain.handle(EXPORT_CHANNELS.INBOUND, async (_event, filter: InboundFilter | undefined, format: ExportFormat) => {
    try {
      const buffer = exportService.exportInbound(filter, format);
      return await saveWithDialog(buffer, format, '入库记录');
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(EXPORT_CHANNELS.OUTBOUND, async (_event, filter: OutboundFilter | undefined, format: ExportFormat) => {
    try {
      const buffer = exportService.exportOutbound(filter, format);
      return await saveWithDialog(buffer, format, '出库记录');
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(EXPORT_CHANNELS.STOCK, async (_event, filter: StockFilter | undefined, format: ExportFormat) => {
    try {
      const buffer = exportService.exportStock(filter, format);
      return await saveWithDialog(buffer, format, '库存信息');
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(EXPORT_CHANNELS.PROFIT, async (_event, filter: ProfitFilter | undefined, format: ExportFormat) => {
    try {
      const buffer = exportService.exportProfit(filter, format);
      return await saveWithDialog(buffer, format, '利润统计');
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
