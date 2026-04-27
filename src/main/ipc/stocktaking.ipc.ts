/**
 * 盘点管理 IPC 处理器
 * 注册盘点相关的 IPC 通道，调用 StocktakingService 处理业务逻辑
 */

import { ipcMain } from 'electron';
import { STOCKTAKING_CHANNELS } from '../../shared/ipc-channels';
import { StocktakingService } from '../services/stocktaking.service';
import type {
  CreateStocktakingInput,
  ActualQuantityInput,
} from '../../shared/types';

const stocktakingService = new StocktakingService();

export function registerStocktakingIpcHandlers(): void {
  ipcMain.handle(STOCKTAKING_CHANNELS.CREATE, (_event, data: CreateStocktakingInput) => {
    try {
      return stocktakingService.create(data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(STOCKTAKING_CHANNELS.LIST, () => {
    try {
      return stocktakingService.list();
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(STOCKTAKING_CHANNELS.GET_DETAIL, (_event, id: string) => {
    try {
      return stocktakingService.getDetail(id);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(STOCKTAKING_CHANNELS.RECORD_ACTUAL, (_event, taskId: string, items: ActualQuantityInput[]) => {
    try {
      stocktakingService.recordActual(taskId, items);
      return { success: true };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(STOCKTAKING_CHANNELS.SUBMIT, (_event, taskId: string) => {
    try {
      return stocktakingService.submit(taskId);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(STOCKTAKING_CHANNELS.CONFIRM, (_event, taskId: string) => {
    try {
      stocktakingService.confirm(taskId);
      return { success: true };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
