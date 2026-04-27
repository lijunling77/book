/**
 * StockService - 库存管理服务
 * 提供库存数量查询、调整、列表和汇总功能
 * adjustStock 是核心方法，会被 InboundService 和 OutboundService 调用
 */

import { eq, and, like, sql, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import {
  stock,
  books,
  editions,
  locations,
  inboundRecords,
  outboundRecords,
  editionImages,
  bookImages,
} from '../db/schema';
import {
  ERROR_MESSAGES,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  STOCK_STATUS,
} from '../../shared/constants';
import type {
  StockFilter,
  StockView,
  StockSummaryView,
  PaginatedResult,
} from '../../shared/types';

export class StockService {
  /**
   * 查询特定库存单元在特定位置的数量
   * @param bookId 书籍标识
   * @param editionId 版本标识
   * @param locationId 位置标识
   * @returns 库存数量，不存在时返回 0
   */
  getStockQuantity(bookId: string, editionId: string, locationId: string): number {
    const db = getDatabase();

    const record = db
      .select({ quantity: stock.quantity })
      .from(stock)
      .where(
        and(
          eq(stock.bookId, bookId),
          eq(stock.editionId, editionId),
          eq(stock.locationId, locationId),
        ),
      )
      .get();

    return record?.quantity ?? 0;
  }

  /**
   * 调整库存数量（delta 可正可负）
   * - 如果库存记录不存在且 delta > 0，则创建新记录
   * - 如果调整后结果为负，则抛出异常
   * @param bookId 书籍标识
   * @param editionId 版本标识
   * @param locationId 位置标识
   * @param delta 调整量（正数增加，负数减少）
   */
  adjustStock(bookId: string, editionId: string, locationId: string, delta: number): void {
    const db = getDatabase();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const existing = db
      .select()
      .from(stock)
      .where(
        and(
          eq(stock.bookId, bookId),
          eq(stock.editionId, editionId),
          eq(stock.locationId, locationId),
        ),
      )
      .get();

    if (existing) {
      const newQuantity = existing.quantity + delta;
      if (newQuantity < 0) {
        throw new Error(ERROR_MESSAGES.STOCK_WOULD_BE_NEGATIVE);
      }

      db.update(stock)
        .set({ quantity: newQuantity, updatedAt: now })
        .where(eq(stock.id, existing.id))
        .run();
    } else {
      // 库存记录不存在
      if (delta < 0) {
        throw new Error(ERROR_MESSAGES.STOCK_WOULD_BE_NEGATIVE);
      }

      if (delta > 0) {
        db.insert(stock)
          .values({
            id: uuidv4(),
            bookId,
            editionId,
            locationId,
            quantity: delta,
            updatedAt: now,
          })
          .run();
      }
      // delta === 0 且记录不存在时，不做任何操作
    }
  }

  /**
   * 查询库存单元在所有位置的总数量
   * @param bookId 书籍标识
   * @param editionId 版本标识
   * @returns 总库存数量
   */
  getTotalStock(bookId: string, editionId: string): number {
    const db = getDatabase();

    const result = db
      .select({
        total: sql<number>`COALESCE(SUM(${stock.quantity}), 0)`,
      })
      .from(stock)
      .where(and(eq(stock.bookId, bookId), eq(stock.editionId, editionId)))
      .get();

    return result?.total ?? 0;
  }

  /**
   * 库存列表查询
   * 支持按书名、分类、版本名称、位置筛选
   * JOIN books, editions, locations 表获取关联信息
   * 计算价格统计信息（最近买入/售出价格、价格范围、平均价格）
   * 库存为零时标记"缺货"
   */
  list(filter?: StockFilter): PaginatedResult<StockView> {
    const db = getDatabase();
    const page = filter?.page ?? DEFAULT_PAGE;
    const pageSize = filter?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    // 构建 WHERE 条件
    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookTitle) {
      conditions.push(like(books.title, `%${filter.bookTitle}%`));
    }
    if (filter?.category) {
      conditions.push(like(books.category, `%${filter.category}%`));
    }
    if (filter?.editionName) {
      conditions.push(like(editions.name, `%${filter.editionName}%`));
    }
    if (filter?.locationId) {
      conditions.push(eq(stock.locationId, filter.locationId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询总数
    const countQuery = db
      .select({ count: count() })
      .from(stock)
      .innerJoin(books, eq(stock.bookId, books.id))
      .innerJoin(editions, eq(stock.editionId, editions.id))
      .innerJoin(locations, eq(stock.locationId, locations.id));

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const totalResult = countQuery.get();
    const total = totalResult?.count ?? 0;

    // 查询分页数据
    const dataQuery = db
      .select({
        stockId: stock.id,
        bookId: stock.bookId,
        editionId: stock.editionId,
        locationId: stock.locationId,
        quantity: stock.quantity,
        bookTitle: books.title,
        author: books.author,
        isbn: books.isbn,
        category: books.category,
        editionName: editions.name,
        alertThreshold: editions.alertThreshold,
        warehouse: locations.warehouse,
        shelf: locations.shelf,
        layer: locations.layer,
      })
      .from(stock)
      .innerJoin(books, eq(stock.bookId, books.id))
      .innerJoin(editions, eq(stock.editionId, editions.id))
      .innerJoin(locations, eq(stock.locationId, locations.id));

    if (whereClause) {
      dataQuery.where(whereClause);
    }

    const rows = dataQuery.limit(pageSize).offset(offset).all();

    // 为每条记录计算价格统计信息和缩略图
    const data: StockView[] = rows.map((row) => {
      const priceStats = this.getPriceStats(row.bookId, row.editionId);
      const thumbnailPath = this.getThumbnailPath(row.bookId, row.editionId);

      // 计算该库存单元在所有位置的总库存量，用于预警判断
      const totalStock = this.getTotalStock(row.bookId, row.editionId);
      const isAlert =
        row.alertThreshold !== null && totalStock <= row.alertThreshold;

      return {
        stockId: row.stockId,
        bookId: row.bookId,
        editionId: row.editionId,
        locationId: row.locationId,
        bookTitle: row.bookTitle,
        author: row.author,
        isbn: row.isbn,
        category: row.category,
        editionName: row.editionName,
        warehouse: row.warehouse,
        shelf: row.shelf,
        layer: row.layer,
        quantity: row.quantity,
        status: row.quantity === 0 ? STOCK_STATUS.OUT_OF_STOCK : STOCK_STATUS.NORMAL,
        alertThreshold: row.alertThreshold,
        isAlert,
        latestPurchasePrice: priceStats.latestPurchasePrice,
        latestSellingPrice: priceStats.latestSellingPrice,
        purchasePriceMin: priceStats.purchasePriceMin,
        purchasePriceMax: priceStats.purchasePriceMax,
        averagePurchasePrice: priceStats.averagePurchasePrice,
        averageSellingPrice: priceStats.averageSellingPrice,
        thumbnailPath,
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 汇总视图：显示每个库存单元在所有位置的总库存数量
   */
  summary(filter?: StockFilter): StockSummaryView[] {
    const db = getDatabase();

    // 构建 WHERE 条件
    const conditions: ReturnType<typeof eq>[] = [];

    if (filter?.bookTitle) {
      conditions.push(like(books.title, `%${filter.bookTitle}%`));
    }
    if (filter?.category) {
      conditions.push(like(books.category, `%${filter.category}%`));
    }
    if (filter?.editionName) {
      conditions.push(like(editions.name, `%${filter.editionName}%`));
    }
    if (filter?.locationId) {
      conditions.push(eq(stock.locationId, filter.locationId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = db
      .select({
        bookId: stock.bookId,
        editionId: stock.editionId,
        bookTitle: books.title,
        author: books.author,
        isbn: books.isbn,
        category: books.category,
        editionName: editions.name,
        alertThreshold: editions.alertThreshold,
        totalQuantity: sql<number>`COALESCE(SUM(${stock.quantity}), 0)`,
      })
      .from(stock)
      .innerJoin(books, eq(stock.bookId, books.id))
      .innerJoin(editions, eq(stock.editionId, editions.id))
      .innerJoin(locations, eq(stock.locationId, locations.id));

    if (whereClause) {
      query.where(whereClause);
    }

    const rows = query
      .groupBy(stock.bookId, stock.editionId)
      .all();

    return rows.map((row) => {
      const thumbnailPath = this.getThumbnailPath(row.bookId, row.editionId);
      const isAlert =
        row.alertThreshold !== null && row.totalQuantity <= row.alertThreshold;

      return {
        bookId: row.bookId,
        editionId: row.editionId,
        bookTitle: row.bookTitle,
        author: row.author,
        isbn: row.isbn,
        category: row.category,
        editionName: row.editionName,
        totalQuantity: row.totalQuantity,
        alertThreshold: row.alertThreshold,
        isAlert,
        thumbnailPath,
      };
    });
  }

  /**
   * 获取库存单元的价格统计信息
   * 包括最近买入/售出价格、价格范围、平均价格
   */
  private getPriceStats(
    bookId: string,
    editionId: string,
  ): {
    latestPurchasePrice: number | null;
    latestSellingPrice: number | null;
    purchasePriceMin: number | null;
    purchasePriceMax: number | null;
    averagePurchasePrice: number | null;
    averageSellingPrice: number | null;
  } {
    const db = getDatabase();

    // 最近买入价格（按入库日期倒序，取第一条）
    const latestInbound = db
      .select({ purchasePrice: inboundRecords.purchasePrice })
      .from(inboundRecords)
      .where(
        and(
          eq(inboundRecords.bookId, bookId),
          eq(inboundRecords.editionId, editionId),
        ),
      )
      .orderBy(sql`${inboundRecords.inboundDate} DESC, ${inboundRecords.createdAt} DESC`)
      .limit(1)
      .get();

    // 最近售出价格（按出库日期倒序，取第一条）
    const latestOutbound = db
      .select({ sellingPrice: outboundRecords.sellingPrice })
      .from(outboundRecords)
      .where(
        and(
          eq(outboundRecords.bookId, bookId),
          eq(outboundRecords.editionId, editionId),
        ),
      )
      .orderBy(sql`${outboundRecords.outboundDate} DESC, ${outboundRecords.createdAt} DESC`)
      .limit(1)
      .get();

    // 买入价格统计（最小值、最大值、加权平均）
    const purchaseStats = db
      .select({
        minPrice: sql<number | null>`MIN(${inboundRecords.purchasePrice})`,
        maxPrice: sql<number | null>`MAX(${inboundRecords.purchasePrice})`,
        weightedAvg: sql<number | null>`CASE WHEN SUM(${inboundRecords.quantity}) > 0 THEN SUM(${inboundRecords.purchasePrice} * ${inboundRecords.quantity}) / SUM(${inboundRecords.quantity}) ELSE NULL END`,
      })
      .from(inboundRecords)
      .where(
        and(
          eq(inboundRecords.bookId, bookId),
          eq(inboundRecords.editionId, editionId),
        ),
      )
      .get();

    // 售出价格统计（加权平均）
    const sellingStats = db
      .select({
        weightedAvg: sql<number | null>`CASE WHEN SUM(${outboundRecords.quantity}) > 0 THEN SUM(${outboundRecords.sellingPrice} * ${outboundRecords.quantity}) / SUM(${outboundRecords.quantity}) ELSE NULL END`,
      })
      .from(outboundRecords)
      .where(
        and(
          eq(outboundRecords.bookId, bookId),
          eq(outboundRecords.editionId, editionId),
        ),
      )
      .get();

    return {
      latestPurchasePrice: latestInbound?.purchasePrice ?? null,
      latestSellingPrice: latestOutbound?.sellingPrice ?? null,
      purchasePriceMin: purchaseStats?.minPrice ?? null,
      purchasePriceMax: purchaseStats?.maxPrice ?? null,
      averagePurchasePrice: purchaseStats?.weightedAvg ?? null,
      averageSellingPrice: sellingStats?.weightedAvg ?? null,
    };
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
