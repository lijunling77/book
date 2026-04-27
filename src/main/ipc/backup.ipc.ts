/**
 * 数据备份与恢复 IPC 处理器
 * 注册备份相关的 IPC 通道，调用 BackupService 处理业务逻辑
 */

import { ipcMain, app } from 'electron';
import path from 'path';
import { BACKUP_CHANNELS } from '../../shared/ipc-channels';
import { BackupService } from '../services/backup.service';

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'books.db');
}

export function registerBackupIpcHandlers(): void {
  ipcMain.handle(BACKUP_CHANNELS.CREATE, (_event, targetPath: string) => {
    try {
      const backupService = new BackupService(getDbPath());
      return backupService.create(targetPath);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(BACKUP_CHANNELS.RESTORE, (_event, filePath: string) => {
    try {
      const backupService = new BackupService(getDbPath());
      backupService.restore(filePath);
      return { success: true };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(BACKUP_CHANNELS.LATEST, () => {
    try {
      const backupService = new BackupService(getDbPath());
      return backupService.getLatest();
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
