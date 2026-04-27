/**
 * IPC 客户端封装
 * 封装 ipcRenderer.invoke 调用，提供类型安全的 API 函数供前端组件调用
 * 通过 preload 脚本暴露的 window.electronAPI.invoke 与主进程通信
 */

import {
  BOOK_CHANNELS,
  EDITION_CHANNELS,
  LOCATION_CHANNELS,
  INBOUND_CHANNELS,
  OUTBOUND_CHANNELS,
  STOCK_CHANNELS,
  PRICE_CHANNELS,
  PROFIT_CHANNELS,
  DASHBOARD_CHANNELS,
  STOCKTAKING_CHANNELS,
  BACKUP_CHANNELS,
  EXPORT_CHANNELS,
  IMPORT_CHANNELS,
  LOG_CHANNELS,
  IMAGE_CHANNELS,
} from '../../shared/ipc-channels';

import type {
  Book,
  BookWithEditions,
  CreateBookInput,
  UpdateBookInput,
  SearchBookQuery,
  PaginationInput,
  PaginatedResult,
  Edition,
  CreateEditionInput,
  UpdateEditionInput,
  Location,
  CreateLocationInput,
  UpdateLocationInput,
  StockUnitAtLocation,
  InboundRecord,
  CreateInboundInput,
  UpdateInboundInput,
  InboundFilter,
  BatchResultSummary,
  OutboundRecord,
  CreateOutboundInput,
  UpdateOutboundInput,
  OutboundFilter,
  StockFilter,
  StockView,
  StockSummaryView,
  AlertStockUnit,
  PurchasePriceHistory,
  SellingPriceHistory,
  PriceStats,
  ProfitDetail,
  DateRange,
  DashboardData,
  StocktakingTask,
  StocktakingDetail,
  StocktakingReport,
  CreateStocktakingInput,
  ActualQuantityInput,
  BackupInfo,
  ExportFormat,
  ImportFileFormat,
  ImportResultSummary,
  LogFilter,
  OperationLog,
  ImageEntityType,
  ImageInfo,
  ProfitFilter,
} from '../../shared/types';

/** IPC 调用错误响应 */
interface IpcErrorResponse {
  error: true;
  message: string;
}

/**
 * 通用 IPC 调用封装
 * 调用主进程 IPC 通道并处理错误响应
 */
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!window.electronAPI) {
    throw new Error('当前环境不支持 Electron IPC 通信。请通过 Electron 应用启动，而非直接在浏览器中访问。');
  }
  const result = await window.electronAPI.invoke(channel, ...args);
  if (result && typeof result === 'object' && 'error' in result && (result as IpcErrorResponse).error === true) {
    throw new Error((result as IpcErrorResponse).message);
  }
  return result as T;
}

// ============================================================
// 书籍管理 API
// ============================================================

export const bookApi = {
  create: (data: CreateBookInput): Promise<Book> =>
    invoke(BOOK_CHANNELS.CREATE, data),

  update: (id: string, data: UpdateBookInput): Promise<Book> =>
    invoke(BOOK_CHANNELS.UPDATE, id, data),

  delete: (id: string): Promise<void> =>
    invoke(BOOK_CHANNELS.DELETE, id),

  getById: (id: string): Promise<BookWithEditions> =>
    invoke(BOOK_CHANNELS.GET_BY_ID, id),

  search: (query: SearchBookQuery): Promise<Book[]> =>
    invoke(BOOK_CHANNELS.SEARCH, query),

  list: (pagination?: PaginationInput): Promise<PaginatedResult<Book>> =>
    invoke(BOOK_CHANNELS.LIST, pagination),
};

// ============================================================
// 版本管理 API
// ============================================================

export const editionApi = {
  create: (data: CreateEditionInput): Promise<Edition> =>
    invoke(EDITION_CHANNELS.CREATE, data),

  update: (id: string, data: UpdateEditionInput): Promise<Edition> =>
    invoke(EDITION_CHANNELS.UPDATE, id, data),

  delete: (id: string): Promise<void> =>
    invoke(EDITION_CHANNELS.DELETE, id),
};

// ============================================================
// 位置管理 API
// ============================================================

export const locationApi = {
  create: (data: CreateLocationInput): Promise<Location> =>
    invoke(LOCATION_CHANNELS.CREATE, data),

  update: (id: string, data: UpdateLocationInput): Promise<Location> =>
    invoke(LOCATION_CHANNELS.UPDATE, id, data),

  delete: (id: string): Promise<void> =>
    invoke(LOCATION_CHANNELS.DELETE, id),

  list: (): Promise<Location[]> =>
    invoke(LOCATION_CHANNELS.LIST),

  getStock: (id: string): Promise<StockUnitAtLocation[]> =>
    invoke(LOCATION_CHANNELS.GET_STOCK, id),
};

// ============================================================
// 入库管理 API
// ============================================================

export const inboundApi = {
  create: (data: CreateInboundInput): Promise<InboundRecord> =>
    invoke(INBOUND_CHANNELS.CREATE, data),

  update: (id: string, data: UpdateInboundInput): Promise<InboundRecord> =>
    invoke(INBOUND_CHANNELS.UPDATE, id, data),

  delete: (id: string): Promise<void> =>
    invoke(INBOUND_CHANNELS.DELETE, id),

  list: (filter?: InboundFilter): Promise<PaginatedResult<InboundRecord>> =>
    invoke(INBOUND_CHANNELS.LIST, filter),

  batchCreate: (data: CreateInboundInput[]): Promise<BatchResultSummary> =>
    invoke(INBOUND_CHANNELS.BATCH_CREATE, data),
};

// ============================================================
// 出库管理 API
// ============================================================

export const outboundApi = {
  create: (data: CreateOutboundInput): Promise<OutboundRecord> =>
    invoke(OUTBOUND_CHANNELS.CREATE, data),

  update: (id: string, data: UpdateOutboundInput): Promise<OutboundRecord> =>
    invoke(OUTBOUND_CHANNELS.UPDATE, id, data),

  delete: (id: string): Promise<void> =>
    invoke(OUTBOUND_CHANNELS.DELETE, id),

  list: (filter?: OutboundFilter): Promise<PaginatedResult<OutboundRecord>> =>
    invoke(OUTBOUND_CHANNELS.LIST, filter),

  batchCreate: (data: CreateOutboundInput[]): Promise<BatchResultSummary> =>
    invoke(OUTBOUND_CHANNELS.BATCH_CREATE, data),
};

// ============================================================
// 库存与预警 API
// ============================================================

export const stockApi = {
  list: (filter?: StockFilter): Promise<PaginatedResult<StockView>> =>
    invoke(STOCK_CHANNELS.LIST, filter),

  summary: (filter?: StockFilter): Promise<StockSummaryView[]> =>
    invoke(STOCK_CHANNELS.SUMMARY, filter),

  setAlert: (editionId: string, threshold: number | null): Promise<void> =>
    invoke(STOCK_CHANNELS.SET_ALERT, editionId, threshold),

  alertList: (): Promise<AlertStockUnit[]> =>
    invoke(STOCK_CHANNELS.ALERT_LIST),
};

// ============================================================
// 价格历史 API
// ============================================================

export const priceApi = {
  purchaseHistory: (bookId: string, editionId: string): Promise<PurchasePriceHistory[]> =>
    invoke(PRICE_CHANNELS.PURCHASE_HISTORY, bookId, editionId),

  sellingHistory: (bookId: string, editionId: string): Promise<SellingPriceHistory[]> =>
    invoke(PRICE_CHANNELS.SELLING_HISTORY, bookId, editionId),

  stats: (bookId: string, editionId: string): Promise<PriceStats> =>
    invoke(PRICE_CHANNELS.STATS, bookId, editionId),
};

// ============================================================
// 利润统计 API
// ============================================================

export const profitApi = {
  byStockUnit: (bookId: string, editionId: string, dateRange?: DateRange): Promise<ProfitDetail> =>
    invoke(PROFIT_CHANNELS.BY_STOCK_UNIT, bookId, editionId, dateRange),

  byBook: (bookId: string, dateRange?: DateRange): Promise<ProfitDetail> =>
    invoke(PROFIT_CHANNELS.BY_BOOK, bookId, dateRange),

  byCategory: (category: string, dateRange?: DateRange): Promise<ProfitDetail> =>
    invoke(PROFIT_CHANNELS.BY_CATEGORY, category, dateRange),
};

// ============================================================
// 仪表盘 API
// ============================================================

export const dashboardApi = {
  getData: (): Promise<DashboardData> =>
    invoke(DASHBOARD_CHANNELS.GET_DATA),
};

// ============================================================
// 盘点管理 API
// ============================================================

export const stocktakingApi = {
  create: (data: CreateStocktakingInput): Promise<StocktakingTask> =>
    invoke(STOCKTAKING_CHANNELS.CREATE, data),

  list: (): Promise<StocktakingTask[]> =>
    invoke(STOCKTAKING_CHANNELS.LIST),

  getDetail: (id: string): Promise<StocktakingDetail> =>
    invoke(STOCKTAKING_CHANNELS.GET_DETAIL, id),

  recordActual: (taskId: string, items: ActualQuantityInput[]): Promise<void> =>
    invoke(STOCKTAKING_CHANNELS.RECORD_ACTUAL, taskId, items),

  submit: (taskId: string): Promise<StocktakingReport> =>
    invoke(STOCKTAKING_CHANNELS.SUBMIT, taskId),

  confirm: (taskId: string): Promise<void> =>
    invoke(STOCKTAKING_CHANNELS.CONFIRM, taskId),
};

// ============================================================
// 数据备份与恢复 API
// ============================================================

export const backupApi = {
  create: (targetPath: string): Promise<BackupInfo> =>
    invoke(BACKUP_CHANNELS.CREATE, targetPath),

  restore: (filePath: string): Promise<void> =>
    invoke(BACKUP_CHANNELS.RESTORE, filePath),

  latest: (): Promise<BackupInfo | null> =>
    invoke(BACKUP_CHANNELS.LATEST),
};

// ============================================================
// 数据导出 API
// ============================================================

export const exportApi = {
  inbound: (filter: InboundFilter | undefined, format: ExportFormat): Promise<string> =>
    invoke(EXPORT_CHANNELS.INBOUND, filter, format),

  outbound: (filter: OutboundFilter | undefined, format: ExportFormat): Promise<string> =>
    invoke(EXPORT_CHANNELS.OUTBOUND, filter, format),

  stock: (filter: StockFilter | undefined, format: ExportFormat): Promise<string> =>
    invoke(EXPORT_CHANNELS.STOCK, filter, format),

  profit: (filter: ProfitFilter | undefined, format: ExportFormat): Promise<string> =>
    invoke(EXPORT_CHANNELS.PROFIT, filter, format),
};

// ============================================================
// 数据导入 API
// ============================================================

export const importApi = {
  template: (format: ImportFileFormat): Promise<string> =>
    invoke(IMPORT_CHANNELS.TEMPLATE, format),

  books: (filePath: string): Promise<ImportResultSummary> =>
    invoke(IMPORT_CHANNELS.BOOKS, filePath),
};

// ============================================================
// 操作日志 API
// ============================================================

export const logApi = {
  list: (filter?: LogFilter): Promise<PaginatedResult<OperationLog>> =>
    invoke(LOG_CHANNELS.LIST, filter),
};

// ============================================================
// 图片管理 API
// ============================================================

export const imageApi = {
  upload: (entityType: ImageEntityType, entityId: string, imageData: Buffer, fileName: string): Promise<ImageInfo> =>
    invoke(IMAGE_CHANNELS.UPLOAD, entityType, entityId, imageData, fileName),

  delete: (entityType: ImageEntityType, entityId: string): Promise<void> =>
    invoke(IMAGE_CHANNELS.DELETE, entityType, entityId),

  get: (entityType: ImageEntityType, entityId: string): Promise<string | null> =>
    invoke(IMAGE_CHANNELS.GET, entityType, entityId),

  thumbnail: (entityType: ImageEntityType, entityId: string): Promise<string | null> =>
    invoke(IMAGE_CHANNELS.THUMBNAIL, entityType, entityId),
};
