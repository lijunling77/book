/**
 * 数据导入 IPC 处理器
 * 注册导入相关的 IPC 通道，调用 ImportService 处理业务逻辑
 */

import { ipcMain, app, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { IMPORT_CHANNELS } from '../../shared/ipc-channels';
import { ImportService } from '../services/import.service';
import type { ImportFileFormat } from '../../shared/types';

const importService = new ImportService();

export function registerImportIpcHandlers(): void {
  ipcMain.handle(IMPORT_CHANNELS.TEMPLATE, async (_event, format: ImportFileFormat) => {
    try {
      const buffer = importService.getTemplate(format);
      const ext = format === 'csv' ? '.csv' : '.xlsx';
      const defaultName = `导入模板${ext}`;

      const result = await dialog.showSaveDialog({
        title: '保存导入模板',
        defaultPath: defaultName,
        filters: format === 'csv'
          ? [{ name: 'CSV', extensions: ['csv'] }]
          : [{ name: 'Excel', extensions: ['xlsx'] }],
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      fs.writeFileSync(result.filePath, buffer);
      return { filePath: result.filePath };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(IMPORT_CHANNELS.BOOKS, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择导入文件',
        filters: [
          { name: '表格文件', extensions: ['xlsx', 'csv'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const filePath = result.filePaths[0];
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      return importService.importBooks(fileBuffer, fileName);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(IMPORT_CHANNELS.INBOUND_TEMPLATE, async (_event, format: ImportFileFormat) => {
    try {
      const buffer = importService.getInboundTemplate(format);
      const ext = format === 'csv' ? '.csv' : '.xlsx';
      const defaultName = `入库导入模板${ext}`;

      const result = await dialog.showSaveDialog({
        title: '保存入库导入模板',
        defaultPath: defaultName,
        filters: format === 'csv'
          ? [{ name: 'CSV', extensions: ['csv'] }]
          : [{ name: 'Excel', extensions: ['xlsx'] }],
      });

      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }

      fs.writeFileSync(result.filePath, buffer);
      return { filePath: result.filePath };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(IMPORT_CHANNELS.INBOUND, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '选择入库导入文件',
        filters: [
          { name: '表格文件', extensions: ['xlsx', 'csv'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const filePath = result.filePaths[0];
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      return importService.importInbound(fileBuffer, fileName);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
