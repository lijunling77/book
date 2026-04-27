/**
 * IPC 处理器注册入口
 * 统一注册所有 IPC 通道处理器
 */

import { registerBookIpcHandlers } from './book.ipc';
import { registerEditionIpcHandlers } from './edition.ipc';
import { registerLocationIpcHandlers } from './location.ipc';
import { registerInboundIpcHandlers } from './inbound.ipc';
import { registerOutboundIpcHandlers } from './outbound.ipc';
import { registerStockIpcHandlers } from './stock.ipc';
import { registerDashboardIpcHandlers } from './dashboard.ipc';
import { registerStocktakingIpcHandlers } from './stocktaking.ipc';
import { registerBackupIpcHandlers } from './backup.ipc';
import { registerExportIpcHandlers } from './export.ipc';
import { registerImportIpcHandlers } from './import.ipc';
import { registerLogIpcHandlers } from './log.ipc';
import { registerImageIpcHandlers } from './image.ipc';

/**
 * 注册所有 IPC 处理器
 * 在主进程启动时调用，注册所有 IPC 通道的处理函数
 */
export function registerAllIpcHandlers(): void {
  registerBookIpcHandlers();
  registerEditionIpcHandlers();
  registerLocationIpcHandlers();
  registerInboundIpcHandlers();
  registerOutboundIpcHandlers();
  registerStockIpcHandlers();
  registerDashboardIpcHandlers();
  registerStocktakingIpcHandlers();
  registerBackupIpcHandlers();
  registerExportIpcHandlers();
  registerImportIpcHandlers();
  registerLogIpcHandlers();
  registerImageIpcHandlers();
}
