/**
 * LocationService - 位置管理服务
 * 提供位置的 CRUD、库存查询功能
 */

import { eq, and, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { locations, stock, books, editions, operationLogs } from '../db/schema';
import { ERROR_MESSAGES, OPERATION_TYPES, ENTITY_TYPES } from '../../shared/constants';
import type {
  Location,
  CreateLocationInput,
  UpdateLocationInput,
  StockUnitAtLocation,
} from '../../shared/types';

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

export class LocationService {
  /**
   * 创建位置
   * 1. 校验仓库+书架+层号组合唯一性
   * 2. 创建位置记录
   * 3. 记录操作日志
   */
  create(input: CreateLocationInput): Location {
    const db = getDatabase();

    // 校验仓库+书架+层号组合唯一性
    const existing = db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.warehouse, input.warehouse),
          eq(locations.shelf, input.shelf),
          eq(locations.layer, input.layer),
        ),
      )
      .get();

    if (existing) {
      throw new Error(ERROR_MESSAGES.LOCATION_ALREADY_EXISTS);
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = uuidv4();

    const newLocation: typeof locations.$inferInsert = {
      id,
      warehouse: input.warehouse,
      shelf: input.shelf,
      layer: input.layer,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(locations).values(newLocation).run();

    const created = db.select().from(locations).where(eq(locations.id, id)).get()!;

    // 记录操作日志
    logOperation(OPERATION_TYPES.CREATE, ENTITY_TYPES.LOCATION, id, null, created);

    return created as Location;
  }

  /**
   * 更新位置信息
   * 1. 更新位置信息
   * 2. 记录修改时间戳
   * 3. 记录操作日志
   */
  update(id: string, input: UpdateLocationInput): Location {
    const db = getDatabase();

    // 查找现有位置
    const existing = db.select().from(locations).where(eq(locations.id, id)).get();
    if (!existing) {
      throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);
    }

    const beforeData = { ...existing };
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 如果更新了仓库/书架/层号，校验组合唯一性
    const newWarehouse = input.warehouse ?? existing.warehouse;
    const newShelf = input.shelf ?? existing.shelf;
    const newLayer = input.layer ?? existing.layer;

    const hasChange =
      newWarehouse !== existing.warehouse ||
      newShelf !== existing.shelf ||
      newLayer !== existing.layer;

    if (hasChange) {
      const duplicate = db
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.warehouse, newWarehouse),
            eq(locations.shelf, newShelf),
            eq(locations.layer, newLayer),
          ),
        )
        .get();

      if (duplicate) {
        throw new Error(ERROR_MESSAGES.LOCATION_ALREADY_EXISTS);
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: now };
    if (input.warehouse !== undefined) updateData.warehouse = input.warehouse;
    if (input.shelf !== undefined) updateData.shelf = input.shelf;
    if (input.layer !== undefined) updateData.layer = input.layer;

    db.update(locations).set(updateData).where(eq(locations.id, id)).run();

    const updated = db.select().from(locations).where(eq(locations.id, id)).get()!;

    // 记录操作日志
    logOperation(OPERATION_TYPES.EDIT, ENTITY_TYPES.LOCATION, id, beforeData, updated);

    return updated as Location;
  }

  /**
   * 删除位置
   * 1. 校验位置下是否有库存 > 0 的记录
   * 2. 有则拒绝删除并返回库存列表
   * 3. 记录操作日志
   */
  delete(id: string): void {
    const db = getDatabase();

    // 查找现有位置
    const existing = db.select().from(locations).where(eq(locations.id, id)).get();
    if (!existing) {
      throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);
    }

    // 查询该位置下的库存记录，检查是否有库存 > 0
    const stockRecords = db
      .select({
        stockId: stock.id,
        bookId: stock.bookId,
        editionId: stock.editionId,
        locationId: stock.locationId,
        quantity: stock.quantity,
      })
      .from(stock)
      .where(eq(stock.locationId, id))
      .all();

    const nonZeroStock = stockRecords.filter((s) => s.quantity > 0);
    if (nonZeroStock.length > 0) {
      const error = new Error(ERROR_MESSAGES.LOCATION_HAS_STOCK) as Error & { stockList?: unknown[] };
      error.stockList = nonZeroStock;
      throw error;
    }

    const beforeData = { ...existing };

    // 删除关联的库存记录（quantity 为 0 的记录）
    db.delete(stock).where(eq(stock.locationId, id)).run();

    // 删除位置
    db.delete(locations).where(eq(locations.id, id)).run();

    // 记录操作日志
    logOperation(OPERATION_TYPES.DELETE, ENTITY_TYPES.LOCATION, id, beforeData, null);
  }

  /**
   * 返回所有位置
   */
  list(): Location[] {
    const db = getDatabase();
    const data = db.select().from(locations).all();
    return data as Location[];
  }

  /**
   * 返回指定位置的所有库存单元及数量
   * JOIN books 和 editions 表来获取书名和版本名称
   */
  getStock(locationId: string): StockUnitAtLocation[] {
    const db = getDatabase();

    // 校验位置存在
    const existing = db.select().from(locations).where(eq(locations.id, locationId)).get();
    if (!existing) {
      throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);
    }

    const results = db
      .select({
        bookId: stock.bookId,
        editionId: stock.editionId,
        bookTitle: books.title,
        editionName: editions.name,
        quantity: stock.quantity,
      })
      .from(stock)
      .innerJoin(books, eq(stock.bookId, books.id))
      .innerJoin(editions, eq(stock.editionId, editions.id))
      .where(eq(stock.locationId, locationId))
      .all();

    return results as StockUnitAtLocation[];
  }
}
