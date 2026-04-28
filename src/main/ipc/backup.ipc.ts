/**
 * 数据备份与恢复 IPC 处理器
 * 使用系统对话框选择备份/恢复路径
 */

import { ipcMain, app, dialog } from 'electron';
import path from 'path';
import { BACKUP_CHANNELS } from '../../shared/ipc-channels';
import { BackupService } from '../services/backup.service';

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'books.db');
}

export function registerBackupIpcHandlers(): void {
  // 备份：弹出保存对话框选择路径
  ipcMain.handle(BACKUP_CHANNELS.CREATE, async () => {
    try {
      const result = await dialog.showSaveDialog({
        title: '选择备份保存位置',
        defaultPath: `书库备份_${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: '数据库文件', extensions: ['db'] }],
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      const backupService = new BackupService(getDbPath());
      return backupService.create(result.filePath);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 恢复：弹出打开对话框选择备份文件
  ipcMain.handle(BACKUP_CHANNELS.RESTORE, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择备份文件',
        filters: [{ name: '数据库文件', extensions: ['db', 'sqlite', 'sqlite3'] }],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const backupService = new BackupService(getDbPath());
      backupService.restore(result.filePaths[0]);
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
