/**
 * IPC 通道名称常量
 * 定义所有主进程与渲染进程之间的 IPC 通信通道名称
 */

// ============================================================
// 书籍管理
// ============================================================

export const BOOK_CHANNELS = {
  CREATE: 'book:create',
  UPDATE: 'book:update',
  DELETE: 'book:delete',
  GET_BY_ID: 'book:getById',
  SEARCH: 'book:search',
  LIST: 'book:list',
} as const;

// ============================================================
// 入库管理
// ============================================================

export const INBOUND_CHANNELS = {
  CREATE: 'inbound:create',
  UPDATE: 'inbound:update',
  DELETE: 'inbound:delete',
  LIST: 'inbound:list',
  BATCH_CREATE: 'inbound:batchCreate',
} as const;

// ============================================================
// 出库管理
// ============================================================

export const OUTBOUND_CHANNELS = {
  CREATE: 'outbound:create',
  UPDATE: 'outbound:update',
  DELETE: 'outbound:delete',
  LIST: 'outbound:list',
  BATCH_CREATE: 'outbound:batchCreate',
} as const;

// ============================================================
// 库存
// ============================================================

export const STOCK_CHANNELS = {
  LIST: 'stock:list',
  SUMMARY: 'stock:summary',
} as const;

// ============================================================
// 价格历史
// ============================================================

export const PRICE_CHANNELS = {
  PURCHASE_HISTORY: 'price:purchaseHistory',
  SELLING_HISTORY: 'price:sellingHistory',
  STATS: 'price:stats',
} as const;

// ============================================================
// 利润统计
// ============================================================

export const PROFIT_CHANNELS = {
  BY_BOOK: 'profit:byBook',
  MONTHLY: 'profit:monthly',
  YEARLY: 'profit:yearly',
} as const;

// ============================================================
// 仪表盘
// ============================================================

export const DASHBOARD_CHANNELS = {
  GET_DATA: 'dashboard:getData',
} as const;

// ============================================================
// 盘点管理
// ============================================================

export const STOCKTAKING_CHANNELS = {
  CREATE: 'stocktaking:create',
  LIST: 'stocktaking:list',
  GET_DETAIL: 'stocktaking:getDetail',
  RECORD_ACTUAL: 'stocktaking:recordActual',
  SUBMIT: 'stocktaking:submit',
  CONFIRM: 'stocktaking:confirm',
} as const;

// ============================================================
// 数据备份与恢复
// ============================================================

export const BACKUP_CHANNELS = {
  CREATE: 'backup:create',
  RESTORE: 'backup:restore',
  LATEST: 'backup:latest',
} as const;

// ============================================================
// 数据导出
// ============================================================

export const EXPORT_CHANNELS = {
  INBOUND: 'export:inbound',
  OUTBOUND: 'export:outbound',
  STOCK: 'export:stock',
  PROFIT: 'export:profit',
} as const;

// ============================================================
// 数据导入
// ============================================================

export const IMPORT_CHANNELS = {
  TEMPLATE: 'import:template',
  BOOKS: 'import:books',
} as const;

// ============================================================
// 综合报表
// ============================================================

export const REPORT_CHANNELS = {
  GET_DATA: 'report:getData',
  EXPORT: 'report:export',
} as const;

// ============================================================
// 所有通道名称集合（用于类型检查）
// ============================================================

export const ALL_CHANNELS = {
  ...BOOK_CHANNELS,
  ...INBOUND_CHANNELS,
  ...OUTBOUND_CHANNELS,
  ...STOCK_CHANNELS,
  ...PRICE_CHANNELS,
  ...PROFIT_CHANNELS,
  ...DASHBOARD_CHANNELS,
  ...STOCKTAKING_CHANNELS,
  ...BACKUP_CHANNELS,
  ...EXPORT_CHANNELS,
  ...IMPORT_CHANNELS,
  ...REPORT_CHANNELS,
} as const;
