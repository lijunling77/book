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
// 书籍
// ============================================================

/** 书籍实体 */
export interface Book {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 创建书籍输入 */
export interface CreateBookInput {
  title: string;
  author?: string | null;
  description?: string | null;
  location?: string | null;
}

/** 更新书籍输入 */
export interface UpdateBookInput {
  title?: string;
  author?: string;
  description?: string | null;
  location?: string;
}

/** 搜索书籍查询 */
export interface SearchBookQuery {
  keyword: string;
}

// ============================================================
// 库存
// ============================================================

/** 库存实体 */
export interface Stock {
  id: string;
  bookId: string;
  quantity: number;
  updatedAt: string;
}

/** 库存筛选条件 */
export interface StockFilter {
  bookTitle?: string;
  page?: number;
  pageSize?: number;
}

/** 库存列表视图（含价格信息） */
export interface StockView {
  stockId: string;
  bookId: string;
  bookTitle: string;
  author: string | null;
  quantity: number;
  status: '正常' | '缺货';
  latestPurchasePrice: number | null;
  latestSellingPrice: number | null;
  purchasePriceMin: number | null;
  purchasePriceMax: number | null;
  averagePurchasePrice: number | null;
  averageSellingPrice: number | null;
}

/** 库存汇总视图 */
export interface StockSummaryView {
  bookId: string;
  bookTitle: string;
  author: string | null;
  totalQuantity: number;
}

// ============================================================
// 入库记录
// ============================================================

/** 入库记录实体 */
export interface InboundRecord {
  id: string;
  bookId: string;
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
}

/** 创建入库记录输入 */
export interface CreateInboundInput {
  bookId: string;
  inboundDate: string;
  quantity: number;
  purchasePrice: number;
  supplier?: string | null;
}

/** 更新入库记录输入 */
export interface UpdateInboundInput {
  inboundDate?: string;
  quantity?: number;
  purchasePrice?: number;
  supplier?: string | null;
}

/** 入库记录筛选条件 */
export interface InboundFilter {
  bookId?: string;
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
}

/** 创建出库记录输入 */
export interface CreateOutboundInput {
  bookId: string;
  outboundDate: string;
  quantity: number;
  sellingPrice: number;
  buyer?: string | null;
}

/** 更新出库记录输入 */
export interface UpdateOutboundInput {
  outboundDate?: string;
  quantity?: number;
  sellingPrice?: number;
  buyer?: string | null;
}

/** 出库记录筛选条件 */
export interface OutboundFilter {
  bookId?: string;
  dateRange?: DateRange;
  buyer?: string;
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
  dateRange?: DateRange;
}

// ============================================================
// 盘点
// ============================================================

/** 盘点范围类型 */
export type StocktakingScopeType = 'all';

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
  systemQuantity: number;
  actualQuantity: number | null;
  variance: number | null;
  status: StocktakingItemStatus | null;
}

/** 盘点项视图（含关联信息） */
export interface StocktakingItemView extends StocktakingItem {
  bookTitle: string;
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
// 位置字典
// ============================================================

/** 位置字典实体 */
export interface LocationDict {
  id: string;
  name: string;
  createdAt: string;
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
// 仪表盘
// ============================================================

/** 仪表盘数据 */
export interface DashboardData {
  totalStockQuantity: number;
  todayInboundQuantity: number;
  todayInboundAmount: number;
  todayOutboundQuantity: number;
  todayOutboundAmount: number;
  monthlyProfit: number;
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
