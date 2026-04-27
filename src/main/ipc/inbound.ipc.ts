/**
 * 入库管理 IPC 处理器
 * 注册入库相关的 IPC 通道，调用 InboundService 处理业务逻辑
 */

import { ipcMain } from 'electron';
import { INBOUND_CHANNELS } from '../../shared/ipc-channels';
import { InboundService } from '../services/inbound.service';
import type {
  CreateInboundInput,
  UpdateInboundInput,
  InboundFilter,
} from '../../shared/types';

const inboundService = new InboundService();

export function registerInboundIpcHandlers(): void {
  ipcMain.handle(INBOUND_CHANNELS.CREATE, (_event, data: CreateInboundInput) => {
    try {
      return inboundService.create(data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(INBOUND_CHANNELS.UPDATE, (_event, id: string, data: UpdateInboundInput) => {
    try {
      return inboundService.update(id, data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(INBOUND_CHANNELS.DELETE, (_event, id: string) => {
    try {
      return inboundService.delete(id);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(INBOUND_CHANNELS.LIST, (_event, filter?: InboundFilter) => {
    try {
      return inboundService.list(filter);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(INBOUND_CHANNELS.BATCH_CREATE, (_event, data: CreateInboundInput[]) => {
    try {
      return inboundService.batchCreate(data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
