/**
 * 操作日志 IPC 处理器
 * 注册日志查询的 IPC 通道，调用 LogService 处理业务逻辑
 */

import { ipcMain } from 'electron';
import { LOG_CHANNELS } from '../../shared/ipc-channels';
import { LogService } from '../services/log.service';
import type { LogFilter } from '../../shared/types';

const logService = new LogService();

export function registerLogIpcHandlers(): void {
  ipcMain.handle(LOG_CHANNELS.LIST, (_event, filter?: LogFilter) => {
    try {
      return logService.list(filter);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
