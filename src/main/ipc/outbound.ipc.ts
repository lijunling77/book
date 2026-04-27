/**
 * 出库管理 IPC 处理器
 * 注册出库相关的 IPC 通道，调用 OutboundService 处理业务逻辑
 */

import { ipcMain } from 'electron';
import { OUTBOUND_CHANNELS } from '../../shared/ipc-channels';
import { OutboundService } from '../services/outbound.service';
import type {
  CreateOutboundInput,
  UpdateOutboundInput,
  OutboundFilter,
} from '../../shared/types';

const outboundService = new OutboundService();

export function registerOutboundIpcHandlers(): void {
  ipcMain.handle(OUTBOUND_CHANNELS.CREATE, (_event, data: CreateOutboundInput) => {
    try {
      return outboundService.create(data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(OUTBOUND_CHANNELS.UPDATE, (_event, id: string, data: UpdateOutboundInput) => {
    try {
      return outboundService.update(id, data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(OUTBOUND_CHANNELS.DELETE, (_event, id: string) => {
    try {
      return outboundService.delete(id);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(OUTBOUND_CHANNELS.LIST, (_event, filter?: OutboundFilter) => {
    try {
      return outboundService.list(filter);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(OUTBOUND_CHANNELS.BATCH_CREATE, (_event, data: CreateOutboundInput[]) => {
    try {
      return outboundService.batchCreate(data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
