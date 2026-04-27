/**
 * 版本管理 IPC 处理器
 * 注册版本相关的 IPC 通道，调用 EditionService 处理业务逻辑
 */

import { ipcMain } from 'electron';
import { EDITION_CHANNELS } from '../../shared/ipc-channels';
import { EditionService } from '../services/edition.service';
import type {
  CreateEditionInput,
  UpdateEditionInput,
} from '../../shared/types';

const editionService = new EditionService();

export function registerEditionIpcHandlers(): void {
  ipcMain.handle(EDITION_CHANNELS.CREATE, (_event, data: CreateEditionInput) => {
    try {
      return editionService.create(data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(EDITION_CHANNELS.UPDATE, (_event, id: string, data: UpdateEditionInput) => {
    try {
      return editionService.update(id, data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(EDITION_CHANNELS.DELETE, (_event, id: string) => {
    try {
      editionService.delete(id);
      return { success: true };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
