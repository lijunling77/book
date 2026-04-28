/**
 * InboundService - 入库管理服务
 * 提供入库记录的创建、更新、删除、列表查询和批量创建功能
 */

import { eq, and, gte, lte, count, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getSqliteDatabase } from '../db';
import {
  inboundRecords,
  books,
  locationDict,
} from '../db/schema';
import {
  ERROR_MESSAGES,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
} from '../../shared/constants';
import { StockService } from './stock.service';
import type {
  InboundRecord,
  InboundRecordView,
  CreateInboundInput,
  UpdateInboundInput,
  InboundFilter,
  PaginatedResult,
  BatchResultSummary,
} from '../../shared/types';

const stockService = new StockService();

/**
 * 如果位置不在字典里，自动添加
 */
function syncLocationDict(location: string | null | undefined): void {
  if (!location || !location.trim()) return;
  const db = getDatabase();
  const trimmed = location.trim();
  const existing = db.select().from(locationDict).where(eq(locationDict.name, trimmed)).get();
  if (!existing) {
    db.insert(locationDict).values({
      id: uuidv4(),
      name: trimmed,
    }).run();
  }
}

export class InboundService {
  /**
   * 创建入库记录
   */
  create(input: CreateInboundInput): InboundRecord {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      const book = db.select().from(books).where(eq(books.id, input.bookId)).get();
      if (!book) {
        throw new Error(ERROR_MESSAGES.BOOK_NOT_FOUND);
      }

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const id = uuidv4();

      const newRecord: typeof inboundRecords.$inferInsert = {
        id,
        bookId: input.bookId,
        inboundDate: input.inboundDate,
        quantity: input.quantity,
        purchasePrice: input.purchasePrice,
        supplier: input.supplier ?? null,
        location: input.location ?? null,
        createdAt: now,
        updatedAt: now,
      };

      db.insert(inboundRecords).values(newRecord).run();

      syncLocationDict(input.location);

      stockService.adjustStock(input.bookId, input.quantity);

      const created = db
        .select()
        .from(inboundRecords)
        .where(eq(inboundRecords.id, id))
        .get()!;

      return created as InboundRecord;
    });

    return transaction();
  }

  /**
   * 更新入库记录
   */
  update(id: string, input: UpdateInboundInput): InboundRecord {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      const existing = db
        .select()
        .from(inboundRecords)
        .where(eq(inboundRecords.id, id))
        .get();
      if (!existing) {
        throw new Error('入库记录不存在');
      }

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const newQuantity = input.quantity ?? existing.quantity;
      const quantityChanged = input.quantity !== undefined && input.quantity !== existing.quantity;

      if (quantityChanged) {
        const delta = newQuantity - existing.quantity;
        const currentQty = stockService.getStockQuantity(existing.bookId);
        if (currentQty + delta < 0) {
          throw new Error(`操作将导致库存数量为负（当前${currentQty}，调整${delta}）`);
        }
        stockService.adjustStock(existing.bookId, delta);
      }

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (input.inboundDate !== undefined) updateData.inboundDate = input.inboundDate;
      if (input.quantity !== undefined) updateData.quantity = input.quantity;
      if (input.purchasePrice !== undefined) updateData.purchasePrice = input.purchasePrice;
      if (input.supplier !== undefined) updateData.supplier = input.supplier;
      if (input.location !== undefined) updateData.location = input.location;

      db.update(inboundRecords)
        .set(updateData)
        .where(eq(inboundRecords.id, id))
        .run();

      if (input.location !== undefined) {
        syncLocationDict(input.location);
      }

      const updated = db
        .select()
        .from(inboundRecords)
        .where(eq(inboundRecords.id, id))
        .get()!;

      return updated as InboundRecord;
    });

    return transaction();
  }

  /**
   * 删除入库记录
   */
  delete(id: string): { record: InboundRecord; stockChange: { bookId: string; currentQuantity: number; changeQuantity: number } } {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      const existing = db
        .select()
        .from(inboundRecords)
        .where(eq(inboundRecords.id, id))
        .get();
      if (!existing) {
        throw new Error('入库记录不存在');
      }

      const currentQuantity = stockService.getStockQuantity(existing.bookId);

      stockService.adjustStock(existing.bookId, -existing.quantity);

      db.delete(inboundRecords).where(eq(inboundRecords.id, id)).run();

      return {
        record: existing as InboundRecord,
        stockChange: {
          bookId: existing.bookId,
          currentQuantity,
          changeQuantity: -existing.quantity,
        },
      };
    });

    return transaction();
  }

  /**
   * 入库记录列表查询
   */
  list(filter?: InboundFilter): PaginatedResult<InboundRecordView> {
    const db = getDatabase();
    const page = filter?.page ?? DEFAULT_PAGE;
    const pageSize = filter?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookId) {
      conditions.push(eq(inboundRecords.bookId, filter.bookId));
    }
    if (filter?.dateRange?.startDate) {
      conditions.push(gte(inboundRecords.inboundDate, filter.dateRange.startDate));
    }
    if (filter?.dateRange?.endDate) {
      conditions.push(lte(inboundRecords.inboundDate, filter.dateRange.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = db
      .select({ count: count() })
      .from(inboundRecords)
      .innerJoin(books, eq(inboundRecords.bookId, books.id));

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const totalResult = countQuery.get();
    const total = totalResult?.count ?? 0;

    const dataQuery = db
      .select({
        id: inboundRecords.id,
        bookId: inboundRecords.bookId,
        inboundDate: inboundRecords.inboundDate,
        quantity: inboundRecords.quantity,
        purchasePrice: inboundRecords.purchasePrice,
        supplier: inboundRecords.supplier,
        location: inboundRecords.location,
        createdAt: inboundRecords.createdAt,
        updatedAt: inboundRecords.updatedAt,
        bookTitle: books.title,
      })
      .from(inboundRecords)
      .innerJoin(books, eq(inboundRecords.bookId, books.id));

    if (whereClause) {
      dataQuery.where(whereClause);
    }

    const rows = dataQuery
      .orderBy(sql`${inboundRecords.inboundDate} DESC, ${inboundRecords.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)
      .all();

    const data: InboundRecordView[] = rows.map((row) => ({
      id: row.id,
      bookId: row.bookId,
      inboundDate: row.inboundDate,
      quantity: row.quantity,
      purchasePrice: row.purchasePrice,
      supplier: row.supplier,
      location: row.location,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      bookTitle: row.bookTitle,
    }));

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 批量创建入库记录
   */
  batchCreate(inputs: CreateInboundInput[]): BatchResultSummary {
    const result: BatchResultSummary = {
      totalCount: inputs.length,
      successCount: 0,
      failureCount: 0,
      failures: [],
    };

    for (let i = 0; i < inputs.length; i++) {
      try {
        this.create(inputs[i]);
        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.failures.push({
          index: i,
          reason: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    return result;
  }
}
