/**
 * 库存 IPC 处理器
 */

import { ipcMain } from 'electron';
import { STOCK_CHANNELS } from '../../shared/ipc-channels';
import { StockService } from '../services/stock.service';
import type { StockFilter } from '../../shared/types';

const stockService = new StockService();

export function registerStockIpcHandlers(): void {
  ipcMain.handle(STOCK_CHANNELS.LIST, (_event, filter?: StockFilter) => {
    try {
      return stockService.list(filter);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(STOCK_CHANNELS.SUMMARY, (_event, filter?: StockFilter) => {
    try {
      return stockService.summary(filter);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
