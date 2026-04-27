/**
 * AlertService - 库存预警服务
 * 提供预警阈值设置、预警状态检查和预警列表查询功能
 */

import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { getDatabase } from '../db';
import {
  editions,
  books,
  stock,
  editionImages,
  bookImages,
} from '../db/schema';
import { StockService } from './stock.service';
import type { AlertStockUnit } from '../../shared/types';

export class AlertService {
  private stockService: StockService;

  constructor(stockService?: StockService) {
    this.stockService = stockService ?? new StockService();
  }

  /**
   * 设置/更新库存单元的预警阈值
   * 预警阈值存储在 editions 表的 alert_threshold 字段中
   * @param editionId 版本标识
   * @param threshold 预警阈值，传 null 表示取消预警
   */
  setThreshold(editionId: string, threshold: number | null): void {
    const db = getDatabase();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const existing = db
      .select()
      .from(editions)
      .where(eq(editions.id, editionId))
      .get();

    if (!existing) {
      throw new Error('版本不存在');
    }

    db.update(editions)
      .set({
        alertThreshold: threshold,
        updatedAt: now,
      })
      .where(eq(editions.id, editionId))
      .run();
  }

  /**
   * 检查库存单元总库存是否低于或等于预警阈值
   * 未设置预警阈值的库存单元不进行预警检查
   * @param bookId 书籍标识
   * @param editionId 版本标识
   * @returns 是否处于预警状态，未设置阈值时返回 false
   */
  checkAlert(bookId: string, editionId: string): boolean {
    const db = getDatabase();

    const edition = db
      .select({ alertThreshold: editions.alertThreshold })
      .from(editions)
      .where(eq(editions.id, editionId))
      .get();

    if (!edition || edition.alertThreshold === null) {
      return false;
    }

    const totalStock = this.stockService.getTotalStock(bookId, editionId);
    return totalStock <= edition.alertThreshold;
  }

  /**
   * 返回所有处于预警状态的库存单元及其当前总库存数量和预警阈值
   * 仅检查已设置预警阈值的库存单元
   * @returns AlertStockUnit[] 预警库存单元列表
   */
  getAlertList(): AlertStockUnit[] {
    const db = getDatabase();

    // 查询所有设置了预警阈值的版本，并计算其总库存
    const rows = db
      .select({
        bookId: editions.bookId,
        editionId: editions.id,
        bookTitle: books.title,
        editionName: editions.name,
        alertThreshold: editions.alertThreshold,
        totalQuantity: sql<number>`COALESCE((
          SELECT SUM(${stock.quantity})
          FROM ${stock}
          WHERE ${stock.bookId} = ${editions.bookId}
            AND ${stock.editionId} = ${editions.id}
        ), 0)`,
      })
      .from(editions)
      .innerJoin(books, eq(editions.bookId, books.id))
      .where(isNotNull(editions.alertThreshold))
      .all();

    // 筛选出处于预警状态的库存单元（总库存 <= 预警阈值）
    const alertUnits: AlertStockUnit[] = [];

    for (const row of rows) {
      if (row.alertThreshold !== null && row.totalQuantity <= row.alertThreshold) {
        // 获取缩略图路径
        const thumbnailPath = this.getThumbnailPath(row.bookId, row.editionId);

        alertUnits.push({
          bookId: row.bookId,
          editionId: row.editionId,
          bookTitle: row.bookTitle,
          editionName: row.editionName,
          totalQuantity: row.totalQuantity,
          alertThreshold: row.alertThreshold,
          thumbnailPath,
        });
      }
    }

    return alertUnits;
  }

  /**
   * 获取库存单元的缩略图路径
   * 优先显示版本封面，无版本封面时显示书籍默认封面，均无时返回 null
   */
  private getThumbnailPath(bookId: string, editionId: string): string | null {
    const db = getDatabase();

    // 优先查找版本封面
    const edImage = db
      .select({ thumbnailPath: editionImages.thumbnailPath })
      .from(editionImages)
      .where(eq(editionImages.editionId, editionId))
      .get();

    if (edImage) {
      return edImage.thumbnailPath;
    }

    // 查找书籍默认封面
    const bkImage = db
      .select({ thumbnailPath: bookImages.thumbnailPath })
      .from(bookImages)
      .where(eq(bookImages.bookId, bookId))
      .get();

    return bkImage?.thumbnailPath ?? null;
  }
}
