/**
 * StocktakingService - 库存盘点服务
 * 支持按位置选择盘点范围
 */

import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getSqliteDatabase } from '../db';
import {
  stocktakingTasks,
  stocktakingItems,
  stock,
  books,
  locations,
  inboundRecords,
  outboundRecords,
} from '../db/schema';
import {
  ERROR_MESSAGES,
  STOCKTAKING_STATUS,
  STOCKTAKING_ITEM_STATUS,
} from '../../shared/constants';
import { StockService } from './stock.service';
import type {
  StocktakingTask,
  StocktakingDetail,
  StocktakingItemView,
  StocktakingReport,
  CreateStocktakingInput,
  ActualQuantityInput,
} from '../../shared/types';

const stockService = new StockService();

export class StocktakingService {
  create(input: CreateStocktakingInput): StocktakingTask {
    const db = getDatabase();
    const sqliteDb = getSqliteDatabase();

    const transaction = sqliteDb.transaction(() => {
      const stockRecords = db
        .select({
          bookId: stock.bookId,
          locationId: stock.locationId,
          quantity: stock.quantity,
        })
        .from(stock)
        .where(eq(stock.locationId, input.scopeValue))
        .all();

      if (stockRecords.length === 0) {
        throw new Error(ERROR_MESSAGES.NO_STOCK_IN_SCOPE);
      }

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

      for (const record of stockRecords) {
        db.insert(stocktakingItems)
          .values({
            id: uuidv4(),
            taskId,
            bookId: record.bookId,
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

  recordActual(taskId: string, items: ActualQuantityInput[]): void {
    const db = getDatabase();

    for (const item of items) {
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

      if (!existing) continue;

      const variance = item.actualQuantity - existing.systemQuantity;
      let status: string;
      if (variance > 0) {
        status = STOCKTAKING_ITEM_STATUS.SURPLUS;
      } else if (variance < 0) {
        status = STOCKTAKING_ITEM_STATUS.DEFICIT;
      } else {
        status = STOCKTAKING_ITEM_STATUS.MATCH;
      }

      db.update(stocktakingItems)
        .set({ actualQuantity: item.actualQuantity, variance, status })
        .where(eq(stocktakingItems.id, item.itemId))
        .run();
    }
  }

  submit(taskId: string): StocktakingReport {
    const db = getDatabase();

    const items = db
      .select({
        id: stocktakingItems.id,
        taskId: stocktakingItems.taskId,
        bookId: stocktakingItems.bookId,
        locationId: stocktakingItems.locationId,
        systemQuantity: stocktakingItems.systemQuantity,
        actualQuantity: stocktakingItems.actualQuantity,
        variance: stocktakingItems.variance,
        status: stocktakingItems.status,
        bookTitle: books.title,
        warehouse: locations.warehouse,
        shelf: locations.shelf,
        layer: locations.layer,
      })
      .from(stocktakingItems)
      .innerJoin(books, eq(stocktakingItems.bookId, books.id))
      .innerJoin(locations, eq(stocktakingItems.locationId, locations.id))
      .where(eq(stocktakingItems.taskId, taskId))
      .all();

    const itemViews: StocktakingItemView[] = items.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      bookId: item.bookId,
      locationId: item.locationId,
      systemQuantity: item.systemQuantity,
      actualQuantity: item.actualQuantity,
      variance: item.variance,
      status: item.status as StocktakingItemView['status'],
      bookTitle: item.bookTitle,
      warehouse: item.warehouse,
      shelf: item.shelf,
      layer: item.layer,
    }));

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

    return { taskId, totalItems: itemViews.length, surplusCount, deficitCount, matchCount, unrecordedCount, items: itemViews };
  }

  confirm(taskId: string): void {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      const items = db
        .select()
        .from(stocktakingItems)
        .where(eq(stocktakingItems.taskId, taskId))
        .all();

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const today = now.substring(0, 10);

      for (const item of items) {
        if (item.actualQuantity === null) continue;
        if (item.variance !== null && item.variance !== 0) {
          // 调整库存
          stockService.adjustStock(item.bookId, item.locationId, item.variance);

          if (item.variance > 0) {
            // 盘盈：生成入库记录（价格为0，供应商标记为盘点调整）
            db.insert(inboundRecords).values({
              id: uuidv4(),
              bookId: item.bookId,
              locationId: item.locationId,
              inboundDate: today,
              quantity: item.variance,
              purchasePrice: 0,
              supplier: '盘点调整（盘盈）',
              createdAt: now,
              updatedAt: now,
            }).run();
          } else {
            // 盘亏：生成出库记录（价格为0，买家标记为盘点调整）
            db.insert(outboundRecords).values({
              id: uuidv4(),
              bookId: item.bookId,
              locationId: item.locationId,
              outboundDate: today,
              quantity: Math.abs(item.variance),
              sellingPrice: 0,
              buyer: '盘点调整（盘亏）',
              createdAt: now,
              updatedAt: now,
            }).run();
          }
        }
      }

      db.update(stocktakingTasks)
        .set({ status: STOCKTAKING_STATUS.COMPLETED, completedAt: now })
        .where(eq(stocktakingTasks.id, taskId))
        .run();
    });

    transaction();
  }

  list(): StocktakingTask[] {
    const db = getDatabase();
    return db.select().from(stocktakingTasks).all() as StocktakingTask[];
  }

  getDetail(taskId: string): StocktakingDetail {
    const db = getDatabase();

    const task = db
      .select()
      .from(stocktakingTasks)
      .where(eq(stocktakingTasks.id, taskId))
      .get();

    if (!task) throw new Error('盘点任务不存在');

    const items = db
      .select({
        id: stocktakingItems.id,
        taskId: stocktakingItems.taskId,
        bookId: stocktakingItems.bookId,
        locationId: stocktakingItems.locationId,
        systemQuantity: stocktakingItems.systemQuantity,
        actualQuantity: stocktakingItems.actualQuantity,
        variance: stocktakingItems.variance,
        status: stocktakingItems.status,
        bookTitle: books.title,
        warehouse: locations.warehouse,
        shelf: locations.shelf,
        layer: locations.layer,
      })
      .from(stocktakingItems)
      .innerJoin(books, eq(stocktakingItems.bookId, books.id))
      .innerJoin(locations, eq(stocktakingItems.locationId, locations.id))
      .where(eq(stocktakingItems.taskId, taskId))
      .all();

    const itemViews: StocktakingItemView[] = items.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      bookId: item.bookId,
      locationId: item.locationId,
      systemQuantity: item.systemQuantity,
      actualQuantity: item.actualQuantity,
      variance: item.variance,
      status: item.status as StocktakingItemView['status'],
      bookTitle: item.bookTitle,
      warehouse: item.warehouse,
      shelf: item.shelf,
      layer: item.layer,
    }));

    return { task: task as StocktakingTask, items: itemViews };
  }
}
