/**
 * 库存与预警 IPC 处理器
 * 注册库存查询和预警相关的 IPC 通道
 * 调用 StockService 和 AlertService 处理业务逻辑
 */

import { ipcMain } from 'electron';
import { STOCK_CHANNELS } from '../../shared/ipc-channels';
import { StockService } from '../services/stock.service';
import { AlertService } from '../services/alert.service';
import type { StockFilter } from '../../shared/types';

const stockService = new StockService();
const alertService = new AlertService(stockService);

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

  ipcMain.handle(STOCK_CHANNELS.SET_ALERT, (_event, editionId: string, threshold: number | null) => {
    try {
      alertService.setThreshold(editionId, threshold);
      return { success: true };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(STOCK_CHANNELS.ALERT_LIST, () => {
    try {
      return alertService.getAlertList();
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
