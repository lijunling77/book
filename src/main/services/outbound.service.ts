/**
 * OutboundService - 出库管理服务
 * 提供出库记录的创建、更新、删除、列表查询和批量创建功能
 */

import { eq, and, gte, lte, count, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getSqliteDatabase } from '../db';
import {
  outboundRecords,
  books,
  locations,
} from '../db/schema';
import {
  ERROR_MESSAGES,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
} from '../../shared/constants';
import { StockService } from './stock.service';
import type {
  OutboundRecord,
  OutboundRecordView,
  CreateOutboundInput,
  UpdateOutboundInput,
  OutboundFilter,
  PaginatedResult,
  BatchResultSummary,
} from '../../shared/types';

const stockService = new StockService();

export class OutboundService {
  /**
   * 创建出库记录
   */
  create(input: CreateOutboundInput): OutboundRecord {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      const book = db.select().from(books).where(eq(books.id, input.bookId)).get();
      if (!book) {
        throw new Error(ERROR_MESSAGES.BOOK_NOT_FOUND);
      }

      const location = db
        .select()
        .from(locations)
        .where(eq(locations.id, input.locationId))
        .get();
      if (!location) {
        throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);
      }

      const currentQuantity = stockService.getStockQuantity(
        input.bookId,
        input.locationId,
      );
      if (currentQuantity < input.quantity) {
        throw new Error(
          `${ERROR_MESSAGES.INSUFFICIENT_STOCK}，当前可用库存数量：${currentQuantity}`,
        );
      }

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const id = uuidv4();

      const newRecord: typeof outboundRecords.$inferInsert = {
        id,
        bookId: input.bookId,
        locationId: input.locationId,
        outboundDate: input.outboundDate,
        quantity: input.quantity,
        sellingPrice: input.sellingPrice,
        buyer: input.buyer ?? null,
        createdAt: now,
        updatedAt: now,
      };

      db.insert(outboundRecords).values(newRecord).run();

      stockService.adjustStock(
        input.bookId,
        input.locationId,
        -input.quantity,
      );

      const created = db
        .select()
        .from(outboundRecords)
        .where(eq(outboundRecords.id, id))
        .get()!;

      return created as OutboundRecord;
    });

    return transaction();
  }

  /**
   * 更新出库记录
   */
  update(id: string, input: UpdateOutboundInput): OutboundRecord {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      const existing = db
        .select()
        .from(outboundRecords)
        .where(eq(outboundRecords.id, id))
        .get();
      if (!existing) {
        throw new Error('出库记录不存在');
      }

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const newLocationId = input.locationId ?? existing.locationId;
      const newQuantity = input.quantity ?? existing.quantity;
      const locationChanged = input.locationId !== undefined && input.locationId !== existing.locationId;
      const quantityChanged = input.quantity !== undefined && input.quantity !== existing.quantity;

      if (locationChanged) {
        const location = db
          .select()
          .from(locations)
          .where(eq(locations.id, newLocationId))
          .get();
        if (!location) {
          throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);
        }
      }

      if (locationChanged && quantityChanged) {
        stockService.adjustStock(existing.bookId, existing.locationId, existing.quantity);
        stockService.adjustStock(existing.bookId, newLocationId, -newQuantity);
      } else if (locationChanged) {
        stockService.adjustStock(existing.bookId, existing.locationId, existing.quantity);
        stockService.adjustStock(existing.bookId, newLocationId, -existing.quantity);
      } else if (quantityChanged) {
        const delta = existing.quantity - newQuantity;
        stockService.adjustStock(existing.bookId, existing.locationId, delta);
      }

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (input.locationId !== undefined) updateData.locationId = input.locationId;
      if (input.outboundDate !== undefined) updateData.outboundDate = input.outboundDate;
      if (input.quantity !== undefined) updateData.quantity = input.quantity;
      if (input.sellingPrice !== undefined) updateData.sellingPrice = input.sellingPrice;
      if (input.buyer !== undefined) updateData.buyer = input.buyer;

      db.update(outboundRecords)
        .set(updateData)
        .where(eq(outboundRecords.id, id))
        .run();

      const updated = db
        .select()
        .from(outboundRecords)
        .where(eq(outboundRecords.id, id))
        .get()!;

      return updated as OutboundRecord;
    });

    return transaction();
  }

  /**
   * 删除出库记录
   */
  delete(id: string): { record: OutboundRecord; stockChange: { bookId: string; locationId: string; currentQuantity: number; changeQuantity: number } } {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      const existing = db
        .select()
        .from(outboundRecords)
        .where(eq(outboundRecords.id, id))
        .get();
      if (!existing) {
        throw new Error('出库记录不存在');
      }

      const currentQuantity = stockService.getStockQuantity(
        existing.bookId,
        existing.locationId,
      );

      stockService.adjustStock(
        existing.bookId,
        existing.locationId,
        existing.quantity,
      );

      db.delete(outboundRecords).where(eq(outboundRecords.id, id)).run();

      return {
        record: existing as OutboundRecord,
        stockChange: {
          bookId: existing.bookId,
          locationId: existing.locationId,
          currentQuantity,
          changeQuantity: existing.quantity,
        },
      };
    });

    return transaction();
  }

  /**
   * 出库记录列表查询
   */
  list(filter?: OutboundFilter): PaginatedResult<OutboundRecordView> {
    const db = getDatabase();
    const page = filter?.page ?? DEFAULT_PAGE;
    const pageSize = filter?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookId) {
      conditions.push(eq(outboundRecords.bookId, filter.bookId));
    }
    if (filter?.locationId) {
      conditions.push(eq(outboundRecords.locationId, filter.locationId));
    }
    if (filter?.dateRange?.startDate) {
      conditions.push(gte(outboundRecords.outboundDate, filter.dateRange.startDate));
    }
    if (filter?.dateRange?.endDate) {
      conditions.push(lte(outboundRecords.outboundDate, filter.dateRange.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = db
      .select({ count: count() })
      .from(outboundRecords)
      .innerJoin(books, eq(outboundRecords.bookId, books.id))
      .innerJoin(locations, eq(outboundRecords.locationId, locations.id));

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const totalResult = countQuery.get();
    const total = totalResult?.count ?? 0;

    const dataQuery = db
      .select({
        id: outboundRecords.id,
        bookId: outboundRecords.bookId,
        locationId: outboundRecords.locationId,
        outboundDate: outboundRecords.outboundDate,
        quantity: outboundRecords.quantity,
        sellingPrice: outboundRecords.sellingPrice,
        buyer: outboundRecords.buyer,
        createdAt: outboundRecords.createdAt,
        updatedAt: outboundRecords.updatedAt,
        bookTitle: books.title,
        warehouse: locations.warehouse,
        shelf: locations.shelf,
        layer: locations.layer,
      })
      .from(outboundRecords)
      .innerJoin(books, eq(outboundRecords.bookId, books.id))
      .innerJoin(locations, eq(outboundRecords.locationId, locations.id));

    if (whereClause) {
      dataQuery.where(whereClause);
    }

    const rows = dataQuery
      .orderBy(sql`${outboundRecords.outboundDate} DESC, ${outboundRecords.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)
      .all();

    const data: OutboundRecordView[] = rows.map((row) => ({
      id: row.id,
      bookId: row.bookId,
      locationId: row.locationId,
      outboundDate: row.outboundDate,
      quantity: row.quantity,
      sellingPrice: row.sellingPrice,
      buyer: row.buyer,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      bookTitle: row.bookTitle,
      warehouse: row.warehouse,
      shelf: row.shelf,
      layer: row.layer,
    }));

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 批量创建出库记录
   */
  batchCreate(inputs: CreateOutboundInput[]): BatchResultSummary {
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
