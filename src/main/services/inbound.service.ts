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
  locations,
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

      const location = db
        .select()
        .from(locations)
        .where(eq(locations.id, input.locationId))
        .get();
      if (!location) {
        throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);
      }

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const id = uuidv4();

      const newRecord: typeof inboundRecords.$inferInsert = {
        id,
        bookId: input.bookId,
        locationId: input.locationId,
        inboundDate: input.inboundDate,
        quantity: input.quantity,
        purchasePrice: input.purchasePrice,
        supplier: input.supplier ?? null,
        createdAt: now,
        updatedAt: now,
      };

      db.insert(inboundRecords).values(newRecord).run();

      stockService.adjustStock(
        input.bookId,
        input.locationId,
        input.quantity,
      );

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

      const newLocationId = input.locationId ?? existing.locationId;
      const newQuantity = input.quantity ?? existing.quantity;

      const locationChanged = input.locationId !== undefined && input.locationId !== existing.locationId;
      const quantityChanged = input.quantity !== undefined && input.quantity !== existing.quantity;

      if (locationChanged) {
        const location = db.select().from(locations).where(eq(locations.id, newLocationId)).get();
        if (!location) {
          throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);
        }
      }

      if (locationChanged || quantityChanged) {
        // 回退原库存
        stockService.adjustStock(
          existing.bookId,
          existing.locationId,
          -existing.quantity,
        );
        // 按新值重建库存
        stockService.adjustStock(
          existing.bookId,
          newLocationId,
          newQuantity,
        );
      }

      const updateData: Record<string, unknown> = { updatedAt: now };
      if (input.locationId !== undefined) updateData.locationId = input.locationId;
      if (input.inboundDate !== undefined) updateData.inboundDate = input.inboundDate;
      if (input.quantity !== undefined) updateData.quantity = input.quantity;
      if (input.purchasePrice !== undefined) updateData.purchasePrice = input.purchasePrice;
      if (input.supplier !== undefined) updateData.supplier = input.supplier;

      db.update(inboundRecords)
        .set(updateData)
        .where(eq(inboundRecords.id, id))
        .run();

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
  delete(id: string): { record: InboundRecord; stockChange: { bookId: string; locationId: string; currentQuantity: number; changeQuantity: number } } {
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

      const currentQuantity = stockService.getStockQuantity(
        existing.bookId,
        existing.locationId,
      );

      stockService.adjustStock(
        existing.bookId,
        existing.locationId,
        -existing.quantity,
      );

      db.delete(inboundRecords).where(eq(inboundRecords.id, id)).run();

      return {
        record: existing as InboundRecord,
        stockChange: {
          bookId: existing.bookId,
          locationId: existing.locationId,
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
    if (filter?.locationId) {
      conditions.push(eq(inboundRecords.locationId, filter.locationId));
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
      .innerJoin(books, eq(inboundRecords.bookId, books.id))
      .innerJoin(locations, eq(inboundRecords.locationId, locations.id));

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const totalResult = countQuery.get();
    const total = totalResult?.count ?? 0;

    const dataQuery = db
      .select({
        id: inboundRecords.id,
        bookId: inboundRecords.bookId,
        locationId: inboundRecords.locationId,
        inboundDate: inboundRecords.inboundDate,
        quantity: inboundRecords.quantity,
        purchasePrice: inboundRecords.purchasePrice,
        supplier: inboundRecords.supplier,
        createdAt: inboundRecords.createdAt,
        updatedAt: inboundRecords.updatedAt,
        bookTitle: books.title,
        warehouse: locations.warehouse,
        shelf: locations.shelf,
        layer: locations.layer,
      })
      .from(inboundRecords)
      .innerJoin(books, eq(inboundRecords.bookId, books.id))
      .innerJoin(locations, eq(inboundRecords.locationId, locations.id));

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
      locationId: row.locationId,
      inboundDate: row.inboundDate,
      quantity: row.quantity,
      purchasePrice: row.purchasePrice,
      supplier: row.supplier,
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
