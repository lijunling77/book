/**
 * 共享类型定义
 * 定义所有业务实体类型接口，供主进程和渲染进程共用
 */

// ============================================================
// 基础类型
// ============================================================

/** 分页输入参数 */
export interface PaginationInput {
  page: number;
  pageSize: number;
}

/** 分页查询结果 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 日期范围 */
export interface DateRange {
  startDate: string;
  endDate: string;
}

// ============================================================
// 书籍与版本
// ============================================================

/** 书籍实体 */
export interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 版本实体 */
export interface Edition {
  id: string;
  bookId: string;
  name: string;
  alertThreshold: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 书籍及其所有版本 */
export interface BookWithEditions extends Book {
  editions: Edition[];
}

/** 创建书籍输入 */
export interface CreateBookInput {
  title: string;
  author?: string | null;
  isbn?: string | null;
  category?: string | null;
  description?: string | null;
}

/** 更新书籍输入 */
export interface UpdateBookInput {
  title?: string;
  author?: string;
  category?: string;
  description?: string | null;
}

/** 搜索书籍查询 */
export interface SearchBookQuery {
  keyword: string;
}

/** 创建版本输入 */
export interface CreateEditionInput {
  bookId: string;
  name: string;
}

/** 更新版本输入 */
export interface UpdateEditionInput {
  name?: string;
}

// ============================================================
// 位置
// ============================================================

/** 位置实体 */
export interface Location {
  id: string;
  warehouse: string;
  shelf: string;
  layer: string;
  createdAt: string;
  updatedAt: string;
}

/** 创建位置输入 */
export interface CreateLocationInput {
  warehouse: string;
  shelf: string;
  layer: string;
}

/** 更新位置输入 */
export interface UpdateLocationInput {
  warehouse?: string;
  shelf?: string;
  layer?: string;
}

/** 位置下的库存单元信息 */
export interface StockUnitAtLocation {
  bookId: string;
  editionId: string;
  bookTitle: string;
  editionName: string;
  quantity: number;
}

// ============================================================
// 库存
// ============================================================

/** 库存实体 */
export interface Stock {
  id: string;
  bookId: string;
  editionId: string | null;
  locationId: string;
  quantity: number;
  updatedAt: string;
}

/** 库存筛选条件 */
export interface StockFilter {
  bookTitle?: string;
  category?: string;
  editionName?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

/** 库存列表视图（含价格信息） */
export interface StockView {
  stockId: string;
  bookId: string;
  editionId: string | null;
  locationId: string;
  bookTitle: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  editionName: string;
  warehouse: string;
  shelf: string;
  layer: string;
  quantity: number;
  status: '正常' | '缺货';
  alertThreshold: number | null;
  isAlert: boolean;
  latestPurchasePrice: number | null;
  latestSellingPrice: number | null;
  purchasePriceMin: number | null;
  purchasePriceMax: number | null;
  averagePurchasePrice: number | null;
  averageSellingPrice: number | null;
  thumbnailPath: string | null;
}

/** 库存汇总视图（所有位置合计） */
export interface StockSummaryView {
  bookId: string;
  editionId: string | null;
  bookTitle: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  editionName: string;
  totalQuantity: number;
  alertThreshold: number | null;
  isAlert: boolean;
  thumbnailPath: string | null;
}

// ============================================================
// 入库记录
// ============================================================

/** 入库记录实体 */
export interface InboundRecord {
  id: string;
  bookId: string;
  editionId: string | null;
  locationId: string;
  inboundDate: string;
  quantity: number;
  purchasePrice: number;
  supplier: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 入库记录视图（含关联信息） */
export interface InboundRecordView extends InboundRecord {
  bookTitle: string;
  editionName: string;
  warehouse: string;
  shelf: string;
  layer: string;
}

/** 创建入库记录输入 */
export interface CreateInboundInput {
  bookId: string;
  editionId?: string | null;
  locationId: string;
  inboundDate: string;
  quantity: number;
  purchasePrice: number;
  supplier?: string | null;
}

/** 更新入库记录输入（禁止修改 bookId 和 editionId） */
export interface UpdateInboundInput {
  locationId?: string;
  inboundDate?: string;
  quantity?: number;
  purchasePrice?: number;
  supplier?: string | null;
}

/** 入库记录筛选条件 */
export interface InboundFilter {
  bookId?: string;
  editionId?: string;
  locationId?: string;
  dateRange?: DateRange;
  supplier?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================
// 出库记录
// ============================================================

/** 出库记录实体 */
export interface OutboundRecord {
  id: string;
  bookId: string;
  editionId: string | null;
  locationId: string;
  outboundDate: string;
  quantity: number;
  sellingPrice: number;
  buyer: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 出库记录视图（含关联信息） */
export interface OutboundRecordView extends OutboundRecord {
  bookTitle: string;
  editionName: string;
  warehouse: string;
  shelf: string;
  layer: string;
}

/** 创建出库记录输入 */
export interface CreateOutboundInput {
  bookId: string;
  editionId?: string | null;
  locationId: string;
  outboundDate: string;
  quantity: number;
  sellingPrice: number;
  buyer?: string | null;
}

/** 更新出库记录输入（禁止修改 bookId 和 editionId） */
export interface UpdateOutboundInput {
  locationId?: string;
  outboundDate?: string;
  quantity?: number;
  sellingPrice?: number;
  buyer?: string | null;
}

/** 出库记录筛选条件 */
export interface OutboundFilter {
  bookId?: string;
  editionId?: string;
  locationId?: string;
  dateRange?: DateRange;
  buyer?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================
// 操作日志
// ============================================================

/** 操作类型枚举 */
export type OperationType = 'create' | 'edit' | 'delete' | 'stocktaking_adjust';

/** 操作对象类型枚举 */
export type EntityType =
  | 'book'
  | 'edition'
  | 'location'
  | 'inbound_record'
  | 'outbound_record'
  | 'stock'
  | 'stocktaking_task'
  | 'backup';

/** 操作日志实体 */
export interface OperationLog {
  id: string;
  operationType: OperationType;
  entityType: EntityType;
  entityId: string;
  beforeData: string | null;
  afterData: string | null;
  createdAt: string;
}

/** 操作日志筛选条件 */
export interface LogFilter {
  operationType?: OperationType;
  entityType?: EntityType;
  entityId?: string;
  dateRange?: DateRange;
  page?: number;
  pageSize?: number;
}

// ============================================================
// 价格与利润
// ============================================================

/** 买入价格历史记录 */
export interface PurchasePriceHistory {
  inboundRecordId: string;
  purchasePrice: number;
  inboundDate: string;
  quantity: number;
  supplier: string | null;
}

/** 售出价格历史记录 */
export interface SellingPriceHistory {
  outboundRecordId: string;
  sellingPrice: number;
  outboundDate: string;
  quantity: number;
  buyer: string | null;
}

/** 价格统计信息 */
export interface PriceStats {
  latestPurchasePrice: number | null;
  latestSellingPrice: number | null;
  purchasePriceMin: number | null;
  purchasePriceMax: number | null;
  averagePurchasePrice: number | null;
  averageSellingPrice: number | null;
  hasInboundRecords: boolean;
  hasOutboundRecords: boolean;
}

/** 利润详情 */
export interface ProfitDetail {
  totalPurchaseCost: number;
  totalSalesRevenue: number;
  netProfit: number;
}

/** 利润筛选条件 */
export interface ProfitFilter {
  category?: string;
  dateRange?: DateRange;
}

// ============================================================
// 盘点
// ============================================================

/** 盘点范围类型 */
export type StocktakingScopeType = 'location' | 'category';

/** 盘点任务状态 */
export type StocktakingStatus = 'in_progress' | 'completed';

/** 盘点项差异状态 */
export type StocktakingItemStatus = 'surplus' | 'deficit' | 'match';

/** 盘点任务实体 */
export interface StocktakingTask {
  id: string;
  scopeType: StocktakingScopeType;
  scopeValue: string;
  status: StocktakingStatus;
  createdAt: string;
  completedAt: string | null;
}

/** 盘点项实体 */
export interface StocktakingItem {
  id: string;
  taskId: string;
  bookId: string;
  editionId: string | null;
  locationId: string;
  systemQuantity: number;
  actualQuantity: number | null;
  variance: number | null;
  status: StocktakingItemStatus | null;
}

/** 盘点项视图（含关联信息） */
export interface StocktakingItemView extends StocktakingItem {
  bookTitle: string;
  editionName: string;
  warehouse: string;
  shelf: string;
  layer: string;
}

/** 盘点详情（任务 + 所有盘点项） */
export interface StocktakingDetail {
  task: StocktakingTask;
  items: StocktakingItemView[];
}

/** 创建盘点任务输入 */
export interface CreateStocktakingInput {
  scopeType: StocktakingScopeType;
  scopeValue: string;
}

/** 录入实际数量输入 */
export interface ActualQuantityInput {
  itemId: string;
  actualQuantity: number;
}

/** 盘点报告 */
export interface StocktakingReport {
  taskId: string;
  totalItems: number;
  surplusCount: number;
  deficitCount: number;
  matchCount: number;
  unrecordedCount: number;
  items: StocktakingItemView[];
}

// ============================================================
// 备份
// ============================================================

/** 备份信息 */
export interface BackupInfo {
  id: string;
  filePath: string;
  createdAt: string;
}

// ============================================================
// 图片
// ============================================================

/** 图片关联实体类型 */
export type ImageEntityType = 'book' | 'edition';

/** 图片信息 */
export interface ImageInfo {
  id: string;
  entityId: string;
  filePath: string;
  thumbnailPath: string;
  createdAt: string;
}

// ============================================================
// 仪表盘
// ============================================================

/** 预警库存单元信息 */
export interface AlertStockUnit {
  bookId: string;
  editionId: string;
  bookTitle: string;
  editionName: string;
  totalQuantity: number;
  alertThreshold: number;
  thumbnailPath: string | null;
}

/** 仪表盘数据 */
export interface DashboardData {
  totalStockQuantity: number;
  alertStockUnitCount: number;
  todayInboundQuantity: number;
  todayInboundAmount: number;
  todayOutboundQuantity: number;
  todayOutboundAmount: number;
  monthlyProfit: number;
  alertStockUnits: AlertStockUnit[];
}

// ============================================================
// 批量操作
// ============================================================

/** 批量操作单条失败记录 */
export interface BatchFailureItem {
  index: number;
  reason: string;
}

/** 批量操作结果摘要 */
export interface BatchResultSummary {
  totalCount: number;
  successCount: number;
  failureCount: number;
  failures: BatchFailureItem[];
}

// ============================================================
// 导入
// ============================================================

/** 导入失败记录 */
export interface ImportFailureItem {
  rowNumber: number;
  reason: string;
}

/** 导入结果摘要 */
export interface ImportResultSummary {
  totalCount: number;
  successCount: number;
  failureCount: number;
  failures: ImportFailureItem[];
}

// ============================================================
// 导出
// ============================================================

/** 导出格式 */
export type ExportFormat = 'xlsx' | 'csv';

/** 导入文件格式 */
export type ImportFileFormat = 'xlsx' | 'csv';
