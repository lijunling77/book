/**
 * IPC 处理器注册入口
 */

import { registerBookIpcHandlers } from './book.ipc';
import { registerInboundIpcHandlers } from './inbound.ipc';
import { registerOutboundIpcHandlers } from './outbound.ipc';
import { registerStockIpcHandlers } from './stock.ipc';
import { registerPriceIpcHandlers } from './price.ipc';
import { registerProfitIpcHandlers } from './profit.ipc';
import { registerDashboardIpcHandlers } from './dashboard.ipc';
import { registerStocktakingIpcHandlers } from './stocktaking.ipc';
import { registerBackupIpcHandlers } from './backup.ipc';
import { registerExportIpcHandlers } from './export.ipc';
import { registerImportIpcHandlers } from './import.ipc';
import { registerReportIpcHandlers } from './report.ipc';
import { registerLocationDictIpcHandlers } from './location-dict.ipc';

export function registerAllIpcHandlers(): void {
  registerBookIpcHandlers();
  registerInboundIpcHandlers();
  registerOutboundIpcHandlers();
  registerStockIpcHandlers();
  registerPriceIpcHandlers();
  registerProfitIpcHandlers();
  registerDashboardIpcHandlers();
  registerStocktakingIpcHandlers();
  registerBackupIpcHandlers();
  registerExportIpcHandlers();
  registerImportIpcHandlers();
  registerReportIpcHandlers();
  registerLocationDictIpcHandlers();
}
