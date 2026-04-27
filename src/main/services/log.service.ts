/**
 * LogService - 操作日志服务
 * 提供操作日志的创建和查询功能
 * 支持按操作类型、日期范围、操作对象类型和标识筛选，按操作时间倒序排列，分页查询
 */

import { eq, and, gte, lte, desc, count, type SQL } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { operationLogs } from '../db/schema';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../../shared/constants';
import type {
  OperationLog,
  LogFilter,
  PaginatedResult,
  OperationType,
  EntityType,
} from '../../shared/types';

export class LogService {
  /**
   * 创建操作日志
   * 记录操作类型（创建/编辑/删除/盘点调整）、操作对象类型、操作对象标识、操作时间、变更前数据和变更后数据
   *
   * @param operationType 操作类型
   * @param entityType 操作对象类型
   * @param entityId 操作对象标识
   * @param beforeData 变更前数据（创建操作时为 null）
   * @param afterData 变更后数据（删除操作时为 null）
   * @returns 创建的操作日志记录
   */
  create(
    operationType: OperationType,
    entityType: EntityType,
    entityId: string,
    beforeData: unknown | null,
    afterData: unknown | null,
  ): OperationLog {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const newLog: typeof operationLogs.$inferInsert = {
      id,
      operationType,
      entityType,
      entityId,
      beforeData: beforeData ? JSON.stringify(beforeData) : null,
      afterData: afterData ? JSON.stringify(afterData) : null,
      createdAt: now,
    };

    db.insert(operationLogs).values(newLog).run();

    const created = db.select().from(operationLogs).where(eq(operationLogs.id, id)).get()!;

    return created as OperationLog;
  }

  /**
   * 查询操作日志列表
   * 支持按操作类型、日期范围、操作对象类型和标识筛选
   * 按操作时间倒序排列，分页查询
   *
   * @param filter 筛选条件
   * @returns 分页查询结果
   */
  list(filter?: LogFilter): PaginatedResult<OperationLog> {
    const db = getDatabase();
    const page = filter?.page ?? DEFAULT_PAGE;
    const pageSize = filter?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    // 构建筛选条件
    const conditions: SQL[] = [];

    if (filter?.operationType) {
      conditions.push(eq(operationLogs.operationType, filter.operationType));
    }

    if (filter?.entityType) {
      conditions.push(eq(operationLogs.entityType, filter.entityType));
    }

    if (filter?.entityId) {
      conditions.push(eq(operationLogs.entityId, filter.entityId));
    }

    if (filter?.dateRange) {
      if (filter.dateRange.startDate) {
        conditions.push(gte(operationLogs.createdAt, filter.dateRange.startDate));
      }
      if (filter.dateRange.endDate) {
        // 日期范围的结束日期包含当天，追加时间到当天结束
        const endDate = filter.dateRange.endDate.includes(' ')
          ? filter.dateRange.endDate
          : `${filter.dateRange.endDate} 23:59:59`;
        conditions.push(lte(operationLogs.createdAt, endDate));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询总数
    const countQuery = db.select({ count: count() }).from(operationLogs);
    const totalResult = whereClause
      ? countQuery.where(whereClause).get()
      : countQuery.get();
    const total = totalResult?.count ?? 0;

    // 查询分页数据，按操作时间倒序排列
    const dataQuery = db
      .select()
      .from(operationLogs)
      .orderBy(desc(operationLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const data = whereClause
      ? dataQuery.where(whereClause).all()
      : dataQuery.all();

    return {
      data: data as OperationLog[],
      total,
      page,
      pageSize,
    };
  }
}
