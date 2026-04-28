/**
 * OutboundService - 出库管理服务
 * 提供出库记录的创建、更新、删除、列表查询和批量创建功能
 * 所有库存变更操作在事务中执行，确保数据一致性
 * 出库操作减少库存数量，删除出库记录则增加库存数量（回退）
 */

import { eq, and, gte, lte, count, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getSqliteDatabase } from '../db';
import {
  outboundRecords,
  books,
  editions,
  locations,
  operationLogs,
} from '../db/schema';
import {
  ERROR_MESSAGES,
  OPERATION_TYPES,
  ENTITY_TYPES,
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

/**
 * 记录操作日志
 */
function logOperation(
  operationType: string,
  entityType: string,
  entityId: string,
  beforeData: unknown | null,
  afterData: unknown | null,
): void {
  const db = getDatabase();
  db.insert(operationLogs)
    .values({
      id: uuidv4(),
      operationType,
      entityType,
      entityId,
      beforeData: beforeData ? JSON.stringify(beforeData) : null,
      afterData: afterData ? JSON.stringify(afterData) : null,
    })
    .run();
}

export class OutboundService {
  /**
   * 创建出库记录
   * 在事务中：
   * 1. 校验书籍、版本、位置存在性
   * 2. 校验库存充足性（库存数量 >= 出库数量）
   * 3. 创建出库记录
   * 4. 减少对应位置的库存数量（使用 StockService.adjustStock）
   * 5. 记录操作日志
   */
  create(input: CreateOutboundInput): OutboundRecord {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      // 校验书籍存在性
      const book = db.select().from(books).where(eq(books.id, input.bookId)).get();
      if (!book) {
        throw new Error(ERROR_MESSAGES.BOOK_NOT_FOUND);
      }

      // 校验版本存在性
      if (input.editionId) {
        const edition = db
          .select()
          .from(editions)
          .where(eq(editions.id, input.editionId))
          .get();
        if (!edition) {
          throw new Error(ERROR_MESSAGES.EDITION_NOT_FOUND);
        }
      }

      // 校验位置存在性
      const location = db
        .select()
        .from(locations)
        .where(eq(locations.id, input.locationId))
        .get();
      if (!location) {
        throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);
      }

      // 校验库存充足性
      const currentQuantity = stockService.getStockQuantity(
        input.bookId,
        input.editionId ?? null,
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
        editionId: input.editionId ?? null,
        locationId: input.locationId,
        outboundDate: input.outboundDate,
        quantity: input.quantity,
        sellingPrice: input.sellingPrice,
        buyer: input.buyer ?? null,
        createdAt: now,
        updatedAt: now,
      };

      db.insert(outboundRecords).values(newRecord).run();

      // 减少库存数量
      stockService.adjustStock(
        input.bookId,
        input.editionId ?? null,
        input.locationId,
        -input.quantity,
      );

      const created = db
        .select()
        .from(outboundRecords)
        .where(eq(outboundRecords.id, id))
        .get()!;

      // 记录操作日志
      logOperation(
        OPERATION_TYPES.CREATE,
        ENTITY_TYPES.OUTBOUND_RECORD,
        id,
        null,
        created,
      );

      return created as OutboundRecord;
    });

    return transaction();
  }

  /**
   * 更新出库记录
   * 在事务中：
   * 1. 获取原记录
   * 2. 禁止修改书籍标识和版本标识
   * 3. 如位置变更：原位置加库存（回退出库），新位置减库存（重新出库）
   * 4. 如数量变更：调整库存差值（出库是减少，所以差值取反）
   * 5. 校验库存不为负
   * 6. 更新记录
   * 7. 记录操作日志
   */
  update(id: string, input: UpdateOutboundInput): OutboundRecord {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      // 获取原记录
      const existing = db
        .select()
        .from(outboundRecords)
        .where(eq(outboundRecords.id, id))
        .get();
      if (!existing) {
        throw new Error('出库记录不存在');
      }

      const beforeData = { ...existing };
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const newLocationId = input.locationId ?? existing.locationId;
      const newQuantity = input.quantity ?? existing.quantity;
      const locationChanged = input.locationId !== undefined && input.locationId !== existing.locationId;
      const quantityChanged = input.quantity !== undefined && input.quantity !== existing.quantity;

      // 校验新位置存在性（如果位置变更）
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
        // 位置和数量都变更：原位置回退原出库数量，新位置执行新出库数量
        stockService.adjustStock(
          existing.bookId,
          existing.editionId ?? null,
          existing.locationId,
          existing.quantity, // 原位置加回原数量
        );
        stockService.adjustStock(
          existing.bookId,
          existing.editionId ?? null,
          newLocationId,
          -newQuantity, // 新位置减去新数量
        );
      } else if (locationChanged) {
        // 仅位置变更：原位置加回库存，新位置减去库存（数量不变）
        stockService.adjustStock(
          existing.bookId,
          existing.editionId ?? null,
          existing.locationId,
          existing.quantity, // 原位置加回
        );
        stockService.adjustStock(
          existing.bookId,
          existing.editionId ?? null,
          newLocationId,
          -existing.quantity, // 新位置减去
        );
      } else if (quantityChanged) {
        // 仅数量变更：调整库存差值
        // 出库是减少库存，所以差值 = 原数量 - 新数量（正值表示库存增加，负值表示库存减少）
        const delta = existing.quantity - newQuantity;
        stockService.adjustStock(
          existing.bookId,
          existing.editionId ?? null,
          existing.locationId,
          delta,
        );
      }

      // 更新记录
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

      // 记录操作日志
      logOperation(
        OPERATION_TYPES.EDIT,
        ENTITY_TYPES.OUTBOUND_RECORD,
        id,
        beforeData,
        updated,
      );

      return updated as OutboundRecord;
    });

    return transaction();
  }

  /**
   * 删除出库记录
   * 在事务中：
   * 1. 获取原记录
   * 2. 增加库存数量（回退出库操作）
   * 3. 删除记录
   * 4. 记录操作日志
   * 返回删除前的记录信息和库存变更预览
   */
  delete(id: string): { record: OutboundRecord; stockChange: { bookId: string; editionId: string | null; locationId: string; currentQuantity: number; changeQuantity: number } } {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      // 获取原记录
      const existing = db
        .select()
        .from(outboundRecords)
        .where(eq(outboundRecords.id, id))
        .get();
      if (!existing) {
        throw new Error('出库记录不存在');
      }

      const beforeData = { ...existing };

      // 获取当前库存数量（用于返回预览信息）
      const currentQuantity = stockService.getStockQuantity(
        existing.bookId,
        existing.editionId ?? null,
        existing.locationId,
      );

      // 增加库存数量（回退出库操作）
      stockService.adjustStock(
        existing.bookId,
        existing.editionId ?? null,
        existing.locationId,
        existing.quantity, // 正数，增加库存
      );

      // 删除记录
      db.delete(outboundRecords).where(eq(outboundRecords.id, id)).run();

      // 记录操作日志
      logOperation(
        OPERATION_TYPES.DELETE,
        ENTITY_TYPES.OUTBOUND_RECORD,
        id,
        beforeData,
        null,
      );

      return {
        record: existing as OutboundRecord,
        stockChange: {
          bookId: existing.bookId,
          editionId: existing.editionId,
          locationId: existing.locationId,
          currentQuantity,
          changeQuantity: existing.quantity, // 正数，表示库存将增加
        },
      };
    });

    return transaction();
  }

  /**
   * 出库记录列表查询
   * 支持按书籍标识、版本标识、日期范围、位置筛选，分页查询
   * JOIN books, editions, locations 表获取关联信息
   * 返回 PaginatedResult<OutboundRecordView>
   */
  list(filter?: OutboundFilter): PaginatedResult<OutboundRecordView> {
    const db = getDatabase();
    const page = filter?.page ?? DEFAULT_PAGE;
    const pageSize = filter?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    // 构建 WHERE 条件
    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookId) {
      conditions.push(eq(outboundRecords.bookId, filter.bookId));
    }
    if (filter?.editionId) {
      conditions.push(eq(outboundRecords.editionId, filter.editionId));
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

    // 查询总数
    const countQuery = db
      .select({ count: count() })
      .from(outboundRecords)
      .innerJoin(books, eq(outboundRecords.bookId, books.id))
      .leftJoin(editions, eq(outboundRecords.editionId, editions.id))
      .innerJoin(locations, eq(outboundRecords.locationId, locations.id));

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const totalResult = countQuery.get();
    const total = totalResult?.count ?? 0;

    // 查询分页数据
    const dataQuery = db
      .select({
        id: outboundRecords.id,
        bookId: outboundRecords.bookId,
        editionId: outboundRecords.editionId,
        locationId: outboundRecords.locationId,
        outboundDate: outboundRecords.outboundDate,
        quantity: outboundRecords.quantity,
        sellingPrice: outboundRecords.sellingPrice,
        buyer: outboundRecords.buyer,
        createdAt: outboundRecords.createdAt,
        updatedAt: outboundRecords.updatedAt,
        bookTitle: books.title,
        editionName: editions.name,
        warehouse: locations.warehouse,
        shelf: locations.shelf,
        layer: locations.layer,
      })
      .from(outboundRecords)
      .innerJoin(books, eq(outboundRecords.bookId, books.id))
      .leftJoin(editions, eq(outboundRecords.editionId, editions.id))
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
      editionId: row.editionId,
      locationId: row.locationId,
      outboundDate: row.outboundDate,
      quantity: row.quantity,
      sellingPrice: row.sellingPrice,
      buyer: row.buyer,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      bookTitle: row.bookTitle,
      editionName: row.editionName ?? '',
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
   * 逐条独立校验和执行，失败记录跳过继续处理
   * 返回 BatchResultSummary
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
