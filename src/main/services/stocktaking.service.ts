/**
 * StocktakingService - 库存盘点服务
 * 提供盘点任务的创建、实际数量录入、提交报告、确认调整、列表查询和详情查看功能
 * 支持按位置或按分类选择盘点范围
 * 确认操作在事务中执行，确保库存调整的原子性
 */

import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getSqliteDatabase } from '../db';
import {
  stocktakingTasks,
  stocktakingItems,
  stock,
  books,
  editions,
  locations,
} from '../db/schema';
import {
  ERROR_MESSAGES,
  STOCKTAKING_STATUS,
  STOCKTAKING_ITEM_STATUS,
  STOCKTAKING_SCOPE_TYPES,
  OPERATION_TYPES,
  ENTITY_TYPES,
} from '../../shared/constants';
import { StockService } from './stock.service';
import { LogService } from './log.service';
import type {
  StocktakingTask,
  StocktakingDetail,
  StocktakingItemView,
  StocktakingReport,
  CreateStocktakingInput,
  ActualQuantityInput,
} from '../../shared/types';

const stockService = new StockService();
const logService = new LogService();

export class StocktakingService {
  /**
   * 创建盘点任务
   * 支持按位置或按分类选择盘点范围，加载范围内所有库存单元的系统数量
   * 盘点范围内无库存单元时抛出错误
   *
   * @param input 创建盘点任务输入（scopeType + scopeValue）
   * @returns 创建的盘点任务
   */
  create(input: CreateStocktakingInput): StocktakingTask {
    const db = getDatabase();
    const sqliteDb = getSqliteDatabase();

    const transaction = sqliteDb.transaction(() => {
      // 根据盘点范围类型查询库存记录
      let stockRecords: Array<{
        bookId: string;
        editionId: string | null;
        locationId: string;
        quantity: number;
      }>;

      if (input.scopeType === STOCKTAKING_SCOPE_TYPES.LOCATION) {
        // 按位置盘点：查询指定位置下的所有库存记录
        stockRecords = db
          .select({
            bookId: stock.bookId,
            editionId: stock.editionId,
            locationId: stock.locationId,
            quantity: stock.quantity,
          })
          .from(stock)
          .where(eq(stock.locationId, input.scopeValue))
          .all();
      } else {
        // 按分类盘点：查询指定分类下所有书籍的所有版本在所有位置的库存记录
        stockRecords = db
          .select({
            bookId: stock.bookId,
            editionId: stock.editionId,
            locationId: stock.locationId,
            quantity: stock.quantity,
          })
          .from(stock)
          .innerJoin(books, eq(stock.bookId, books.id))
          .where(eq(books.category, input.scopeValue))
          .all();
      }

      // 盘点范围内无库存单元时抛出错误
      if (stockRecords.length === 0) {
        throw new Error(ERROR_MESSAGES.NO_STOCK_IN_SCOPE);
      }

      // 创建盘点任务
      const taskId = uuidv4();
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      db.insert(stocktakingTasks)
        .values({
          id: taskId,
          scopeType: input.scopeType,
          scopeValue: input.scopeValue,
          status: STOCKTAKING_STATUS.IN_PROGRESS,
          createdAt: now,
          completedAt: null,
        })
        .run();

      // 为范围内每个库存单元创建盘点项，记录系统数量
      for (const record of stockRecords) {
        db.insert(stocktakingItems)
          .values({
            id: uuidv4(),
            taskId,
            bookId: record.bookId,
            editionId: record.editionId,
            locationId: record.locationId,
            systemQuantity: record.quantity,
            actualQuantity: null,
            variance: null,
            status: null,
          })
          .run();
      }

      const task = db
        .select()
        .from(stocktakingTasks)
        .where(eq(stocktakingTasks.id, taskId))
        .get()!;

      return task as StocktakingTask;
    });

    return transaction();
  }

  /**
   * 录入实际数量
   * 保存实际数量，自动计算差异数量（实际 - 系统），标记盘盈/盘亏/一致
   *
   * @param taskId 盘点任务 ID
   * @param items 实际数量录入列表
   */
  recordActual(taskId: string, items: ActualQuantityInput[]): void {
    const db = getDatabase();

    for (const item of items) {
      // 获取盘点项
      const existing = db
        .select()
        .from(stocktakingItems)
        .where(
          and(
            eq(stocktakingItems.id, item.itemId),
            eq(stocktakingItems.taskId, taskId),
          ),
        )
        .get();

      if (!existing) {
        continue;
      }

      // 计算差异数量
      const variance = item.actualQuantity - existing.systemQuantity;

      // 确定差异状态
      let status: string;
      if (variance > 0) {
        status = STOCKTAKING_ITEM_STATUS.SURPLUS;
      } else if (variance < 0) {
        status = STOCKTAKING_ITEM_STATUS.DEFICIT;
      } else {
        status = STOCKTAKING_ITEM_STATUS.MATCH;
      }

      // 更新盘点项
      db.update(stocktakingItems)
        .set({
          actualQuantity: item.actualQuantity,
          variance,
          status,
        })
        .where(eq(stocktakingItems.id, item.itemId))
        .run();
    }
  }

  /**
   * 提交盘点结果，生成盘点报告
   * 汇总盘盈/盘亏/一致数量，检查未录入的库存单元并返回未录入数量
   *
   * @param taskId 盘点任务 ID
   * @returns 盘点报告
   */
  submit(taskId: string): StocktakingReport {
    const db = getDatabase();

    // 获取所有盘点项及关联信息
    const items = db
      .select({
        id: stocktakingItems.id,
        taskId: stocktakingItems.taskId,
        bookId: stocktakingItems.bookId,
        editionId: stocktakingItems.editionId,
        locationId: stocktakingItems.locationId,
        systemQuantity: stocktakingItems.systemQuantity,
        actualQuantity: stocktakingItems.actualQuantity,
        variance: stocktakingItems.variance,
        status: stocktakingItems.status,
        bookTitle: books.title,
        editionName: editions.name,
        warehouse: locations.warehouse,
        shelf: locations.shelf,
        layer: locations.layer,
      })
      .from(stocktakingItems)
      .innerJoin(books, eq(stocktakingItems.bookId, books.id))
      .innerJoin(editions, eq(stocktakingItems.editionId, editions.id))
      .innerJoin(locations, eq(stocktakingItems.locationId, locations.id))
      .where(eq(stocktakingItems.taskId, taskId))
      .all();

    const itemViews: StocktakingItemView[] = items.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      bookId: item.bookId,
      editionId: item.editionId,
      locationId: item.locationId,
      systemQuantity: item.systemQuantity,
      actualQuantity: item.actualQuantity,
      variance: item.variance,
      status: item.status as StocktakingItemView['status'],
      bookTitle: item.bookTitle,
      editionName: item.editionName,
      warehouse: item.warehouse,
      shelf: item.shelf,
      layer: item.layer,
    }));

    // 统计各状态数量
    let surplusCount = 0;
    let deficitCount = 0;
    let matchCount = 0;
    let unrecordedCount = 0;

    for (const item of itemViews) {
      if (item.actualQuantity === null) {
        unrecordedCount++;
      } else if (item.status === STOCKTAKING_ITEM_STATUS.SURPLUS) {
        surplusCount++;
      } else if (item.status === STOCKTAKING_ITEM_STATUS.DEFICIT) {
        deficitCount++;
      } else if (item.status === STOCKTAKING_ITEM_STATUS.MATCH) {
        matchCount++;
      }
    }

    return {
      taskId,
      totalItems: itemViews.length,
      surplusCount,
      deficitCount,
      matchCount,
      unrecordedCount,
      items: itemViews,
    };
  }

  /**
   * 确认盘点结果
   * 在事务中将库存数量调整为实际数量，为每个变化的库存单元记录操作日志，
   * 更新任务状态为"已完成"
   *
   * @param taskId 盘点任务 ID
   */
  confirm(taskId: string): void {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      // 获取所有盘点项
      const items = db
        .select()
        .from(stocktakingItems)
        .where(eq(stocktakingItems.taskId, taskId))
        .all();

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      for (const item of items) {
        // 跳过未录入实际数量的项
        if (item.actualQuantity === null) {
          continue;
        }

        // 只处理有差异的项
        if (item.variance !== null && item.variance !== 0) {
          // 使用 StockService.adjustStock 调整库存
          // delta = 实际数量 - 系统数量 = variance
          stockService.adjustStock(
            item.bookId,
            item.editionId,
            item.locationId,
            item.variance,
          );

          // 使用 LogService.create 记录操作日志（类型为"盘点调整"）
          logService.create(
            OPERATION_TYPES.STOCKTAKING_ADJUST as 'stocktaking_adjust',
            ENTITY_TYPES.STOCK as 'stock',
            `${item.bookId}:${item.editionId}:${item.locationId}`,
            { systemQuantity: item.systemQuantity },
            { actualQuantity: item.actualQuantity },
          );
        }
      }

      // 更新任务状态为"已完成"
      db.update(stocktakingTasks)
        .set({
          status: STOCKTAKING_STATUS.COMPLETED,
          completedAt: now,
        })
        .where(eq(stocktakingTasks.id, taskId))
        .run();
    });

    transaction();
  }

  /**
   * 返回所有盘点任务列表
   *
   * @returns 盘点任务列表
   */
  list(): StocktakingTask[] {
    const db = getDatabase();

    const tasks = db
      .select()
      .from(stocktakingTasks)
      .all();

    return tasks as StocktakingTask[];
  }

  /**
   * 返回盘点任务详情（含所有盘点项及关联信息）
   *
   * @param taskId 盘点任务 ID
   * @returns 盘点详情
   */
  getDetail(taskId: string): StocktakingDetail {
    const db = getDatabase();

    // 获取盘点任务
    const task = db
      .select()
      .from(stocktakingTasks)
      .where(eq(stocktakingTasks.id, taskId))
      .get();

    if (!task) {
      throw new Error('盘点任务不存在');
    }

    // 获取所有盘点项及关联信息
    const items = db
      .select({
        id: stocktakingItems.id,
        taskId: stocktakingItems.taskId,
        bookId: stocktakingItems.bookId,
        editionId: stocktakingItems.editionId,
        locationId: stocktakingItems.locationId,
        systemQuantity: stocktakingItems.systemQuantity,
        actualQuantity: stocktakingItems.actualQuantity,
        variance: stocktakingItems.variance,
        status: stocktakingItems.status,
        bookTitle: books.title,
        editionName: editions.name,
        warehouse: locations.warehouse,
        shelf: locations.shelf,
        layer: locations.layer,
      })
      .from(stocktakingItems)
      .innerJoin(books, eq(stocktakingItems.bookId, books.id))
      .innerJoin(editions, eq(stocktakingItems.editionId, editions.id))
      .innerJoin(locations, eq(stocktakingItems.locationId, locations.id))
      .where(eq(stocktakingItems.taskId, taskId))
      .all();

    const itemViews: StocktakingItemView[] = items.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      bookId: item.bookId,
      editionId: item.editionId,
      locationId: item.locationId,
      systemQuantity: item.systemQuantity,
      actualQuantity: item.actualQuantity,
      variance: item.variance,
      status: item.status as StocktakingItemView['status'],
      bookTitle: item.bookTitle,
      editionName: item.editionName,
      warehouse: item.warehouse,
      shelf: item.shelf,
      layer: item.layer,
    }));

    return {
      task: task as StocktakingTask,
      items: itemViews,
    };
  }
}
