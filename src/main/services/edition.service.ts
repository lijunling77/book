/**
 * EditionService - 版本管理服务
 * 提供版本的创建、更新和删除功能
 */

import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { editions, stock, editionImages, operationLogs } from '../db/schema';
import { ERROR_MESSAGES, OPERATION_TYPES, ENTITY_TYPES } from '../../shared/constants';
import type {
  Edition,
  CreateEditionInput,
  UpdateEditionInput,
} from '../../shared/types';
import fs from 'fs';

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
  db.insert(operationLogs).values({
    id: uuidv4(),
    operationType,
    entityType,
    entityId,
    beforeData: beforeData ? JSON.stringify(beforeData) : null,
    afterData: afterData ? JSON.stringify(afterData) : null,
  }).run();
}

export class EditionService {
  /**
   * 创建版本
   * 1. 校验同一 bookId 下版本名称唯一性
   * 2. 创建版本记录并关联书籍
   * 3. 记录操作日志
   */
  create(input: CreateEditionInput): Edition {
    const db = getDatabase();

    // 校验同一 bookId 下版本名称唯一性
    const existing = db
      .select()
      .from(editions)
      .where(and(eq(editions.bookId, input.bookId), eq(editions.name, input.name)))
      .get();

    if (existing) {
      throw new Error(ERROR_MESSAGES.EDITION_ALREADY_EXISTS);
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = uuidv4();

    const newEdition: typeof editions.$inferInsert = {
      id,
      bookId: input.bookId,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(editions).values(newEdition).run();

    const created = db.select().from(editions).where(eq(editions.id, id)).get()!;

    // 记录操作日志
    logOperation(OPERATION_TYPES.CREATE, ENTITY_TYPES.EDITION, id, null, created);

    return created as Edition;
  }

  /**
   * 更新版本信息
   * 1. 更新版本信息
   * 2. 记录修改时间戳
   * 3. 记录操作日志
   */
  update(id: string, input: UpdateEditionInput): Edition {
    const db = getDatabase();

    // 查找现有版本
    const existing = db.select().from(editions).where(eq(editions.id, id)).get();
    if (!existing) {
      throw new Error(ERROR_MESSAGES.EDITION_NOT_FOUND);
    }

    const beforeData = { ...existing };
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 如果更新了名称，校验同一 bookId 下名称唯一性
    if (input.name !== undefined && input.name !== existing.name) {
      const duplicate = db
        .select()
        .from(editions)
        .where(and(eq(editions.bookId, existing.bookId), eq(editions.name, input.name)))
        .get();

      if (duplicate) {
        throw new Error(ERROR_MESSAGES.EDITION_ALREADY_EXISTS);
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: now };
    if (input.name !== undefined) updateData.name = input.name;

    db.update(editions).set(updateData).where(eq(editions.id, id)).run();

    const updated = db.select().from(editions).where(eq(editions.id, id)).get()!;

    // 记录操作日志
    logOperation(OPERATION_TYPES.EDIT, ENTITY_TYPES.EDITION, id, beforeData, updated);

    return updated as Edition;
  }

  /**
   * 删除版本
   * 1. 校验版本库存数量，有库存 > 0 时拒绝删除并返回关联库存列表
   * 2. 删除时同时删除关联图片文件
   * 3. 记录操作日志
   */
  delete(id: string): void {
    const db = getDatabase();

    // 查找现有版本
    const existing = db.select().from(editions).where(eq(editions.id, id)).get();
    if (!existing) {
      throw new Error(ERROR_MESSAGES.EDITION_NOT_FOUND);
    }

    // 查询该版本的库存记录，检查是否有库存 > 0
    const stockRecords = db
      .select({
        stockId: stock.id,
        editionId: stock.editionId,
        locationId: stock.locationId,
        quantity: stock.quantity,
      })
      .from(stock)
      .where(eq(stock.editionId, id))
      .all();

    const nonZeroStock = stockRecords.filter((s) => s.quantity > 0);
    if (nonZeroStock.length > 0) {
      const error = new Error(ERROR_MESSAGES.EDITION_HAS_STOCK) as Error & { stockList?: unknown[] };
      error.stockList = nonZeroStock;
      throw error;
    }

    // 删除关联图片文件
    const edImage = db.select().from(editionImages).where(eq(editionImages.editionId, id)).get();
    if (edImage) {
      try {
        if (fs.existsSync(edImage.filePath)) fs.unlinkSync(edImage.filePath);
        if (fs.existsSync(edImage.thumbnailPath)) fs.unlinkSync(edImage.thumbnailPath);
      } catch {
        // 图片文件删除失败不阻塞版本删除
      }
    }

    const beforeData = { ...existing };

    // 删除关联的库存记录（quantity 为 0 的记录）
    db.delete(stock).where(eq(stock.editionId, id)).run();

    // 删除版本（级联删除图片记录）
    db.delete(editions).where(eq(editions.id, id)).run();

    // 记录操作日志
    logOperation(OPERATION_TYPES.DELETE, ENTITY_TYPES.EDITION, id, beforeData, null);
  }
}
