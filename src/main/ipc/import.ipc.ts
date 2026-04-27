/**
 * 数据导入 IPC 处理器
 * 注册导入相关的 IPC 通道，调用 ImportService 处理业务逻辑
 */

import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { IMPORT_CHANNELS } from '../../shared/ipc-channels';
import { ImportService } from '../services/import.service';
import type { ImportFileFormat } from '../../shared/types';

const importService = new ImportService();

export function registerImportIpcHandlers(): void {
  ipcMain.handle(IMPORT_CHANNELS.TEMPLATE, (_event, format: ImportFileFormat) => {
    try {
      const buffer = importService.getTemplate(format);
      const ext = format === 'csv' ? '.csv' : '.xlsx';
      const fileName = `import_template_${uuidv4()}${ext}`;
      const exportDir = path.join(app.getPath('temp'), 'book-management-exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      const filePath = path.join(exportDir, fileName);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(IMPORT_CHANNELS.BOOKS, (_event, filePath: string) => {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      return importService.importBooks(fileBuffer, fileName);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
