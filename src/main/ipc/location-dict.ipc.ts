/**
 * 位置字典 IPC 处理器
 */

import { ipcMain } from 'electron';
import { LOCATION_DICT_CHANNELS } from '../../shared/ipc-channels';
import { LocationDictService } from '../services/location-dict.service';

const locationDictService = new LocationDictService();

export function registerLocationDictIpcHandlers(): void {
  ipcMain.handle(LOCATION_DICT_CHANNELS.LIST, () => {
    try {
      return locationDictService.list();
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(LOCATION_DICT_CHANNELS.CREATE, (_event, name: string) => {
    try {
      return locationDictService.create(name);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(LOCATION_DICT_CHANNELS.DELETE, (_event, id: string) => {
    try {
      locationDictService.delete(id);
      return { success: true };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
