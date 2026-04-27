/**
 * 数据导出 IPC 处理器
 * 注册导出相关的 IPC 通道，调用 ExportService 处理业务逻辑
 * 导出结果为文件 Buffer，通过 IPC 返回给渲染进程
 */

import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
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

/**
 * 将导出 Buffer 写入临时文件并返回文件路径
 */
function saveExportBuffer(buffer: Buffer, format: ExportFormat, prefix: string): string {
  const ext = format === 'csv' ? '.csv' : '.xlsx';
  const fileName = `${prefix}_${uuidv4()}${ext}`;
  const exportDir = path.join(app.getPath('temp'), 'book-management-exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  const filePath = path.join(exportDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function registerExportIpcHandlers(): void {
  ipcMain.handle(EXPORT_CHANNELS.INBOUND, (_event, filter: InboundFilter | undefined, format: ExportFormat) => {
    try {
      const buffer = exportService.exportInbound(filter, format);
      return saveExportBuffer(buffer, format, 'inbound');
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(EXPORT_CHANNELS.OUTBOUND, (_event, filter: OutboundFilter | undefined, format: ExportFormat) => {
    try {
      const buffer = exportService.exportOutbound(filter, format);
      return saveExportBuffer(buffer, format, 'outbound');
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(EXPORT_CHANNELS.STOCK, (_event, filter: StockFilter | undefined, format: ExportFormat) => {
    try {
      const buffer = exportService.exportStock(filter, format);
      return saveExportBuffer(buffer, format, 'stock');
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(EXPORT_CHANNELS.PROFIT, (_event, filter: ProfitFilter | undefined, format: ExportFormat) => {
    try {
      const buffer = exportService.exportProfit(filter, format);
      return saveExportBuffer(buffer, format, 'profit');
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
