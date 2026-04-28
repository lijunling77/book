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
// 版本管理
// ============================================================

export const EDITION_CHANNELS = {
  CREATE: 'edition:create',
  UPDATE: 'edition:update',
  DELETE: 'edition:delete',
} as const;

// ============================================================
// 位置管理
// ============================================================

export const LOCATION_CHANNELS = {
  CREATE: 'location:create',
  UPDATE: 'location:update',
  DELETE: 'location:delete',
  LIST: 'location:list',
  GET_STOCK: 'location:getStock',
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
// 库存与预警
// ============================================================

export const STOCK_CHANNELS = {
  LIST: 'stock:list',
  SUMMARY: 'stock:summary',
  SET_ALERT: 'stock:setAlert',
  ALERT_LIST: 'stock:alertList',
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
  BY_STOCK_UNIT: 'profit:byStockUnit',
  BY_BOOK: 'profit:byBook',
  BY_CATEGORY: 'profit:byCategory',
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
// 操作日志
// ============================================================

export const LOG_CHANNELS = {
  LIST: 'log:list',
} as const;

// ============================================================
// 图片管理
// ============================================================

export const IMAGE_CHANNELS = {
  UPLOAD: 'image:upload',
  DELETE: 'image:delete',
  GET: 'image:get',
  THUMBNAIL: 'image:thumbnail',
} as const;

// ============================================================
// 综合报表
// ============================================================

export const REPORT_CHANNELS = {
  GET_DATA: 'report:getData',
} as const;

// ============================================================
// 所有通道名称集合（用于类型检查）
// ============================================================

export const ALL_CHANNELS = {
  ...BOOK_CHANNELS,
  ...EDITION_CHANNELS,
  ...LOCATION_CHANNELS,
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
  ...LOG_CHANNELS,
  ...IMAGE_CHANNELS,
  ...REPORT_CHANNELS,
} as const;
