/**
 * 位置管理 IPC 处理器
 * 注册位置相关的 IPC 通道，调用 LocationService 处理业务逻辑
 */

import { ipcMain } from 'electron';
import { LOCATION_CHANNELS } from '../../shared/ipc-channels';
import { LocationService } from '../services/location.service';
import type {
  CreateLocationInput,
  UpdateLocationInput,
} from '../../shared/types';

const locationService = new LocationService();

export function registerLocationIpcHandlers(): void {
  ipcMain.handle(LOCATION_CHANNELS.CREATE, (_event, data: CreateLocationInput) => {
    try {
      return locationService.create(data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(LOCATION_CHANNELS.UPDATE, (_event, id: string, data: UpdateLocationInput) => {
    try {
      return locationService.update(id, data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(LOCATION_CHANNELS.DELETE, (_event, id: string) => {
    try {
      locationService.delete(id);
      return { success: true };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(LOCATION_CHANNELS.LIST, () => {
    try {
      return locationService.list();
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(LOCATION_CHANNELS.GET_STOCK, (_event, id: string) => {
    try {
      return locationService.getStock(id);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
