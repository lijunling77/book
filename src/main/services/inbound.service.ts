/**
 * InboundService - 入库管理服务
 * 提供入库记录的创建、更新、删除、列表查询和批量创建功能
 * 所有库存变更操作在事务中执行，确保数据一致性
 */

import { eq, and, gte, lte, count, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getSqliteDatabase } from '../db';
import {
  inboundRecords,
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

export class InboundService {
  /**
   * 创建入库记录
   * 在事务中：
   * 1. 校验书籍、版本、位置存在性
   * 2. 创建入库记录
   * 3. 增加对应位置的库存数量（使用 StockService.adjustStock）
   * 4. 记录操作日志
   */
  create(input: CreateInboundInput): InboundRecord {
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

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const id = uuidv4();

      const newRecord: typeof inboundRecords.$inferInsert = {
        id,
        bookId: input.bookId,
        editionId: input.editionId ?? null,
        locationId: input.locationId,
        inboundDate: input.inboundDate,
        quantity: input.quantity,
        purchasePrice: input.purchasePrice,
        supplier: input.supplier ?? null,
        createdAt: now,
        updatedAt: now,
      };

      db.insert(inboundRecords).values(newRecord).run();

      // 增加库存数量
      stockService.adjustStock(
        input.bookId,
        input.editionId ?? null,
        input.locationId,
        input.quantity,
      );

      const created = db
        .select()
        .from(inboundRecords)
        .where(eq(inboundRecords.id, id))
        .get()!;

      // 记录操作日志
      logOperation(
        OPERATION_TYPES.CREATE,
        ENTITY_TYPES.INBOUND_RECORD,
        id,
        null,
        created,
      );

      return created as InboundRecord;
    });

    return transaction();
  }

  /**
   * 更新入库记录
   * 在事务中：
   * 1. 获取原记录
   * 2. 禁止修改书籍标识和版本标识
   * 3. 如位置变更：原位置减库存，新位置加库存
   * 4. 如数量变更：调整库存差值
   * 5. 校验库存不为负
   * 6. 更新记录
   * 7. 记录操作日志
   */
  update(id: string, input: UpdateInboundInput): InboundRecord {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      // 获取原记录
      const existing = db
        .select()
        .from(inboundRecords)
        .where(eq(inboundRecords.id, id))
        .get();
      if (!existing) {
        throw new Error('入库记录不存在');
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
        // 位置和数量都变更：原位置减去原数量，新位置加上新数量
        stockService.adjustStock(
          existing.bookId,
          existing.editionId ?? null,
          existing.locationId,
          -existing.quantity,
        );
        stockService.adjustStock(
          existing.bookId,
          existing.editionId ?? null,
          newLocationId,
          newQuantity,
        );
      } else if (locationChanged) {
        // 仅位置变更：原位置减库存，新位置加库存（数量不变）
        stockService.adjustStock(
          existing.bookId,
          existing.editionId ?? null,
          existing.locationId,
          -existing.quantity,
        );
        stockService.adjustStock(
          existing.bookId,
          existing.editionId ?? null,
          newLocationId,
          existing.quantity,
        );
      } else if (quantityChanged) {
        // 仅数量变更：调整库存差值
        const delta = newQuantity - existing.quantity;
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

      // 记录操作日志
      logOperation(
        OPERATION_TYPES.EDIT,
        ENTITY_TYPES.INBOUND_RECORD,
        id,
        beforeData,
        updated,
      );

      return updated as InboundRecord;
    });

    return transaction();
  }

  /**
   * 删除入库记录
   * 在事务中：
   * 1. 获取原记录
   * 2. 校验减少库存后不为负
   * 3. 减少库存
   * 4. 删除记录
   * 5. 记录操作日志
   * 返回删除前的记录信息和库存变更预览
   */
  delete(id: string): { record: InboundRecord; stockChange: { bookId: string; editionId: string | null; locationId: string; currentQuantity: number; changeQuantity: number } } {
    const sqliteDb = getSqliteDatabase();
    const db = getDatabase();

    const transaction = sqliteDb.transaction(() => {
      // 获取原记录
      const existing = db
        .select()
        .from(inboundRecords)
        .where(eq(inboundRecords.id, id))
        .get();
      if (!existing) {
        throw new Error('入库记录不存在');
      }

      const beforeData = { ...existing };

      // 获取当前库存数量（用于返回预览信息）
      const currentQuantity = stockService.getStockQuantity(
        existing.bookId,
        existing.editionId ?? null,
        existing.locationId,
      );

      // 减少库存（adjustStock 内部会校验不为负）
      stockService.adjustStock(
        existing.bookId,
        existing.editionId ?? null,
        existing.locationId,
        -existing.quantity,
      );

      // 删除记录
      db.delete(inboundRecords).where(eq(inboundRecords.id, id)).run();

      // 记录操作日志
      logOperation(
        OPERATION_TYPES.DELETE,
        ENTITY_TYPES.INBOUND_RECORD,
        id,
        beforeData,
        null,
      );

      return {
        record: existing as InboundRecord,
        stockChange: {
          bookId: existing.bookId,
          editionId: existing.editionId,
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
   * 支持按书籍标识、版本标识、日期范围、位置筛选，分页查询
   * JOIN books, editions, locations 表获取关联信息
   * 返回 PaginatedResult<InboundRecordView>
   */
  list(filter?: InboundFilter): PaginatedResult<InboundRecordView> {
    const db = getDatabase();
    const page = filter?.page ?? DEFAULT_PAGE;
    const pageSize = filter?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    // 构建 WHERE 条件
    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookId) {
      conditions.push(eq(inboundRecords.bookId, filter.bookId));
    }
    if (filter?.editionId) {
      conditions.push(eq(inboundRecords.editionId, filter.editionId));
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

    // 查询总数
    const countQuery = db
      .select({ count: count() })
      .from(inboundRecords)
      .innerJoin(books, eq(inboundRecords.bookId, books.id))
      .leftJoin(editions, eq(inboundRecords.editionId, editions.id))
      .innerJoin(locations, eq(inboundRecords.locationId, locations.id));

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const totalResult = countQuery.get();
    const total = totalResult?.count ?? 0;

    // 查询分页数据
    const dataQuery = db
      .select({
        id: inboundRecords.id,
        bookId: inboundRecords.bookId,
        editionId: inboundRecords.editionId,
        locationId: inboundRecords.locationId,
        inboundDate: inboundRecords.inboundDate,
        quantity: inboundRecords.quantity,
        purchasePrice: inboundRecords.purchasePrice,
        supplier: inboundRecords.supplier,
        createdAt: inboundRecords.createdAt,
        updatedAt: inboundRecords.updatedAt,
        bookTitle: books.title,
        editionName: editions.name,
        warehouse: locations.warehouse,
        shelf: locations.shelf,
        layer: locations.layer,
      })
      .from(inboundRecords)
      .innerJoin(books, eq(inboundRecords.bookId, books.id))
      .leftJoin(editions, eq(inboundRecords.editionId, editions.id))
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
      editionId: row.editionId,
      locationId: row.locationId,
      inboundDate: row.inboundDate,
      quantity: row.quantity,
      purchasePrice: row.purchasePrice,
      supplier: row.supplier,
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
   * 批量创建入库记录
   * 逐条独立校验和执行，失败记录跳过继续处理
   * 返回 BatchResultSummary
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
