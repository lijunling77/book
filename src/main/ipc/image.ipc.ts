/**
 * 图片管理 IPC 处理器
 * 注册图片上传、删除、获取相关的 IPC 通道，调用 ImageService 处理业务逻辑
 */

import { ipcMain, app } from 'electron';
import path from 'path';
import { IMAGE_CHANNELS } from '../../shared/ipc-channels';
import { ImageService } from '../services/image.service';
import type { ImageEntityType } from '../../shared/types';

function getImageService(): ImageService {
  const storageDir = path.join(app.getPath('userData'), 'images');
  return new ImageService(storageDir);
}

export function registerImageIpcHandlers(): void {
  ipcMain.handle(
    IMAGE_CHANNELS.UPLOAD,
    async (_event, entityType: ImageEntityType, entityId: string, imageData: Buffer, fileName: string) => {
      try {
        const imageService = getImageService();
        return await imageService.upload(entityType, entityId, imageData, fileName);
      } catch (error) {
        return { error: true, message: error instanceof Error ? error.message : '未知错误' };
      }
    },
  );

  ipcMain.handle(IMAGE_CHANNELS.DELETE, (_event, entityType: ImageEntityType, entityId: string) => {
    try {
      const imageService = getImageService();
      imageService.delete(entityType, entityId);
      return { success: true };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(IMAGE_CHANNELS.GET, (_event, entityType: ImageEntityType, entityId: string) => {
    try {
      const imageService = getImageService();
      return imageService.get(entityType, entityId);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(IMAGE_CHANNELS.THUMBNAIL, (_event, entityType: ImageEntityType, entityId: string) => {
    try {
      const imageService = getImageService();
      return imageService.getThumbnail(entityType, entityId);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
