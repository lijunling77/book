/**
 * 共享常量定义
 * 定义业务常量，供主进程和渲染进程共用
 */

// ============================================================
// 导入导出相关常量
// ============================================================

/** 支持的导入文件扩展名 */
export const SUPPORTED_IMPORT_EXTENSIONS = ['.xlsx', '.csv'] as const;

/** 导入模板列标题 */
export const IMPORT_TEMPLATE_COLUMNS = ['书名', '作者', '描述'] as const;

/** 导入模板必需列标题 */
export const IMPORT_REQUIRED_COLUMNS = ['书名'] as const;

// ============================================================
// 盘点相关常量
// ============================================================

/** 盘点任务状态常量 */
export const STOCKTAKING_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

/** 盘点任务状态中文标签 */
export const STOCKTAKING_STATUS_LABELS: Record<string, string> = {
  in_progress: '进行中',
  completed: '已完成',
};

/** 盘点项差异状态常量 */
export const STOCKTAKING_ITEM_STATUS = {
  SURPLUS: 'surplus',
  DEFICIT: 'deficit',
  MATCH: 'match',
} as const;

/** 盘点项差异状态中文标签 */
export const STOCKTAKING_ITEM_STATUS_LABELS: Record<string, string> = {
  surplus: '盘盈',
  deficit: '盘亏',
  match: '一致',
};

/** 盘点范围类型常量 */
export const STOCKTAKING_SCOPE_TYPES = {
  ALL: 'all',
} as const;

// ============================================================
// 库存状态常量
// ============================================================

/** 库存状态标签 */
export const STOCK_STATUS = {
  NORMAL: '正常',
  OUT_OF_STOCK: '缺货',
} as const;

// ============================================================
// 分页默认值
// ============================================================

/** 默认页码 */
export const DEFAULT_PAGE = 1;

/** 默认每页条数 */
export const DEFAULT_PAGE_SIZE = 20;

// ============================================================
// 价格显示常量
// ============================================================

/** 无数据时的价格显示文本 */
export const NO_DATA_TEXT = '暂无数据';

/** 货币单位 */
export const CURRENCY_UNIT = '元';

// ============================================================
// 错误消息常量
// ============================================================

export const ERROR_MESSAGES = {
  // 书籍相关
  BOOK_NOT_FOUND: '书籍不存在',
  BOOK_HAS_STOCK: '该书籍存在库存数量大于零的记录，无法删除',

  // 位置相关
  LOCATION_ALREADY_EXISTS: '该位置已存在',
  LOCATION_NOT_FOUND: '位置不存在',
  LOCATION_HAS_STOCK: '该位置下存在库存数量大于零的库存单元记录，无法删除',

  // 库存相关
  INSUFFICIENT_STOCK: '库存不足',
  STOCK_WOULD_BE_NEGATIVE: '操作将导致库存数量为负',

  // 导入相关
  UNSUPPORTED_FILE_FORMAT: '文件格式不支持，请上传 .xlsx 或 .csv 格式的文件',
  MISSING_REQUIRED_COLUMNS: '导入文件缺少必需的列标题',
  EMPTY_IMPORT_FILE: '导入文件中无数据记录',

  // 备份相关
  BACKUP_PATH_NOT_WRITABLE: '备份路径不可写入，请选择其他路径',
  BACKUP_FILE_INVALID: '备份文件无效或已损坏，无法恢复',
  DATABASE_CORRUPTED: '数据库文件损坏或不可读，请检查数据库文件路径',

  // 导出相关
  NO_DATA_TO_EXPORT: '当前筛选条件下无数据可导出',

  // 盘点相关
  NO_STOCK_IN_SCOPE: '所选盘点范围内无库存单元数据',
} as const;
