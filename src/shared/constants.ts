/**
 * 共享常量定义
 * 定义业务常量，供主进程和渲染进程共用
 */

// ============================================================
// 图片相关常量
// ============================================================

/** 图片最大文件大小（字节）：5MB */
export const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** 图片最大文件大小（MB），用于显示 */
export const IMAGE_MAX_SIZE_MB = 5;

/** 支持的图片 MIME 类型 */
export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

/** 支持的图片文件扩展名 */
export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const;

// ============================================================
// 导入导出相关常量
// ============================================================

/** 支持的导入文件扩展名 */
export const SUPPORTED_IMPORT_EXTENSIONS = ['.xlsx', '.csv'] as const;

/** 导入模板列标题 */
export const IMPORT_TEMPLATE_COLUMNS = ['书名', '作者', 'ISBN', '分类', '描述'] as const;

/** 导入模板必需列标题 */
export const IMPORT_REQUIRED_COLUMNS = ['书名', '作者', 'ISBN', '分类', '描述'] as const;

// ============================================================
// 操作类型枚举
// ============================================================

/** 操作类型常量 */
export const OPERATION_TYPES = {
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  STOCKTAKING_ADJUST: 'stocktaking_adjust',
} as const;

/** 操作类型中文标签 */
export const OPERATION_TYPE_LABELS: Record<string, string> = {
  create: '创建',
  edit: '编辑',
  delete: '删除',
  stocktaking_adjust: '盘点调整',
};

// ============================================================
// 实体类型枚举
// ============================================================

/** 操作对象类型常量 */
export const ENTITY_TYPES = {
  BOOK: 'book',
  EDITION: 'edition',
  LOCATION: 'location',
  INBOUND_RECORD: 'inbound_record',
  OUTBOUND_RECORD: 'outbound_record',
  STOCK: 'stock',
  STOCKTAKING_TASK: 'stocktaking_task',
  BACKUP: 'backup',
} as const;

/** 操作对象类型中文标签 */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  book: '书籍',
  edition: '版本',
  location: '位置',
  inbound_record: '入库记录',
  outbound_record: '出库记录',
  stock: '库存',
  stocktaking_task: '盘点任务',
  backup: '备份',
};

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
  LOCATION: 'location',
  CATEGORY: 'category',
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
  ISBN_ALREADY_EXISTS: '该 ISBN 已存在',
  BOOK_NOT_FOUND: '书籍不存在',
  BOOK_HAS_STOCK: '该书籍存在库存数量大于零的版本，无法删除',

  // 版本相关
  EDITION_ALREADY_EXISTS: '该版本已存在',
  EDITION_NOT_FOUND: '版本不存在',
  EDITION_HAS_STOCK: '该版本存在库存数量大于零的记录，无法删除',

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

  // 图片相关
  UNSUPPORTED_IMAGE_FORMAT: '图片格式不支持，请上传 JPG 或 PNG 格式的图片',
  IMAGE_TOO_LARGE: '图片文件大小超过 5MB，请压缩后重新上传',

  // 备份相关
  BACKUP_PATH_NOT_WRITABLE: '备份路径不可写入，请选择其他路径',
  BACKUP_FILE_INVALID: '备份文件无效或已损坏，无法恢复',
  DATABASE_CORRUPTED: '数据库文件损坏或不可读，请检查数据库文件路径',

  // 仪表盘相关
  NO_STOCK_ALERT: '当前无库存预警',

  // 导出相关
  NO_DATA_TO_EXPORT: '当前筛选条件下无数据可导出',

  // 盘点相关
  NO_STOCK_IN_SCOPE: '所选盘点范围内无库存单元数据',
} as const;
