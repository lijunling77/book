/**
 * IPC 客户端封装
 */

import {
  BOOK_CHANNELS,
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
  REPORT_CHANNELS,
} from '../../shared/ipc-channels';

import type {
  Book,
  CreateBookInput,
  UpdateBookInput,
  SearchBookQuery,
  PaginationInput,
  PaginatedResult,
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
  ProfitFilter,
} from '../../shared/types';

interface IpcErrorResponse {
  error: true;
  message: string;
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!window.electronAPI) {
    throw new Error('当前环境不支持 Electron IPC 通信。');
  }
  const result = await window.electronAPI.invoke(channel, ...args);
  if (result && typeof result === 'object' && 'error' in result && (result as IpcErrorResponse).error === true) {
    throw new Error((result as IpcErrorResponse).message);
  }
  return result as T;
}

export const bookApi = {
  create: (data: CreateBookInput): Promise<Book> => invoke(BOOK_CHANNELS.CREATE, data),
  update: (id: string, data: UpdateBookInput): Promise<Book> => invoke(BOOK_CHANNELS.UPDATE, id, data),
  delete: (id: string): Promise<void> => invoke(BOOK_CHANNELS.DELETE, id),
  getById: (id: string): Promise<Book> => invoke(BOOK_CHANNELS.GET_BY_ID, id),
  search: (query: SearchBookQuery): Promise<Book[]> => invoke(BOOK_CHANNELS.SEARCH, query),
  list: (pagination?: PaginationInput): Promise<PaginatedResult<Book>> => invoke(BOOK_CHANNELS.LIST, pagination),
};

export const locationApi = {
  create: (data: CreateLocationInput): Promise<Location> => invoke(LOCATION_CHANNELS.CREATE, data),
  update: (id: string, data: UpdateLocationInput): Promise<Location> => invoke(LOCATION_CHANNELS.UPDATE, id, data),
  delete: (id: string): Promise<void> => invoke(LOCATION_CHANNELS.DELETE, id),
  list: (): Promise<Location[]> => invoke(LOCATION_CHANNELS.LIST),
  getStock: (id: string): Promise<StockUnitAtLocation[]> => invoke(LOCATION_CHANNELS.GET_STOCK, id),
};

export const inboundApi = {
  create: (data: CreateInboundInput): Promise<InboundRecord> => invoke(INBOUND_CHANNELS.CREATE, data),
  update: (id: string, data: UpdateInboundInput): Promise<InboundRecord> => invoke(INBOUND_CHANNELS.UPDATE, id, data),
  delete: (id: string): Promise<void> => invoke(INBOUND_CHANNELS.DELETE, id),
  list: (filter?: InboundFilter): Promise<PaginatedResult<InboundRecord>> => invoke(INBOUND_CHANNELS.LIST, filter),
  batchCreate: (data: CreateInboundInput[]): Promise<BatchResultSummary> => invoke(INBOUND_CHANNELS.BATCH_CREATE, data),
};

export const outboundApi = {
  create: (data: CreateOutboundInput): Promise<OutboundRecord> => invoke(OUTBOUND_CHANNELS.CREATE, data),
  update: (id: string, data: UpdateOutboundInput): Promise<OutboundRecord> => invoke(OUTBOUND_CHANNELS.UPDATE, id, data),
  delete: (id: string): Promise<void> => invoke(OUTBOUND_CHANNELS.DELETE, id),
  list: (filter?: OutboundFilter): Promise<PaginatedResult<OutboundRecord>> => invoke(OUTBOUND_CHANNELS.LIST, filter),
  batchCreate: (data: CreateOutboundInput[]): Promise<BatchResultSummary> => invoke(OUTBOUND_CHANNELS.BATCH_CREATE, data),
};

export const stockApi = {
  list: (filter?: StockFilter): Promise<PaginatedResult<StockView>> => invoke(STOCK_CHANNELS.LIST, filter),
  summary: (filter?: StockFilter): Promise<StockSummaryView[]> => invoke(STOCK_CHANNELS.SUMMARY, filter),
};

export const priceApi = {
  purchaseHistory: (bookId: string): Promise<PurchasePriceHistory[]> => invoke(PRICE_CHANNELS.PURCHASE_HISTORY, bookId),
  sellingHistory: (bookId: string): Promise<SellingPriceHistory[]> => invoke(PRICE_CHANNELS.SELLING_HISTORY, bookId),
  stats: (bookId: string): Promise<PriceStats> => invoke(PRICE_CHANNELS.STATS, bookId),
};

export const profitApi = {
  byBook: (bookId: string, dateRange?: DateRange): Promise<ProfitDetail> => invoke(PROFIT_CHANNELS.BY_BOOK, bookId, dateRange),
  monthly: (): Promise<Array<{ month: string; inboundQuantity: number; outboundQuantity: number; totalPurchaseCost: number; totalSalesRevenue: number; netProfit: number }>> => invoke(PROFIT_CHANNELS.MONTHLY),
};

export const dashboardApi = {
  getData: (): Promise<DashboardData> => invoke(DASHBOARD_CHANNELS.GET_DATA),
};

export const stocktakingApi = {
  create: (data: CreateStocktakingInput): Promise<StocktakingTask> => invoke(STOCKTAKING_CHANNELS.CREATE, data),
  list: (): Promise<StocktakingTask[]> => invoke(STOCKTAKING_CHANNELS.LIST),
  getDetail: (id: string): Promise<StocktakingDetail> => invoke(STOCKTAKING_CHANNELS.GET_DETAIL, id),
  recordActual: (taskId: string, items: ActualQuantityInput[]): Promise<void> => invoke(STOCKTAKING_CHANNELS.RECORD_ACTUAL, taskId, items),
  submit: (taskId: string): Promise<StocktakingReport> => invoke(STOCKTAKING_CHANNELS.SUBMIT, taskId),
  confirm: (taskId: string): Promise<void> => invoke(STOCKTAKING_CHANNELS.CONFIRM, taskId),
};

export const backupApi = {
  create: (targetPath: string): Promise<BackupInfo> => invoke(BACKUP_CHANNELS.CREATE, targetPath),
  restore: (filePath: string): Promise<void> => invoke(BACKUP_CHANNELS.RESTORE, filePath),
  latest: (): Promise<BackupInfo | null> => invoke(BACKUP_CHANNELS.LATEST),
};

export const exportApi = {
  inbound: (filter: InboundFilter | undefined, format: ExportFormat): Promise<string> => invoke(EXPORT_CHANNELS.INBOUND, filter, format),
  outbound: (filter: OutboundFilter | undefined, format: ExportFormat): Promise<string> => invoke(EXPORT_CHANNELS.OUTBOUND, filter, format),
  stock: (filter: StockFilter | undefined, format: ExportFormat): Promise<string> => invoke(EXPORT_CHANNELS.STOCK, filter, format),
  profit: (filter: ProfitFilter | undefined, format: ExportFormat): Promise<string> => invoke(EXPORT_CHANNELS.PROFIT, filter, format),
};

export const importApi = {
  template: (format: ImportFileFormat): Promise<string> => invoke(IMPORT_CHANNELS.TEMPLATE, format),
  books: (filePath: string): Promise<ImportResultSummary> => invoke(IMPORT_CHANNELS.BOOKS, filePath),
};

export const reportApi = {
  getData: (dateRange?: DateRange): Promise<unknown> => invoke(REPORT_CHANNELS.GET_DATA, dateRange),
};
